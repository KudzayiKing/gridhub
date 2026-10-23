import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, Prose } from "@/components/marketing/page-parts";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "Gridhub refund and cancellation policy.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <MarketingShell>
      <PageHeader eyebrow="Legal" title="Refund policy" description="Last updated: October 2026" />
      <Prose>
        <h2>1. Canceling</h2>
        <p>
          You can cancel at any time from the billing portal. Cancellation stops future charges and access continues
          until the end of the period you have already paid for. We do not automatically prorate the remainder of a
          canceled period.
        </p>

        <h2>2. Monthly plans</h2>
        <p>
          If you are charged unexpectedly, contact us within 14 days of the charge. Where the charge was caused by our
          error, or you were prevented from using the service by a defect on our side, we will refund the affected
          period in full.
        </p>

        <h2>3. Annual plans</h2>
        <p>
          Annual subscriptions may be refunded in full within 14 days of the initial purchase, provided you have not
          made substantial use of the tools. After 14 days, refunds are considered case by case for the unused
          remainder, less any discount already applied for annual billing.
        </p>

        <h2>4. Plan changes</h2>
        <p>
          Upgrades are prorated by Stripe and charged immediately. Downgrades take effect at the end of the current
          period; no partial refund is issued for the difference unless required by law.
        </p>

        <h2>5. Failed payments</h2>
        <p>
          If a payment fails, Stripe retries and we may apply a short grace period before restricting paid tools.
          Your records are never deleted because a payment failed.
        </p>

        <h2>6. Chargebacks</h2>
        <p>
          Please contact us before raising a chargeback — most issues are resolved the same day. Accounts with an open
          chargeback may have paid tool access suspended until the dispute is resolved.
        </p>

        <h2>7. Statutory rights</h2>
        <p>
          Nothing in this policy limits rights you have under applicable consumer law, including any statutory
          cancellation right in your jurisdiction.
        </p>

        <h2>8. How to request a refund</h2>
        <p>
          Email the support address on the contact page with your account email, the charge date and the amount.
          Approved refunds are returned to the original payment method, typically within 5–10 business days.
        </p>
      </Prose>
    </MarketingShell>
  );
}
