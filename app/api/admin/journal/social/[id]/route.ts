import { NextResponse } from "next/server";
import { journalAdmin } from "@/lib/journal/auth";
import { getServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { id } = await params;
  let input: { action?: string; title?: string; body?: string; cta_url?: string; creative_brief?: unknown; scheduled_at?: string; notes?: string };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { data: post, error } = await service.from("journal_social_posts").select("*").eq("id", id).maybeSingle();
  if (error || !post) return NextResponse.json({ error: "Social draft not found" }, { status: 404 });
  const action = input.action;
  const now = new Date().toISOString();

  if (action === "save") {
    if (["scheduled", "published_manual", "canceled"].includes(post.status)) return NextResponse.json({ error: "This post is locked in its current publication state." }, { status: 409 });
    if (typeof input.title !== "string" || typeof input.body !== "string" || input.body.trim().length < 10) return NextResponse.json({ error: "Add a title and at least 10 characters of post content." }, { status: 400 });
    const { data: latest } = await service.from("journal_social_post_revisions").select("revision_number,title,body,cta_url,creative_brief").eq("social_post_id", id).order("revision_number", { ascending: false }).limit(1).maybeSingle();
    const same = latest && latest.title === input.title && latest.body === input.body && latest.cta_url === (input.cta_url ?? "") && JSON.stringify(latest.creative_brief) === JSON.stringify(input.creative_brief ?? {});
    if (same) return NextResponse.json({ ok: true, unchanged: true });
    const { data: revision, error: revisionError } = await service.from("journal_social_post_revisions").insert({
      social_post_id: id, revision_number: (latest?.revision_number ?? 0) + 1, title: input.title.trim(), body: input.body.trim(),
      cta_url: input.cta_url ?? "", creative_brief: input.creative_brief ?? {}, change_note: "Edited social content", created_by: auth.userId,
    }).select("id").single();
    if (revisionError || !revision) return NextResponse.json({ error: revisionError?.message ?? "Could not save revision" }, { status: 500 });
    const { error: updateError } = await service.from("journal_social_posts").update({ current_revision_id: revision.id, approved_revision_id: null, status: "draft", updated_by: auth.userId, updated_at: now }).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, revision_id: revision.id });
  }

  if (action === "request-review") {
    if (!["draft", "needs_revision"].includes(post.status)) return NextResponse.json({ error: "Only a draft can be submitted for review." }, { status: 409 });
    if (!post.current_revision_id) return NextResponse.json({ error: "Save a content revision before requesting review." }, { status: 409 });
    const { error: updateError } = await service.from("journal_social_posts").update({ status: "needs_review", updated_by: auth.userId, updated_at: now }).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "needs_review" });
  }

  if (action === "approve" || action === "request-changes") {
    if (post.status !== "needs_review" || !post.current_revision_id) return NextResponse.json({ error: "Submit this draft for review first." }, { status: 409 });
    const decision = action === "approve" ? "approved" : "needs_revision";
    const { error: auditError } = await service.from("journal_social_approvals").insert({ social_post_id: id, revision_id: post.current_revision_id, reviewer_id: auth.userId, decision, notes: input.notes ?? "" });
    if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 });
    const { error: updateError } = await service.from("journal_social_posts").update({ status: decision === "approved" ? "approved" : "needs_revision", approved_revision_id: decision === "approved" ? post.current_revision_id : null, updated_by: auth.userId, updated_at: now }).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: decision });
  }

  if (action === "schedule") {
    if (post.status !== "approved" || post.approved_revision_id !== post.current_revision_id) return NextResponse.json({ error: "Approve the current revision before scheduling." }, { status: 409 });
    const scheduledAt = input.scheduled_at ? new Date(input.scheduled_at) : null;
    if (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future date and time." }, { status: 400 });
    const { data: article } = await service.from("journal_articles").select("status,published_at,publish_at").eq("id", post.source_article_id).maybeSingle();
    const publicAt = article?.status === "published" ? (article.published_at ? new Date(article.published_at).getTime() : null) : article?.publish_at ? new Date(article.publish_at).getTime() : null;
    if (!publicAt || publicAt > scheduledAt.getTime()) return NextResponse.json({ error: "The article must be public by the scheduled social post time. Schedule the article first or choose a later reminder." }, { status: 409 });
    const { error: updateError } = await service.from("journal_social_posts").update({ status: "scheduled", scheduled_at: scheduledAt.toISOString(), publication_mode: "manual", updated_by: auth.userId, updated_at: now }).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "scheduled", note: "Saved as a manual publishing reminder; no social scheduler is connected." });
  }

  if (action === "cancel-schedule") {
    if (post.status !== "scheduled") return NextResponse.json({ error: "This post is not scheduled." }, { status: 409 });
    const { error: updateError } = await service.from("journal_social_posts").update({ status: "approved", scheduled_at: null, updated_by: auth.userId, updated_at: now }).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (action === "mark-published-manually") {
    if (!["approved", "scheduled"].includes(post.status)) return NextResponse.json({ error: "Approve this post before recording manual publication." }, { status: 409 });
    const { data: article } = await service.from("journal_articles").select("status,published_at").eq("id", post.source_article_id).maybeSingle();
    if (article?.status !== "published" || !article.published_at || new Date(article.published_at).getTime() > Date.now()) return NextResponse.json({ error: "The source article must already be public before recording social publication." }, { status: 409 });
    const { error: updateError } = await service.from("journal_social_posts").update({ status: "published_manual", publication_mode: "manual", published_at: now, updated_by: auth.userId, updated_at: now }).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "published_manual", note: "Recorded as user-reported manual publication." });
  }

  return NextResponse.json({ error: "Unknown social workflow action." }, { status: 400 });
}
