import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site-url";
import Stripe from "stripe";
import { PLANS, isPlanId, type BillingInterval } from "@/lib/plans";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY and the price IDs in .env.local." },
      { status: 501 },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured, so subscriptions cannot be attached to an account." }, { status: 501 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = (await supabase!.auth.getUser()) ?? { data: { user: null } };

  if (!user) return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });

  let body: { plan?: string; interval?: string; tools?: string[] };
  try {
    body = (await request.json()) as { plan?: string; interval?: string; tools?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const planId = body.plan ?? "";
  const interval = (body.interval ?? "monthly") as BillingInterval;

  if (!isPlanId(planId) || planId === "free") {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  if (interval !== "monthly" && interval !== "annual") {
    return NextResponse.json({ error: "Unknown billing interval" }, { status: 400 });
  }

  // The price is always resolved on the server from the plan table — never trusted
  // from the browser.
  const plan = PLANS.find((p) => p.id === planId)!;
  const envKey = plan.stripeEnv[interval];
  const priceId = envKey ? process.env[envKey] : undefined;

  if (!priceId) {
    return NextResponse.json(
      { error: `Missing ${envKey}. Create the Stripe price and add it to .env.local.` },
      { status: 501 },
    );
  }

  const tools = (body.tools ?? []).filter((t) => typeof t === "string").slice(0, plan.toolLimit);

  const stripe = new Stripe(secret);
  const appUrl = getSiteUrl();

  // Reuse the Stripe customer for this user when we already have one.
  const { data: existing } = await supabase!
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabase!.from("billing_customers").upsert(
      { user_id: user.id, stripe_customer_id: customerId },
      { onConflict: "user_id" },
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    subscription_data: {
      metadata: { user_id: user.id, plan: planId, interval, tools: tools.join(",") },
    },
    metadata: { user_id: user.id, plan: planId, interval, tools: tools.join(",") },
    success_url: `${appUrl}/app/billing?checkout=success`,
    cancel_url: `${appUrl}/app/billing?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
