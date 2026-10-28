import { SectionHeading } from "@/components/ui/card";
import { JournalAdminNav } from "@/components/journal/journal-admin-nav";
import { JournalSocialWorkspace } from "@/components/journal/journal-social-workspace";

export const dynamic = "force-dynamic";

export default function JournalSocialPage() {
  return <>
    <SectionHeading eyebrow="Journal distribution" title="Social Distribution" description="Adapt approved Journal articles into channel-specific drafts, review them independently, and keep a manual publishing plan." />
    <JournalAdminNav />
    <JournalSocialWorkspace />
  </>;
}
