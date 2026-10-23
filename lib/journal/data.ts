import { getServiceClient } from "@/lib/supabase/admin";
import type { JournalArticle, JournalCategory } from "./types";

export async function getJournalCategories(): Promise<JournalCategory[]> {
  const service = getServiceClient();
  if (!service) return [];
  const { data } = await service.from("journal_categories").select("id,slug,name,description,sort_order").order("sort_order");
  return (data ?? []) as JournalCategory[];
}

export async function getPublishedArticles(options: { category?: string; query?: string; limit?: number } = {}): Promise<JournalArticle[]> {
  const service = getServiceClient();
  if (!service) return [];
  const categoryJoin = options.category ? "journal_categories!inner(id,slug,name,description,sort_order)" : "journal_categories(id,slug,name,description,sort_order)";
  let request = service.from("journal_articles")
    .select(`id,slug,title,excerpt,category_id,author_name,status,published_revision_id,published_at,updated_at,seo_title,seo_description,canonical_url,primary_keyword,secondary_keywords,featured_image,featured_image_alt,related_calculator_slug,related_tool_slug,${categoryJoin}`)
    .not("published_revision_id", "is", null)
    .neq("status", "archived")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(options.limit ?? 100);
  if (options.category) request = request.eq("journal_categories.slug", options.category);
  if (options.query) {
    const safe = options.query.replace(/[(),%]/g, " ").trim();
    if (safe) request = request.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%,primary_keyword.ilike.%${safe}%`);
  }
  const { data } = await request;
  const articleRows = data ?? [];
  const revisionIds = articleRows.map((row) => (row as { published_revision_id?: string }).published_revision_id).filter((value): value is string => Boolean(value));
  const { data: revisions } = revisionIds.length ? await service.from("journal_article_revisions").select("id,article_id,revision_number,body_markdown,change_note,created_at").in("id", revisionIds) : { data: [] };
  const byRevision = new Map((revisions ?? []).map((revision) => [revision.id, revision]));
  return articleRows.map((row) => {
    const item = row as unknown as JournalArticle & { journal_categories?: JournalCategory };
    return { ...item, category: item.journal_categories, revision: byRevision.get(item.published_revision_id ?? "") } as JournalArticle;
  });
}

export async function getPublishedArticle(slug: string): Promise<JournalArticle | null> {
  const service = getServiceClient();
  if (!service) return null;
  const { data, error } = await service.from("journal_articles")
    .select("id,slug,title,excerpt,category_id,author_name,status,published_revision_id,published_at,updated_at,seo_title,seo_description,canonical_url,primary_keyword,secondary_keywords,featured_image,featured_image_alt,related_calculator_slug,related_tool_slug,journal_categories(id,slug,name,description,sort_order)")
    .eq("slug", slug).not("published_revision_id", "is", null).neq("status", "archived").not("published_at", "is", null).lte("published_at", new Date().toISOString()).maybeSingle();
  if (error || !data) return null;
  const item = data as unknown as JournalArticle & { journal_categories?: JournalCategory };
  const { data: revision } = await service.from("journal_article_revisions").select("id,article_id,revision_number,body_markdown,change_note,created_at").eq("id", item.published_revision_id).eq("article_id", item.id).maybeSingle();
  if (!revision) return null;
  return { ...item, category: item.journal_categories, revision } as JournalArticle;
}

export function readingMinutes(markdown: string): number {
  const words = markdown.replace(/[#>*_`\[\]()!-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
