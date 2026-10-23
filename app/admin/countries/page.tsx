import { AdminTable, StatTile, when } from "@/components/admin/admin-table";
import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { countryActivitySummary, serviceRoleConfigured } from "@/lib/admin";

export const dynamic = "force-dynamic";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string) {
  return countryNames.of(code) ?? code;
}

export default async function AdminCountriesPage() {
  const activity = await countryActivitySummary();
  const totalVisitDays = activity.rows.reduce((sum, row) => sum + Number(row.visit_days), 0);
  const trackedCountryAccounts = activity.rows.reduce((sum, row) => sum + Number(row.account_count), 0);

  return (
    <>
      <SectionHeading
        eyebrow="Audience"
        title="Countries"
        description="A country-level view of signed-in workspace activity, aggregated for market planning."
      />

      {!serviceRoleConfigured() ? (
        <InlineAlert tone="warning" title="Service role key missing">
          Country activity requires <code className="font-mono text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code> on the server.
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Countries" value={String(activity.rows.length)} hint="Countries with recorded activity" />
        <StatTile label="Account-country pairs" value={trackedCountryAccounts.toLocaleString("en-GB")} hint="Accounts counted once per country" />
        <StatTile label="Visit-days" value={totalVisitDays.toLocaleString("en-GB")} hint="At most one per account, country and UTC day" />
      </div>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Activity by country</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Country comes from the hosting provider. This report contains aggregate counts only.
        </p>
        <div className="mt-3">
          <AdminTable
            head={["Country", "Code", "Accounts", "Visit-days", "Last activity"]}
            caption="Signed-in workspace activity by country"
            empty={activity.error ? `Could not read country activity: ${activity.error}` : "No country activity recorded yet."}
            rows={activity.rows.map((row) => [
              <span key="name" className="font-medium">{countryName(row.country_code)}</span>,
              <span key="code" className="font-mono text-[11.5px] text-fg-muted">{row.country_code}</span>,
              Number(row.account_count).toLocaleString("en-GB"),
              Number(row.visit_days).toLocaleString("en-GB"),
              when(row.last_seen_at),
            ])}
          />
        </div>
      </Card>

      <InlineAlert tone="info" title="How this is measured">
        The app reads a country code supplied by the hosting provider when a signed-in user opens the workspace.
        It stores no IP address or precise location. Activity is deduplicated once per account, country and UTC day.
        If the host does not supply a country header, that visit is not included.
      </InlineAlert>
    </>
  );
}
