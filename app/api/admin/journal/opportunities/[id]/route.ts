import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { journalAdmin } from "@/lib/journal/auth";
import { findKeywordOverlap } from "@/lib/journal/scoring";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { id } = await params;
  let body: { action?: string; proposed_angle?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { data: opportunity } = await service.from("journal_keyword_opportunities").select("*,journal_keywords(*)").eq("id", id).maybeSingle();
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  if (body.action === "reject") {
    const { error } = await service.from("journal_keyword_opportunities").update({ status: "rejected" }).eq("id", id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (body.action === "update-existing") {
    const { error } = await service.from("journal_keyword_opportunities").update({ status: "update_existing" }).eq("id", id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (body.action !== "approve-and-brief") return NextResponse.json({ error: "Choose approve-and-brief, update-existing, or reject." }, { status: 400 });
  const { data: existingBrief } = await service.from("journal_article_briefs").select("article_id").eq("keyword_id", opportunity.keyword_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existingBrief?.article_id) {
    await service.from("journal_keyword_opportunities").update({ status: "approved" }).eq("id", id);
    return NextResponse.json({ ok: true, articleId: existingBrief.article_id, duplicate: true });
  }
  const keyword = opportunity.journal_keywords as { keyword: string; proposed_title: string; search_intent: string; related_keywords: string[]; country: string; language: string; category_slug?: string; gridhub_tool?: string; free_calculator?: string; unique_value?: string };
  const [{ data: articles }, { data: metrics }, { data: sources }] = await Promise.all([
    service.from("journal_articles").select("slug,title,primary_keyword"),
    service.from("journal_keyword_metrics").select("*").eq("keyword_id", opportunity.keyword_id).order("created_at", { ascending: false }).limit(1),
    service.from("journal_research_sources").select("title,url,publisher,published_at,accessed_at,notes,verified").eq("keyword_id", opportunity.keyword_id),
  ]);
  const overlap = findKeywordOverlap(keyword.keyword, articles ?? []);
  if (overlap.length) {
    await service.from("journal_keyword_opportunities").update({ status: "update_existing", cannibalization_report: overlap }).eq("id", id);
    return NextResponse.json({ error: "Similar GridHub articles already exist. Review the cannibalization report and choose an existing article to update instead.", overlaps: overlap }, { status: 409 });
  }
  const category = keyword.category_slug;
  if (!category) return NextResponse.json({ error: "Assign a GridHub category to this keyword before creating its brief." }, { status: 400 });
  const { data: categoryRow } = await service.from("journal_categories").select("id").eq("slug", category).single();
  const title = keyword.proposed_title || `A practical guide to ${keyword.keyword}`;
  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 86) || `guide-${opportunity.id.slice(0, 8)}`;
  const draftArticle = { slug, title, excerpt: `Editorial brief for ${keyword.keyword}. This page is private until approved and published.`, category_id: categoryRow?.id, primary_keyword: keyword.keyword, secondary_keywords: keyword.related_keywords, related_calculator_slug: keyword.free_calculator, related_tool_slug: keyword.gridhub_tool, status: "brief_ready", seo_title: title, seo_description: `A practical, research-led guide to ${keyword.keyword}.`, created_by: auth.userId, updated_by: auth.userId };
  const { data: existingArticle } = await service.from("journal_articles").select("id").eq("slug", slug).maybeSingle();
  const { data: article, error: articleError } = existingArticle
    ? { data: existingArticle, error: null }
    : await service.from("journal_articles").insert(draftArticle).select("id").single();
  if (articleError || !article) return NextResponse.json({ error: articleError?.message ?? "Could not create article brief" }, { status: 400 });
  const metric = metrics?.[0] ?? null;
  const brief = {
    proposedTitle: title, primaryKeyword: keyword.keyword, secondaryKeywords: keyword.related_keywords ?? [], searchIntent: keyword.search_intent || "unknown",
    country: keyword.country, language: keyword.language, searchVolume: metric?.monthly_search_volume ?? null,
    volumeSource: metric?.volume_source ?? "unverified", volumeObservedAt: metric?.volume_observed_at ?? null,
    targetAudience: "To be defined by editor", coreProblem: "To be confirmed from user questions and authoritative research",
    angle: body.proposed_angle ?? keyword.unique_value ?? "Address the query with actionable guidance, show a worked example, and link a relevant GridHub tool where appropriate.",
    questionsToAnswer: [], proposedHeadings: ["Introduction", "What to know first", "A step-by-step approach", "Worked example", "Common mistakes", "Next steps"],
    sources: sources ?? [], factsToVerify: ["Validate search intent against current search results", "Verify consequential claims against authoritative sources", "Check all calculations and jurisdiction-specific details"],
    relatedCalculator: keyword.free_calculator ?? null, relatedTool: keyword.gridhub_tool ?? null, internalLinks: [], cannibalization: overlap,
    editorialRisks: ["Do not publish until sources and claims have been verified by an editor."],
    metadata: { title, description: `A practical, research-led guide to ${keyword.keyword}.`, verifiedSearchVolume: metric?.monthly_search_volume ?? null },
    sourcesUnavailable: !(sources?.length), createdAt: new Date().toISOString(),
  };
  const { error: briefError } = await service.from("journal_article_briefs").insert({ article_id: article.id, keyword_id: opportunity.keyword_id, brief, created_by: auth.userId });
  if (briefError) return NextResponse.json({ error: briefError.message, articleId: article.id }, { status: 500 });
  await service.from("journal_keyword_opportunities").update({ status: "approved", proposed_angle: body.proposed_angle ?? "" }).eq("id", id);
  await service.from("journal_keywords").update({ status: "briefed" }).eq("id", opportunity.keyword_id);
  return NextResponse.json({ ok: true, articleId: article.id });
}
