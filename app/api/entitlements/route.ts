import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { ALL_TOOL_IDS } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export interface OfflineGrant {
  sub: string;
  plan: string;
  tools: string[];
  /** Unix seconds. */
  exp: number;
  iat: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Returns the authoritative entitlement for the signed-in user.
 *
 * - Billing state comes from the database, which is only ever written by the verified
 *   Stripe webhook. The browser cannot grant itself a plan.
 * - A short-lived signed grant is issued so the app can work offline for a grace
 *   period. The client stores it but cannot forge it without the server secret.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      plan: null,
      tools: [],
      status: "local",
      grant: null,
      message: "Supabase is not configured. Running in local-only mode.",
    });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = (await supabase!.auth.getUser()) ?? { data: { user: null } };

  if (!user) {
    return NextResponse.json({ configured: true, plan: null, tools: [], status: "anonymous" }, { status: 401 });
  }

  const adminAccess = isAdminEmail(user.email);
  const { data: entitlement } = adminAccess
    ? { data: null }
    : await supabase!
        .from("billing_entitlements")
        .select("plan, tools, status, current_period_end, grace_until")
        .eq("user_id", user.id)
        .maybeSingle();

  // Admins always receive the complete tool set for product testing, independent of billing rows.
  const plan = adminAccess ? "unlimited" : entitlement?.plan ?? "free";
  const tools: string[] = adminAccess ? ALL_TOOL_IDS : entitlement?.tools ?? [];
  const status = adminAccess ? "active" : entitlement?.status ?? "free";

  let grant: string | null = null;
  const secret = process.env.ENTITLEMENT_SIGNING_SECRET;
  if (secret) {
    const now = Math.floor(Date.now() / 1000);
    const payload: OfflineGrant = {
      sub: user.id,
      plan,
      tools,
      iat: now,
      exp: now + 7 * 24 * 60 * 60,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    grant = `${encoded}.${sign(encoded, secret)}`;
  }

  return NextResponse.json({
    configured: true,
    plan,
    tools,
    status,
    currentPeriodEnd: adminAccess ? null : entitlement?.current_period_end ?? null,
    adminAccess,
    grant,
    gracePeriodDays: 7,
  });
}
