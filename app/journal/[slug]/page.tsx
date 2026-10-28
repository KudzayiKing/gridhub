import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/shell";
import { LocalizedArticle } from "@/components/journal/localized-article";
import { JournalCategoryListing, RelatedGuides } from "@/components/journal/journal-listings";
import { getJournalCategories, getPublishedArticle, getPublishedArticles } from "@/lib/journal/data";
import { FREE_TOOLS } from "@/lib/free-tool-catalog";
import { TOOL_MAP } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params; const article = await getPublishedArticle(slug);
  if (!article) { const category = (await getJournalCategories()).find((item) => item.slug === slug); if (category) return { title: `${category.name} Guides | GridHub Journal`, description: category.description, alternates: { canonical: `${getSiteUrl()}/journal/${category.slug}` } }; }
  if (!article) return { title: "GridHub Journal" };
  return { title: article.seo_title || article.title, description: article.seo_description || article.excerpt, alternates: { canonical: article.canonical_url || `${getSiteUrl()}/journal/${article.slug}` }, openGraph: { type: "article", title: article.seo_title || article.title, description: article.seo_description || article.excerpt, publishedTime: article.published_at ?? undefined, modifiedTime: article.updated_at } };
}

export default async function JournalSlugPage({ params }: Params) {
  const { slug } = await params; const categories = await getJournalCategories(); const category = categories.find((item) => item.slug === slug);
  if (category) {
    const articles = await getPublishedArticles({ category: slug });
    return <MarketingShell><JournalCategoryListing category={category} articles={articles}/></MarketingShell>;
  }
  const article = await getPublishedArticle(slug); if (!article?.revision) notFound();
  const [, nearby] = await Promise.all([getPublishedArticles({ limit: 100 }), getPublishedArticles({ category: article.category?.slug, limit: 5 })]);
  const related = nearby.filter((item) => item.id !== article.id).slice(0, 3);
  const calculator = article.related_calculator_slug ? FREE_TOOLS.find((tool) => tool.id === article.related_calculator_slug) : undefined;
  const gridhubTool = article.related_tool_slug ? Object.values(TOOL_MAP).find((tool) => tool.id === article.related_tool_slug) : undefined;
  const publishedAt = article.published_at ? new Date(article.published_at) : new Date(article.revision.created_at);
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.seo_description || article.excerpt, datePublished: publishedAt.toISOString(), dateModified: new Date(article.updated_at).toISOString(), author: { "@type": "Organization", name: article.author_name }, publisher: { "@type": "Organization", name: "GridHub", url: getSiteUrl() }, mainEntityOfPage: article.canonical_url || `${getSiteUrl()}/journal/${article.slug}`, ...(article.featured_image ? { image: [article.featured_image] } : {}) };
  return <MarketingShell><article className="mx-auto max-w-6xl px-4 pb-16 pt-8"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}/>{article.featured_image && <figure className="mx-auto mt-8 max-w-5xl"><img className="max-h-[480px] w-full rounded-3xl border border-line object-cover" src={article.featured_image} alt={article.featured_image_alt} fetchPriority="high"/></figure>}<LocalizedArticle articleId={article.id} revisionId={article.published_revision_id ?? article.revision.id} slug={article.slug} title={article.title} excerpt={article.excerpt} category={article.category ? { name: article.category.name, slug: article.category.slug } : null} authorName={article.author_name} publishedAt={publishedAt.toISOString()} updatedAt={article.updated_at} bodyMarkdown={article.revision.body_markdown} calculator={calculator ? { href: `/free-tools/${calculator.id}`, label: calculator.cta } : undefined} tool={gridhubTool ? { href: gridhubTool.route, label: gridhubTool.shortName } : undefined}/>{related.length > 0 && <RelatedGuides articles={related}/>}</article></MarketingShell>;
}
