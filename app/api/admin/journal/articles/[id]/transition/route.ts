import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { journalAdmin } from "@/lib/journal/auth";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const transitions: Record<string, string[]> = {
  idea: ["researching", "archived"], researching: ["brief_ready", "needs_revision", "archived"], brief_ready: ["drafting", "archived"], drafting: ["draft", "needs_revision"],
  draft: ["quality_review", "archived"], quality_review: ["awaiting_approval", "needs_revision"], needs_revision: ["draft", "researching", "archived"],
  awaiting_approval: ["approved", "needs_revision"], approved: ["scheduled", "published", "needs_revision"], scheduled: ["approved", "published", "archived"],
  published: ["archived", "draft"], archived: ["draft"],
};
const requiredReviewChecks = ["search_intent", "primary_claims", "calculations", "original_value", "readability", "internal_links", "cta_relevance", "metadata", "accessibility"];

export async function POST(request: Request, { params }: Context) {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { id } = await params;
  let body: { action?: string; publish_at?: string; notes?: string; checklist?: Record<string, boolean>; editorial_confirmation?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { data: article, error } = await service.from("journal_articles").select("*").eq("id", id).maybeSingle();
  if (error || !article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  const action = body.action;
  if (action === "create-brief") return NextResponse.json({ error: "Use the opportunity brief endpoint." }, { status: 400 });
  let next: string | undefined;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: auth.userId };
  if (action === "request-review") {
    if (article.status !== "draft" || !article.current_revision_id) return NextResponse.json({ error: "Save a draft before requesting review." }, { status: 409 });
    const { data: revision } = await service.from("journal_article_revisions").select("body_markdown").eq("id", article.current_revision_id).single();
    const [{ data: brief }, { data: sources }] = await Promise.all([
      service.from("journal_article_briefs").select("brief").eq("article_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      service.from("journal_research_sources").select("id,url,verified").eq("article_id", id),
    ]);
    const bodyText = revision?.body_markdown ?? "";
    const checks = [
      { key: "title", ok: Boolean(article.title?.trim()), label: "Descriptive title" },
      { key: "body", ok: bodyText.trim().length >= 80, label: "Article body is present" },
      { key: "keyword", ok: Boolean(article.primary_keyword?.trim()), label: "Primary keyword documented" },
      { key: "metadata", ok: Boolean(article.seo_title?.trim() && article.seo_description?.trim()), label: "SEO metadata present" },
      { key: "intent", ok: Boolean((brief?.brief as { searchIntent?: string } | undefined)?.searchIntent && (brief?.brief as { searchIntent?: string }).searchIntent !== "unknown"), label: "Search intent researched" },
      { key: "sources", ok: Boolean(sources?.some((source) => source.verified)), label: "At least one source marked verified" },
      { key: "cta", ok: Boolean(article.related_calculator_slug || article.related_tool_slug), label: "Relevant product or calculator destination" },
    ];
    const failed = checks.filter((check) => !check.ok);
    if (failed.length) return NextResponse.json({ error: "Quality review checks need attention before editorial review.", checks }, { status: 422 });
    next = "quality_review";
    update.quality_report = checks;
  } else if (action === "submit-review") {
    if (article.status !== "quality_review") return NextResponse.json({ error: "Article is not in quality review." }, { status: 409 });
    next = "awaiting_approval";
  } else if (action === "request-revision") next = "needs_revision";
  else if (action === "approve") {
    if (article.status !== "awaiting_approval" || !article.current_revision_id) return NextResponse.json({ error: "Only a complete revision awaiting approval can be approved." }, { status: 409 });
    if (!body.checklist || requiredReviewChecks.some((key) => body.checklist?.[key] !== true)) return NextResponse.json({ error: "Complete every human editorial review item before approval." }, { status: 400 });
    next = "approved";
    update.approved_revision_id = article.current_revision_id;
  } else if (action === "schedule") {
    if (article.status !== "approved" || !article.approved_revision_id) return NextResponse.json({ error: "Approve the current revision before scheduling." }, { status: 409 });
    const date = body.publish_at ? new Date(body.publish_at) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future publication date." }, { status: 400 });
    next = "scheduled";
    update.publish_at = date.toISOString();
    const { error: scheduleError } = await service.from("journal_publication_schedule").upsert({ article_id: id, revision_id: article.approved_revision_id, publish_at: date.toISOString(), created_by: auth.userId, status: "scheduled" }, { onConflict: "article_id,revision_id" });
    if (scheduleError) return NextResponse.json({ error: scheduleError.message }, { status: 500 });
  } else if (action === "publish-now") {
    const draftPublish = article.status === "draft";
    const revisionId = draftPublish ? article.current_revision_id : article.approved_revision_id;
    if (!revisionId) return NextResponse.json({ error: "Save the article before publishing." }, { status: 409 });
    if (draftPublish && body.editorial_confirmation !== true) return NextResponse.json({ error: "Confirm that you reviewed the article before publishing." }, { status: 400 });
    if (draftPublish) {
      const { data: revision, error: revisionError } = await service.from("journal_article_revisions").select("body_markdown").eq("id", revisionId).single();
      if (revisionError || !revision || revision.body_markdown.trim().length < 80) return NextResponse.json({ error: "Add the article content before publishing." }, { status: 422 });
      if (!article.title?.trim() || !article.slug?.trim() || !article.seo_title?.trim() || !article.seo_description?.trim()) return NextResponse.json({ error: "Add the title, URL slug, SEO title, and description before publishing." }, { status: 422 });
      update.approved_revision_id = revisionId;
    }
    next = "published";
    update.published_revision_id = revisionId;
    update.published_at = new Date().toISOString();
  } else if (action === "cancel-schedule") {
    if (article.status !== "scheduled") return NextResponse.json({ error: "Article is not scheduled." }, { status: 409 });
    next = "approved";
    update.publish_at = null;
    await service.from("journal_publication_schedule").update({ status: "canceled" }).eq("article_id", id).eq("status", "scheduled");
  } else if (action === "archive") next = "archived";
  const directDraftPublish = action === "publish-now" && article.status === "draft" && next === "published";
  if (!next || (!directDraftPublish && !transitions[article.status]?.includes(next))) return NextResponse.json({ error: `Transition ${article.status} → ${next ?? "?"} is not allowed.` }, { status: 409 });
  update.status = next;
  const { data: transitioned, error: updateError } = await service.from("journal_articles").update(update).eq("id", id).eq("status", article.status).select("id").maybeSingle();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!transitioned) return NextResponse.json({ error: "Article changed in another session. Reload before trying again." }, { status: 409 });
  if (action === "publish-now" && update.published_revision_id) {
    const publishedRevisionId = String(update.published_revision_id);
    await service.from("journal_publication_schedule").upsert({ article_id: id, revision_id: publishedRevisionId, publish_at: update.published_at, status: "published", created_by: auth.userId }, { onConflict: "article_id,revision_id" });
    await service.from("journal_publication_events").insert({ article_id: id, revision_id: publishedRevisionId, event_type: article.published_revision_id ? "republished" : "published", actor_id: auth.userId, source: "admin" });
    if (article.status === "draft") {
      await service.from("journal_editorial_reviews").insert({ article_id: id, revision_id: publishedRevisionId, reviewer_id: auth.userId, decision: "approved", checklist: { editorial_confirmation: true }, notes: "Editor confirmed review while publishing." });
    }
  }
  if (action === "archive" && article.published_revision_id) {
    await service.from("journal_publication_events").insert({ article_id: id, revision_id: article.published_revision_id, event_type: "archived", actor_id: auth.userId, source: "admin" });
  }
  if (article.current_revision_id && ["approve", "request-revision"].includes(action ?? "")) {
    await service.from("journal_editorial_reviews").insert({ article_id: id, revision_id: article.current_revision_id, reviewer_id: auth.userId, decision: action === "approve" ? "approved" : "requested_revision", checklist: body.checklist ?? {}, notes: body.notes ?? "" });
  }
  return NextResponse.json({ ok: true, status: next });
}
