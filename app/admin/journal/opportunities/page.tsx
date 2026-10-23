import { SectionHeading } from "@/components/ui/card";
import { JournalAdminNav } from "@/components/journal/journal-admin-nav";
import { OpportunityWorkbench } from "@/components/journal/admin-workspace";
export const dynamic = "force-dynamic";
export default function JournalOpportunitiesPage() { return <><SectionHeading eyebrow="Editorial pipeline" title="Keyword opportunities" description="Review source-backed search opportunities and check them against current GridHub articles before creating a brief."/><JournalAdminNav/><OpportunityWorkbench/></>; }
