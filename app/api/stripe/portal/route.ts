import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 501 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 501 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = (await supabase!.auth.getUser()) ?? { data: { user: null } };
  if (!user) return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });

  const { data: customer } = await supabase!
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = customer?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account yet. Choose a plan first." }, { status: 400 });
  }

  const stripe = new Stripe(secret);
  const appUrl = getSiteUrl();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/app/billing`,
  });

  return NextResponse.json({ url: session.url });
}
