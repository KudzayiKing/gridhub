import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowed = new Set(["journal_article_viewed", "journal_cta_clicked", "journal_calculator_opened"]);
export async function POST(request: Request) {
  let body: { articleId?: unknown; eventName?: unknown; sessionId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.articleId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.articleId) || typeof body.eventName !== "string" || !allowed.has(body.eventName) || typeof body.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const service = getServiceClient(); if (!service) return NextResponse.json({ ok: true });
  const { data: article } = await service.from("journal_articles").select("id").eq("id", body.articleId).not("published_revision_id", "is", null).neq("status", "archived").not("published_at", "is", null).lte("published_at", new Date().toISOString()).maybeSingle();
  if (!article) return NextResponse.json({ error: "Article unavailable" }, { status: 404 });
  const { error } = await service.from("journal_events").upsert({ article_id: body.articleId, event_name: body.eventName, anonymous_session_id: body.sessionId }, { onConflict: "article_id,event_name,anonymous_session_id", ignoreDuplicates: true });
  return error ? NextResponse.json({ error: "Event unavailable" }, { status: 503 }) : NextResponse.json({ ok: true });
}
