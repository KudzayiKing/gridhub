import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { AdminTable, mono, when } from "@/components/admin/admin-table";
import { tableRows, tableCount } from "@/lib/admin";

export const dynamic = "force-dynamic";

interface EventRow {
  stripe_event_id: string;
  type: string;
  processed_at: string | null;
  error: string | null;
  created_at: string;
}

interface EntitlementRow {
  user_id: string;
  plan: string;
  status: string;
  tools: string[] | null;
  current_period_end: string | null;
}

export default async function AdminBillingPage() {
  const [events, entitlements, freeCount] = await Promise.all([
    tableRows<EventRow>("billing_events", {
      columns: "stripe_event_id,type,processed_at,error,created_at",
      limit: 50,
      orderBy: "created_at",
    }),
    tableRows<EntitlementRow>("billing_entitlements", { limit: 50, orderBy: "updated_at" }),
    tableCount("billing_entitlements", { column: "status", value: "free" }),
  ]);

  const failed = events.rows.filter((e) => Boolean(e.error));
  const unprocessed = events.rows.filter((e) => !e.processed_at);

  return (
    <>
      <SectionHeading
        eyebrow="Ledger"
        title="Billing events"
        description="Every Stripe webhook that reached this deployment. Idempotency is enforced by the primary key on stripe_event_id."
      />

      <InlineAlert tone="info" title="How to read this page">
        A row appears here only after Stripe actually delivers a webhook and the signature
        verifies. An empty table means no event has ever arrived — it does not mean the
        integration works.
      </InlineAlert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Events shown", value: events.rows.length },
          { label: "Unprocessed", value: unprocessed.length },
          { label: "Errored", value: failed.length },
          { label: "Free entitlements", value: freeCount.error ? null : freeCount.count },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="eyebrow">{s.label}</p>
            <p className="tnum mt-1 text-2xl font-semibold tracking-tight">
              {s.value === null ? "—" : s.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Recent webhook deliveries</h2>
        <div className="mt-3">
          <AdminTable
            head={["Event id", "Type", "Processed", "Error", "Received"]}
            caption="Recent webhook deliveries"
            empty={
              events.error
                ? `Could not read billing_events: ${events.error}`
                : "No webhook deliveries recorded. Configure Stripe and run a test-mode checkout to populate this."
            }
            rows={events.rows.map((e) => [
              mono(e.stripe_event_id.slice(0, 20)),
              <span key="t" className="font-medium">{e.type}</span>,
              when(e.processed_at),
              e.error ? (
                <span key="e" className="text-[var(--negative)]">{e.error.slice(0, 60)}</span>
              ) : (
                <span key="e" className="text-fg-subtle">—</span>
              ),
              when(e.created_at),
            ])}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Entitlements</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          The authoritative record of which tools each account may open. Written by the
          webhook only; the client can read but never write it.
        </p>
        <div className="mt-3">
          <AdminTable
            head={["User", "Plan", "Status", "Tools", "Period end"]}
            caption="Entitlements"
            empty={
              entitlements.error
                ? `Could not read billing_entitlements: ${entitlements.error}`
                : "No entitlements yet. The new-user trigger creates one free row per account."
            }
            rows={entitlements.rows.map((e) => [
              mono(e.user_id.slice(0, 8)),
              <span key="p" className="capitalize">{e.plan}</span>,
              <span key="s" className="capitalize text-fg-muted">{e.status}</span>,
              <span key="t" className="text-fg-muted">
                {e.tools && e.tools.length > 0 ? e.tools.join(", ") : "—"}
              </span>,
              when(e.current_period_end),
            ])}
          />
        </div>
      </Card>
    </>
  );
}
