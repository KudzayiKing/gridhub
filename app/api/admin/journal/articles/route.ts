import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { journalAdmin } from "@/lib/journal/auth";

export const dynamic = "force-dynamic";
const slugOk = (slug: unknown): slug is string => typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 90;

export async function GET() {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { data, error } = await service.from("journal_articles").select("*,journal_categories(name,slug)").order("updated_at", { ascending: false }).limit(300);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ articles: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!slugOk(body.slug) || typeof body.title !== "string" || !body.title.trim() || typeof body.category_id !== "string") return NextResponse.json({ error: "Title, valid slug, and category are required" }, { status: 400 });
  const { data: article, error } = await service.from("journal_articles").insert({
    slug: body.slug, title: body.title.trim(), excerpt: String(body.excerpt ?? ""), category_id: body.category_id,
    author_name: String(body.author_name ?? "GridHub Editorial"), status: "draft", seo_title: String(body.seo_title ?? body.title),
    seo_description: String(body.seo_description ?? body.excerpt ?? ""), primary_keyword: String(body.primary_keyword ?? ""),
    secondary_keywords: Array.isArray(body.secondary_keywords) ? body.secondary_keywords.map(String) : [],
    related_calculator_slug: body.related_calculator_slug ? String(body.related_calculator_slug) : null,
    related_tool_slug: body.related_tool_slug ? String(body.related_tool_slug) : null, created_by: auth.userId, updated_by: auth.userId,
  }).select("id").single();
  if (error || !article) return NextResponse.json({ error: error?.message ?? "Could not create article" }, { status: 400 });
  const { data: revision, error: revisionError } = await service.from("journal_article_revisions").insert({ article_id: article.id, revision_number: 1, body_markdown: String(body.body_markdown ?? ""), change_note: "Initial draft", created_by: auth.userId }).select("id").single();
  if (revisionError || !revision) return NextResponse.json({ error: revisionError?.message ?? "Could not create initial revision", id: article.id }, { status: 500 });
  const { error: attachError } = await service.from("journal_articles").update({ current_revision_id: revision.id }).eq("id", article.id);
  if (attachError) return NextResponse.json({ error: attachError.message, id: article.id }, { status: 500 });
  return NextResponse.json({ id: article.id }, { status: 201 });
}
