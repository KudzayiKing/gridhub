import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { journalAdmin } from "@/lib/journal/auth";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { id } = await params;
  const [{ data: article, error }, { data: revisions }, { data: briefs }, { data: reviews }] = await Promise.all([
    service.from("journal_articles").select("*").eq("id", id).maybeSingle(),
    service.from("journal_article_revisions").select("*").eq("article_id", id).order("revision_number", { ascending: false }),
    service.from("journal_article_briefs").select("*").eq("article_id", id).order("created_at", { ascending: false }),
    service.from("journal_editorial_reviews").select("*").eq("article_id", id).order("created_at", { ascending: false }),
  ]);
  if (error || !article) return NextResponse.json({ error: error?.message ?? "Article not found" }, { status: 404 });
  return NextResponse.json({ article, revisions: revisions ?? [], briefs: briefs ?? [], reviews: reviews ?? [] });
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await journalAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service role key not configured" }, { status: 503 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { data: previous, error: loadError } = await service.from("journal_articles").select("*").eq("id", id).maybeSingle();
  if (loadError || !previous) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  if (["scheduled", "approved"].includes(previous.status)) return NextResponse.json({ error: "Cancel the schedule or move the article to revision before editing." }, { status: 409 });
  const fields = ["slug", "title", "excerpt", "category_id", "author_name", "seo_title", "seo_description", "canonical_url", "primary_keyword", "secondary_keywords", "featured_image", "featured_image_alt", "related_calculator_slug", "related_tool_slug"];
  const patch: Record<string, unknown> = { updated_by: auth.userId, updated_at: new Date().toISOString() };
  for (const field of fields) if (field in body) patch[field] = body[field];
  const metadataChanged = fields.some((field) => field in patch && JSON.stringify(patch[field]) !== JSON.stringify(previous[field]));
  if ("slug" in patch && (typeof patch.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(patch.slug) || patch.slug.length > 90)) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  if ("title" in patch && (typeof patch.title !== "string" || !patch.title.trim())) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (typeof body.body_markdown === "string") {
    const { data: latest } = await service.from("journal_article_revisions").select("id,revision_number,body_markdown").eq("article_id", id).order("revision_number", { ascending: false }).limit(1).maybeSingle();
    if (latest?.body_markdown !== body.body_markdown) {
      const revisionNo = (latest?.revision_number ?? 0) + 1;
      const { data: revision, error: revisionError } = await service.from("journal_article_revisions").insert({ article_id: id, revision_number: revisionNo, body_markdown: body.body_markdown, change_note: String(body.change_note ?? "Editorial update"), created_by: auth.userId }).select("id").single();
      if (revisionError || !revision) return NextResponse.json({ error: revisionError?.message ?? "Could not save revision" }, { status: 500 });
      patch.current_revision_id = revision.id;
      patch.approved_revision_id = null;
      patch.status = "draft";
    }
  }
  if (metadataChanged) { patch.approved_revision_id = null; patch.status = "draft"; }
  const { error } = await service.from("journal_articles").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
