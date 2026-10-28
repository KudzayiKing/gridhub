import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { MarketingShell } from "@/components/marketing/shell";
import { JournalLanding } from "@/components/journal/journal-listings";
import { getJournalCategories, getPublishedArticles } from "@/lib/journal/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "GridHub Journal — Ideas for a more organized life", description: "Practical guides to managing money, growing a business, organizing life, and getting more done.", alternates: { canonical: `${getSiteUrl()}/journal` } };
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams; const [categories, articles] = await Promise.all([getJournalCategories(), getPublishedArticles({ query: q, limit: 60 })]);
  return <MarketingShell><JournalLanding categories={categories} articles={articles} query={q}/></MarketingShell>;
}
