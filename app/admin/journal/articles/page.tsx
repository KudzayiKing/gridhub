import { SectionHeading } from "@/components/ui/card";
import { JournalAdminNav } from "@/components/journal/journal-admin-nav";
import { ArticleList } from "@/components/journal/admin-workspace";
export const dynamic = "force-dynamic";
export default function JournalArticlesPage() { return <><SectionHeading eyebrow="Editorial CMS" title="Articles" description="Draft, review, schedule, and revise content while keeping the currently published revision live."/><JournalAdminNav/><ArticleList/></>; }
