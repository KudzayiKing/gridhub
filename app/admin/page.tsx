import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { StatTile, AdminTable, when } from "@/components/admin/admin-table";
import { tableCount, tableRows, serviceRoleConfigured } from "@/lib/admin";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  action: string;
  actor: string | null;
  created_at: string;
}

function fmt(count: number | null, error: string | null): string {
  if (error) return "—";
  return count === null ? "—" : count.toLocaleString("en-GB");
}

function note(error: string | null): string | undefined {
  return error ? `Unavailable: ${error}` : undefined;
}

export default async function AdminOverviewPage() {
  const [users, workspaces, activations, activeSubs, syncRecords, audits] = await Promise.all([
    tableCount("profiles"),
    tableCount("workspaces"),
    tableCount("tool_activations", { column: "active", value: true }),
    tableCount("billing_subscriptions", { column: "status", value: "active" }),
    tableCount("sync_records"),
    tableRows<AuditRow>("audit_events", { limit: 15, orderBy: "created_at" }),
  ]);

  return (
    <>
      <SectionHeading
        eyebrow="Operator"
        title="Overview"
        description="Live counts read directly from your Supabase project. Nothing on this page is simulated."
      />

      {!serviceRoleConfigured() ? (
        <InlineAlert tone="warning" title="Service role key missing">
          Counts cannot be read without <code className="font-mono text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code>.
          Every figure below will show a dash rather than a fabricated number.
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Accounts" value={fmt(users.count, users.error)} hint={note(users.error) ?? "Rows in profiles"} />
        <StatTile label="Workspaces" value={fmt(workspaces.count, workspaces.error)} hint={note(workspaces.error) ?? "Personal + business"} />
        <StatTile label="Active tool activations" value={fmt(activations.count, activations.error)} hint={note(activations.error) ?? "tool_activations where active"} />
        <StatTile label="Active subscriptions" value={fmt(activeSubs.count, activeSubs.error)} hint={note(activeSubs.error) ?? "billing_subscriptions where status = active"} />
        <StatTile label="Synced records" value={fmt(syncRecords.count, syncRecords.error)} hint={note(syncRecords.error) ?? "Server-side record mirror"} />
        <StatTile label="Audit events" value={fmt(audits.rows.length || null, audits.error)} hint={note(audits.error) ?? "Most recent 15 shown below"} />
      </div>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Recent audit events</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Written by the API routes and webhook handler, not by the browser.
        </p>
        <div className="mt-3">
          <AdminTable
            head={["Action", "Actor", "When"]}
            caption="Recent audit events"
            empty={audits.error ? `Could not read audit_events: ${audits.error}` : "No audit events recorded yet."}
            rows={audits.rows.map((row) => [
              <span key="a" className="font-medium">{row.action}</span>,
              row.actor ? (
                <span key="o" className="text-fg-muted">{row.actor}</span>
              ) : (
                <span key="o" className="text-fg-subtle">system</span>
              ),
              when(row.created_at),
            ])}
          />
        </div>
      </Card>

      <InlineAlert tone="info" title="What this page does not tell you">
        Row counts are not revenue, retention or engagement. The Countries page reports
        aggregate country-level workspace activity. Public calculator funnel counts are opt-in and
        available on the Marketing page.
      </InlineAlert>
    </>
  );
}
