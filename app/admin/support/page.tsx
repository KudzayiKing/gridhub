import Link from "next/link";
import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { AdminTable, mono } from "@/components/admin/admin-table";
import { adminEmails, serviceRoleConfigured } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const operators = adminEmails();

  return (
    <>
      <SectionHeading
        eyebrow="Operations"
        title="Support"
        description="There is no ticketing backend in this build. This page is a runbook, not an inbox."
      />

      <InlineAlert tone="warning" title="No support inbox exists">
        Gridhub does not ship a helpdesk integration. Do not present this page as one.
        If you need a queue, connect a real provider first; until then, requests arrive at
        the operator addresses below.
      </InlineAlert>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Operator contacts</h2>
        <div className="mt-3">
          <AdminTable
            head={["Address", "Role"]}
            caption="Operator contact addresses"
            empty="No ADMIN_EMAILS configured. Set the variable before publishing a support address."
            rows={operators.map((email) => [
              <span key="e" className="font-medium">{email}</span>,
              <span key="r" className="text-fg-muted">Operator</span>,
            ])}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">Runbook</h2>
        <div className="mt-3">
          <AdminTable
            head={["Symptom", "First check", "Reference"]}
            caption="Support runbook"
            empty="—"
            rows={[
              [
                "User cannot sign in",
                "Confirm the redirect URL is allowlisted in Supabase Auth and that the Google provider is enabled.",
                <span key="t" className="text-fg-muted">docs/GOOGLE_AUTH.md</span>,
              ],
              [
                "Checkout says unavailable",
                "A STRIPE_PRICE_* variable is missing for that plan and interval. See System.",
                <Link key="l" className="underline" href="/admin/system">System</Link>,
              ],
              [
                "Paid but tools still locked",
                "Check billing_events for the delivery, then billing_entitlements for the user.",
                <Link key="l" className="underline" href="/admin/billing">Billing events</Link>,
              ],
              [
                "Changes stuck as pending",
                "The outbox only clears on server acknowledgement. Check /api/sync and the session.",
                <span key="t" className="text-fg-muted">docs/SYNC_ENGINE.md</span>,
              ],
              [
                "Data missing after reinstall",
                "Local-first: uninstalling clears IndexedDB. Server rows only exist for records that synced.",
                <span key="t" className="text-fg-muted">docs/PWA_OFFLINE.md</span>,
              ],
            ].map(([a, b, c]) => [
              <span key="a" className="font-medium">{a}</span>,
              <span key="b" className="text-fg-muted">{b}</span>,
              c,
            ])}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[14px] font-semibold">What to collect before escalating</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-fg-muted">
          <li>The user id (first 8 characters are enough to locate the row here).</li>
          <li>The exact timestamp and time zone of the problem.</li>
          <li>Whether the user was online at the time, and what the sync indicator showed.</li>
          <li>For billing: the Stripe event id from the Billing events page.</li>
        </ul>
        <p className="mt-3 text-[12px] text-fg-subtle">
          Never ask a user for their password, a service-role key, or a Stripe secret key.
          {serviceRoleConfigured() ? " The service key is present on the server and should stay there." : " The service key is not configured in this environment."}
        </p>
        <p className="mt-2 text-[12px] text-fg-subtle">
          User ids are shown truncated on purpose — {mono("8 chars")} is enough to find a row
          without copying a full identifier into a chat log.
        </p>
      </Card>
    </>
  );
}
