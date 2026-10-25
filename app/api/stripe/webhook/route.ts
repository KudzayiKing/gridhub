import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ALL_TOOL_IDS } from "@/lib/catalog";
import { PLANS, type BillingInterval, type PlanId } from "@/lib/plans";
import { getServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Map a Stripe price id back to our plan + interval using server-side env only. */
function planFromPrice(priceId: string | undefined): { plan: PlanId; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of PLANS) {
    for (const interval of ["monthly", "annual"] as BillingInterval[]) {
      const envKey = plan.stripeEnv[interval];
      if (envKey && process.env[envKey] === priceId) return { plan: plan.id, interval };
    }
  }
  return null;
}

function toolsForPlan(plan: PlanId, metadataTools?: string | null): string[] {
  if (plan === "unlimited") return [...ALL_TOOL_IDS];
  if (plan === "free") return ["budget"];
  const selected = (metadataTools ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => (ALL_TOOL_IDS as string[]).includes(t));
  return selected;
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const stripe = new Stripe(secretKey);
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "Database credentials unavailable" }, { status: 501 });

  // Idempotency: the event id is a primary key, so replays are ignored.
  const { error: insertError } = await db
    .from("billing_events")
    .insert({ stripe_event_id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> });

  if (insertError && insertError.code === "23505") {
    // A prior attempt may have inserted the event before a later billing write
    // failed. Retry unprocessed events so Stripe's delivery retry can recover.
    const { data, error } = await db
      .from("billing_events")
      .select("processed_at")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Could not check webhook event status" }, { status: 500 });
    if (data?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  } else if (insertError) {
    return NextResponse.json({ error: "Could not record webhook event" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
          await applySubscription(db, subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await applySubscription(db, event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = (subscription.metadata?.user_id as string | undefined) ?? null;
        if (userId) {
          const entitlementWrite = await db
            .from("billing_entitlements")
            .upsert(
              {
                user_id: userId,
                plan: "free",
                tools: ["budget"],
                status: "canceled",
                current_period_end: null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );
          assertDbWrite(entitlementWrite.error, "Could not cancel billing entitlement");
          const subscriptionWrite = await db
            .from("billing_subscriptions")
            .upsert(
              {
                user_id: userId,
                stripe_subscription_id: subscription.id,
                status: "canceled",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "stripe_subscription_id" },
            );
          assertDbWrite(subscriptionWrite.error, "Could not cancel billing subscription");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof (invoice as unknown as { subscription?: string }).subscription === "string"
            ? ((invoice as unknown as { subscription?: string }).subscription as string)
            : null;
        if (subscriptionId) {
          const subscriptionWrite = await db
            .from("billing_subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subscriptionId);
          assertDbWrite(subscriptionWrite.error, "Could not mark subscription past due");
          const { data: row, error: readError } = await db
            .from("billing_subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();
          assertDbWrite(readError, "Could not find subscription owner");
          if (row?.user_id) {
            const entitlementWrite = await db
              .from("billing_entitlements")
              .update({ status: "past_due", updated_at: new Date().toISOString() })
              .eq("user_id", row.user_id);
            assertDbWrite(entitlementWrite.error, "Could not mark entitlement past due");
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    await db
      .from("billing_events")
      .update({ processed_at: null, error: error instanceof Error ? error.message : "unknown" })
      .eq("stripe_event_id", event.id);
    // Returning 500 lets Stripe retry.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  const processedWrite = await db
    .from("billing_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("stripe_event_id", event.id);
  if (processedWrite.error) return NextResponse.json({ error: "Could not mark webhook event processed" }, { status: 500 });

  return NextResponse.json({ received: true });
}

async function applySubscription(
  db: NonNullable<ReturnType<typeof getServiceClient>>,
  subscription: Stripe.Subscription,
) {
  const userId = subscription.metadata?.user_id as string | undefined;
  if (!userId) return;

  const item = subscription.items.data[0];
  const mapped = planFromPrice(item?.price?.id);
  const plan: PlanId = mapped?.plan ?? ((subscription.metadata?.plan as PlanId) || "single");
  const interval: BillingInterval = mapped?.interval ?? ((subscription.metadata?.interval as BillingInterval) || "monthly");
  const tools = toolsForPlan(plan, subscription.metadata?.tools);

  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? "active"
      : subscription.status === "past_due"
        ? "past_due"
        : subscription.status;

  const periodEnd =
    typeof (subscription as unknown as { current_period_end?: number }).current_period_end === "number"
      ? new Date(
          (subscription as unknown as { current_period_end: number }).current_period_end * 1000,
        ).toISOString()
      : null;

  const subscriptionWrite = await db.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: String(subscription.customer),
      plan,
      interval,
      status,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  assertDbWrite(subscriptionWrite.error, "Could not save billing subscription");

  const entitlementWrite = await db.from("billing_entitlements").upsert(
    {
      user_id: userId,
      plan: status === "active" ? plan : "free",
      tools: status === "active" ? tools : ["budget"],
      status,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  assertDbWrite(entitlementWrite.error, "Could not save billing entitlement");

  const selectionsWrite = await db.from("subscription_tool_selections").upsert(
    tools.map((toolId) => ({ user_id: userId, tool_id: toolId, active: true })),
    { onConflict: "user_id,tool_id" },
  );
  assertDbWrite(selectionsWrite.error, "Could not save subscription tool selections");
}

function assertDbWrite(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(`${fallback}: ${error.message}`);
}
