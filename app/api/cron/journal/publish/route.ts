import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function authorized(request: Request) { const secret = process.env.JOURNAL_CRON_SECRET; const value = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""; if (!secret || !value) return false; const a = Buffer.from(secret); const b = Buffer.from(value); return a.length === b.length && timingSafeEqual(a, b); }
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = getServiceClient(); if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const now = new Date(); const runKey = `publish:${now.toISOString().slice(0, 16)}`;
  const { data: previous, error: lookupError } = await service.from("journal_job_runs").select("id,status,attempts").eq("idempotency_key", runKey).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (previous?.status === "completed" || previous?.status === "running") return NextResponse.json({ ok: true, duplicate: true, published: 0 });
  let run = previous;
  if (previous?.status === "failed") {
    const { data, error } = await service.from("journal_job_runs").update({ status: "running", attempts: previous.attempts + 1, started_at: now.toISOString(), finished_at: null, error_message: null }).eq("id", previous.id).eq("status", "failed").select("id,status,attempts").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: true, duplicate: true, published: 0 });
    run = data;
  } else if (!previous) {
    const { data, error } = await service.from("journal_job_runs").insert({ job_type: "scheduled_publication", idempotency_key: runKey, status: "running", attempts: 1, started_at: now.toISOString() }).select("id,status,attempts").single();
    if (error?.code === "23505") return NextResponse.json({ ok: true, duplicate: true, published: 0 });
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not start publication job" }, { status: 500 });
    run = data;
  }
  if (!run) return NextResponse.json({ error: "Could not start publication job" }, { status: 500 });
  const { data: due, error } = await service.from("journal_publication_schedule").select("id,article_id,revision_id,publish_at").eq("status", "scheduled").lte("publish_at", now.toISOString()).limit(100);
  if (error) { await service.from("journal_job_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: error.message }).eq("id", run.id); return NextResponse.json({ error: error.message }, { status: 500 }); }
  let published = 0; const failures: string[] = [];
  for (const item of due ?? []) {
    const { data: article } = await service.from("journal_articles").select("id,status,approved_revision_id,published_revision_id").eq("id", item.article_id).maybeSingle();
    if (!article || article.status !== "scheduled" || article.approved_revision_id !== item.revision_id) { await service.from("journal_publication_schedule").update({ status: "canceled" }).eq("id", item.id).eq("status", "scheduled"); continue; }
    const { data: updated, error: publishError } = await service.from("journal_articles").update({ status: "published", published_revision_id: item.revision_id, published_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", item.article_id).eq("status", "scheduled").eq("approved_revision_id", item.revision_id).select("id").maybeSingle();
    if (publishError) { failures.push(`${item.article_id}: ${publishError.message}`); continue; }
    if (updated) { await service.from("journal_publication_schedule").update({ status: "published" }).eq("id", item.id).eq("status", "scheduled"); await service.from("journal_publication_events").insert({ article_id: item.article_id, revision_id: item.revision_id, event_type: article.published_revision_id ? "republished" : "published", source: "scheduled_job" }); published++; }
  }
  await service.from("journal_job_runs").update({ status: failures.length ? "failed" : "completed", finished_at: new Date().toISOString(), error_message: failures.length ? failures.join("; ").slice(0, 2000) : null, summary: { due: due?.length ?? 0, published } }).eq("id", run.id);
  return NextResponse.json({ ok: failures.length === 0, published, failures });
}
