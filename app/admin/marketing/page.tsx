import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { AdminTable } from "@/components/admin/admin-table";
import { serviceRoleConfigured } from "@/lib/admin";
import { getServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface SummaryRow { event_name: string; tool_id: string; event_count: number; unique_sessions: number }

export default async function AdminMarketingPage() {
  const service = getServiceClient();
  const { data, error } = service ? await service.rpc("admin_marketing_event_summary") : { data: null, error: { message: "Service role key not configured" } };
  const rows = (data ?? []) as SummaryRow[];
  return <>
    <SectionHeading eyebrow="Growth" title="Marketing funnel" description="Anonymous public calculator visits and signup clicks from visitors who opted in. The report covers the last 90 days." />
    {!serviceRoleConfigured() || error ? <InlineAlert tone="warning" title="Marketing events unavailable">{error?.message ?? "Service role key not configured"}. Apply migration <code className="font-mono text-[12px]">0003_marketing_events.sql</code> to enable this report.</InlineAlert> : null}
    <Card className="p-4">
      <p className="mb-3 text-xs text-fg-muted">No names, account IDs, calculator inputs, or IP addresses are stored. Unique sessions are anonymous browser-session IDs.</p>
      <AdminTable head={["Calculator", "Event", "Events", "Unique sessions"]} caption="Opt-in calculator funnel events" empty={error ? "No data available until the migration is applied." : "No opted-in events recorded in the last 90 days."} rows={rows.map((row) => [<span key="tool" className="font-medium">{row.tool_id.replaceAll("-", " ")}</span>, <span key="event" className="capitalize text-fg-muted">{row.event_name.replaceAll("_", " ")}</span>, <span key="count" className="tnum">{Number(row.event_count).toLocaleString("en-GB")}</span>, <span key="sessions" className="tnum">{Number(row.unique_sessions).toLocaleString("en-GB")}</span>])} />
    </Card>
  </>;
}
