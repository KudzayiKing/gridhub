import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { AdminTable } from "@/components/admin/admin-table";
import { tableCount, adminEmails } from "@/lib/admin";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

type State = "set" | "missing";

function stateOf(name: string): State {
  return process.env[name] ? "set" : "missing";
}

function StateCell({ state }: { state: State }) {
  return (
    <span
      className={
        state === "set"
          ? "font-medium text-[var(--positive)]"
          : "font-medium text-[var(--negative)]"
      }
    >
      {state === "set" ? "Set" : "Missing"}
    </span>
  );
}

export default async function AdminSystemPage() {
  const required: { name: string; purpose: string }[] = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", purpose: "Supabase project URL (public)" },
    { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", purpose: "Supabase anon/publishable key (public)" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", purpose: "Server-only key used by admin and webhooks" },
    { name: "ENTITLEMENT_SIGNING_SECRET", purpose: "HMAC key for 7-day offline entitlement grants" },
    { name: "STRIPE_SECRET_KEY", purpose: "Stripe API access" },
    { name: "STRIPE_WEBHOOK_SECRET", purpose: "Webhook signature verification" },
    { name: "NEXT_PUBLIC_APP_URL", purpose: "Absolute URLs for checkout redirects" },
    { name: "ADMIN_EMAILS", purpose: "Comma-separated operator allowlist" },
    { name: "USDA_FOODDATA_API_KEY", purpose: "Optional nutrition food search" },
  ];

  const priceVars = PLANS.flatMap((p) =>
    [p.stripeEnv.monthly, p.stripeEnv.annual].filter((v): v is string => Boolean(v)),
  );

  // The most useful honest signal we can produce: does the schema actually exist?
  const probe = await tableCount("profiles");
  const migrationApplied = !probe.error;
  const probeLooksLikeMissingTable =
    probe.error !== null && /does not exist|schema cache|not find the table/i.test(probe.error);

  return (
    <>
      <SectionHeading
        eyebrow="Operations"
        title="System"
        description="Configuration presence and schema reachability. Values are never rendered — only whether each variable is set."
      />

      <InlineAlert
        tone={migrationApplied ? "positive" : "warning"}
        title={migrationApplied ? "Database reachable" : "Database not verified"}
      >
        {migrationApplied
          ? "A count query against public.profiles succeeded, so the connection and the schema are both in place."
          : probeLooksLikeMissingTable
            ? `The database is reachable but the schema is missing: ${probe.error}. Apply supabase/migrations/0001_init.sql.`
            : `Could not verify the schema: ${probe.error ?? "unknown error"}.`}
      </InlineAlert>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Environment</h2>
        <div className="mt-3">
          <AdminTable
            head={["Variable", "State", "Purpose"]}
            caption="Environment variable presence"
            empty="No variables checked."
            rows={required.map((v) => [
              <span key="n" className="font-mono text-[11.5px]">{v.name}</span>,
              <StateCell key="s" state={stateOf(v.name)} />,
              <span key="p" className="text-fg-muted">{v.purpose}</span>,
            ])}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Stripe price IDs</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Each paid plan needs a monthly and an annual price object. Checkout fails closed
          when one is missing rather than guessing a price.
        </p>
        <div className="mt-3">
          <AdminTable
            head={["Price variable", "State"]}
            caption="Stripe price variable presence"
            empty="No paid plans defined."
            rows={priceVars.map((name) => [
              <span key="n" className="font-mono text-[11.5px]">{name}</span>,
              <StateCell key="s" state={stateOf(name)} />,
            ])}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Runtime</h2>
        <div className="mt-3">
          <AdminTable
            head={["Item", "Value"]}
            caption="Runtime information"
            empty="—"
            rows={[
              ["Node", process.version],
              ["Environment", process.env.NODE_ENV ?? "unknown"],
              ["Admin accounts configured", String(adminEmails().length)],
              ["App URL", process.env.NEXT_PUBLIC_APP_URL ?? "not set (falls back to http://localhost:3000)"],
            ].map(([k, v]) => [
              <span key="k" className="text-fg-muted">{k}</span>,
              <span key="v" className="font-mono text-[11.5px]">{v}</span>,
            ])}
          />
        </div>
      </Card>
    </>
  );
}
