import { SectionHeading } from "@/components/ui/card";
import { JournalAdminNav } from "@/components/journal/journal-admin-nav";
import { ArticleEditor } from "@/components/journal/admin-workspace";
import { getJournalCategories } from "@/lib/journal/data";
export const dynamic = "force-dynamic";
export default async function EditJournalArticlePage({ params }: { params: Promise<{ id: string }> }) { const [{ id }, categories] = await Promise.all([params, getJournalCategories()]); return <><SectionHeading eyebrow="Revision controlled" title="Edit Journal article" description="Every saved body becomes a separate revision. Approval applies to one specific revision."/><JournalAdminNav/><ArticleEditor articleId={id} categories={categories}/></>; }
