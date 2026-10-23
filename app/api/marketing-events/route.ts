import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const events = new Set(["calculator_view", "signup_click"]);
const tools = new Set(["debt-payoff-calculator", "monthly-budget-calculator", "rental-property-calculator", "savings-goal-calculator", "profit-margin-calculator", "invoice-total-calculator"]);

export async function POST(request: Request) {
  let body: { event?: unknown; toolId?: unknown; sessionId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.event !== "string" || !events.has(body.event) || typeof body.toolId !== "string" || !tools.has(body.toolId) || typeof body.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  const client = getServiceClient();
  if (!client) return NextResponse.json({ ok: true });
  const { error } = await client.from("marketing_events").upsert(
    { event_name: body.event, tool_id: body.toolId, anonymous_session_id: body.sessionId },
    { onConflict: "event_name,tool_id,anonymous_session_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: "Event unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
