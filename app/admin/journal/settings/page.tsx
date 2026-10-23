import { SectionHeading } from "@/components/ui/card";
import { JournalAdminNav } from "@/components/journal/journal-admin-nav";
import { JournalSettingsForm } from "@/components/journal/settings-form";
export const dynamic = "force-dynamic";
export default function JournalSettingsPage() { return <><SectionHeading eyebrow="Configuration" title="Journal settings" description="Set editorial scoring weights and cadence targets. Provider activation requires explicit credentials and authorization."/><JournalAdminNav/><JournalSettingsForm providers={{ searchConsole: Boolean(process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID && process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET), googleAds: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_CUSTOMER_ID), cron: Boolean(process.env.JOURNAL_CRON_SECRET), generation: Boolean(process.env.JOURNAL_CONTENT_PROVIDER) }}/></>; }
