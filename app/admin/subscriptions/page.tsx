import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { AdminTable, mono, when } from "@/components/admin/admin-table";
import { tableRows, tableCount } from "@/lib/admin";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

interface SubRow {
  user_id: string;
  plan: string | null;
  status: string | null;
  interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

export default async function AdminSubscriptionsPage() {
  const [subs, entitlements] = await Promise.all([
    tableRows<SubRow>("billing_subscriptions", { limit: 100, orderBy: "created_at" }),
    tableCount("billing_entitlements"),
  ]);

  const active = subs.rows.filter((s) => s.status === "active").length;
  const pastDue = subs.rows.filter((s) => s.status === "past_due").length;
  const cancelled = subs.rows.filter((s) => s.cancel_at_period_end === true).length;

  return (
    <>
      <SectionHeading
        eyebrow="Revenue"
        title="Subscriptions"
        description="Written only by the verified Stripe webhook. If Stripe is not configured, this table stays empty by design."
      />

      {subs.error ? (
        <InlineAlert tone="warning" title="Subscriptions could not be read">
          {subs.error}
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Rows shown", value: subs.rows.length },
          { label: "Active", value: active },
          { label: "Past due", value: pastDue },
          { label: "Canceling", value: cancelled },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="eyebrow">{s.label}</p>
            <p className="tnum mt-1 text-2xl font-semibold tracking-tight">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Recent subscriptions</h2>
        <div className="mt-3">
          <AdminTable
            head={["User", "Plan", "Status", "Interval", "Renews", "Period end"]}
            caption="Recent subscriptions"
            empty={
              subs.error
                ? "Subscriptions unavailable."
                : "No subscriptions yet. Rows appear only after a real Stripe checkout completes."
            }
            rows={subs.rows.map((s) => [
              mono((s.user_id ?? "").slice(0, 8)),
              <span key="p" className="capitalize">{s.plan ?? "—"}</span>,
              <span key="s" className="capitalize text-fg-muted">{s.status ?? "—"}</span>,
              <span key="i" className="capitalize text-fg-muted">{s.interval ?? "—"}</span>,
              <span key="c" className="text-fg-muted">{s.cancel_at_period_end ? "Cancels" : "Yes"}</span>,
              when(s.current_period_end),
            ])}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Plan catalog</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Prices are the source of truth in <code className="font-mono text-[12px]">lib/plans.ts</code> and must
          match the Stripe price objects referenced by the environment.
        </p>
        <div className="mt-3">
          <AdminTable
            head={["Plan", "Tool limit", "Monthly", "Annual", "Stripe env keys"]}
            caption="Plan catalog"
            empty="No plans defined."
            rows={PLANS.map((p) => [
              <span key="n" className="font-medium">{p.name}</span>,
              <span key="l" className="tnum text-fg-muted">{p.toolLimit === 16 ? "All 16" : p.toolLimit}</span>,
              <span key="m" className="tnum">${p.monthly}</span>,
              <span key="a" className="tnum">${p.annual}</span>,
              mono(p.stripeEnv.monthly ?? "—"),
            ])}
          />
        </div>
      </Card>

      <InlineAlert tone="info" title="Entitlements">
        {entitlements.error
          ? `billing_entitlements could not be read: ${entitlements.error}`
          : `${entitlements.count ?? 0} entitlement row(s) on the server. Entitlements are what the app checks to decide which tools a user may open; they are written by the webhook and never by the client.`}
      </InlineAlert>
    </>
  );
}
