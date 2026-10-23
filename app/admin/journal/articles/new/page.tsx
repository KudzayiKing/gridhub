import { SectionHeading } from "@/components/ui/card";
import { JournalAdminNav } from "@/components/journal/journal-admin-nav";
import { ArticleEditor } from "@/components/journal/admin-workspace";
import { getJournalCategories } from "@/lib/journal/data";
export const dynamic = "force-dynamic";
export default async function NewJournalArticlePage() { const categories = await getJournalCategories(); return <><SectionHeading eyebrow="Private draft" title="New Journal article" description="Write in safe Markdown, record authoritative sources, then run the editorial checks."/><JournalAdminNav/><ArticleEditor categories={categories}/></>; }
