import { NextResponse } from "next/server";
import { createSocialDrafts, type SocialPlatform } from "@/lib/journal/social";
import { journalAdmin } from "@/lib/journal/auth";
import { getServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const platforms = new Set<SocialPlatform>(["linkedin", "x", "instagram", "youtube_shorts"]);

export async function GET() {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const [{ data: articles, error: articlesError }, { data: posts, error: postsError }] = await Promise.all([
    service.from("journal_articles").select("id,slug,title,excerpt,status,approved_revision_id,published_revision_id,published_at,publish_at,current_revision_id,related_calculator_slug,updated_at,journal_categories(name)").in("status", ["approved", "scheduled", "published"]).order("updated_at", { ascending: false }).limit(300),
    service.from("journal_social_posts").select("*").order("updated_at", { ascending: false }).limit(300),
  ]);
  if (articlesError) return NextResponse.json({ error: articlesError.message }, { status: 500 });
  if (postsError) return NextResponse.json({ error: `Social Distribution database is not ready. Apply migration 0007_journal_social_distribution.sql. ${postsError.message}` }, { status: 503 });
  const eligible = (articles ?? []).filter((article) => article.status === "published" ? Boolean(article.published_revision_id) : Boolean(article.approved_revision_id));
  const postIds = (posts ?? []).map((post) => post.id);
  const [{ data: revisions, error: revisionsError }, { data: approvals, error: approvalsError }] = postIds.length ? await Promise.all([
    service.from("journal_social_post_revisions").select("*").in("social_post_id", postIds).order("revision_number", { ascending: false }),
    service.from("journal_social_approvals").select("*").in("social_post_id", postIds).order("created_at", { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (revisionsError || approvalsError) return NextResponse.json({ error: revisionsError?.message ?? approvalsError?.message }, { status: 500 });
  return NextResponse.json({ articles: eligible, posts: posts ?? [], revisions: revisions ?? [], approvals: approvals ?? [],
    integrations: { generation: "manual_template", publishing: "not_configured", analytics: "not_configured" } });
}

export async function POST(request: Request) {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  let body: { article_id?: unknown; platforms?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.article_id !== "string" || !Array.isArray(body.platforms) || body.platforms.length === 0 || body.platforms.some((value) => !platforms.has(value as SocialPlatform))) {
    return NextResponse.json({ error: "Choose an approved or published article and at least one supported platform." }, { status: 400 });
  }
  const { data: article, error: articleError } = await service.from("journal_articles").select("id,slug,title,excerpt,status,approved_revision_id,published_revision_id,related_calculator_slug").eq("id", body.article_id).maybeSingle();
  if (articleError || !article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  const sourceRevisionId = article.status === "published" ? article.published_revision_id : ["approved", "scheduled"].includes(article.status) ? article.approved_revision_id : null;
  if (!sourceRevisionId) return NextResponse.json({ error: "Only an approved or published article revision can be used." }, { status: 409 });
  const { data: sourceRevision, error: sourceError } = await service.from("journal_article_revisions").select("id,article_id,body_markdown").eq("id", sourceRevisionId).eq("article_id", article.id).maybeSingle();
  if (sourceError || !sourceRevision) return NextResponse.json({ error: "The approved article revision could not be loaded." }, { status: 409 });
  const chosen = [...new Set(body.platforms as SocialPlatform[])];
  const { data: existingPosts, error: existingError } = await service.from("journal_social_posts").select("platform").eq("source_article_id", article.id).eq("source_article_revision_id", sourceRevisionId).in("platform", chosen);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existingPosts?.length) return NextResponse.json({ error: `Drafts already exist for: ${existingPosts.map((item) => item.platform).join(", ")}. Open the saved drafts to edit them.` }, { status: 409 });
  const drafts = createSocialDrafts({ ...article, body_markdown: sourceRevision.body_markdown }, chosen);
  const created: string[] = [];
  for (const draft of drafts) {
    const { data: post, error: insertError } = await service.from("journal_social_posts").insert({
      source_article_id: article.id, source_article_revision_id: sourceRevisionId, platform: draft.platform,
      format: draft.format, status: "draft", created_by: auth.userId, updated_by: auth.userId,
    }).select("id").single();
    if (insertError || !post) return NextResponse.json({ error: insertError?.message ?? "Could not create social draft", created }, { status: 500 });
    const { data: revision, error: revisionError } = await service.from("journal_social_post_revisions").insert({
      social_post_id: post.id, revision_number: 1, title: draft.title, body: draft.body,
      cta_url: draft.ctaUrl, creative_brief: draft.creativeBrief, change_note: "Initial platform adaptation from approved Journal revision", created_by: auth.userId,
    }).select("id").single();
    if (revisionError || !revision) return NextResponse.json({ error: revisionError?.message ?? "Could not save social draft revision", created }, { status: 500 });
    const { error: linkError } = await service.from("journal_social_posts").update({ current_revision_id: revision.id, updated_by: auth.userId }).eq("id", post.id);
    if (linkError) return NextResponse.json({ error: linkError.message, created }, { status: 500 });
    created.push(post.id);
  }
  return NextResponse.json({ ok: true, created }, { status: 201 });
}
