import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, Prose } from "@/components/marketing/page-parts";

export const metadata: Metadata = {
  title: "Terms",
  description: "Gridhub terms of service.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <PageHeader eyebrow="Legal" title="Terms of service" description="Last updated: October 2026" />
      <Prose>
        <h2>1. The service</h2>
        <p>
          Gridhub provides subscription access to a set of web applications for personal finance, business
          management, productivity and everyday planning, delivered as a web app and installable progressive web app.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You sign in with Google. You are responsible for the security of the Google account you use and for activity
          in your workspace. One account is for one person; workspaces are private by default.
        </p>

        <h2>3. Subscriptions and tool selection</h2>
        <ul>
          <li>Plans cover a fixed number of paid tools: Single 1, Plus 3, Pro 6, Unlimited all 16.</li>
          <li>Annual plans are billed upfront for twelve months.</li>
          <li>Tool changes are permitted once per billing cycle on Single, Plus and Pro. Upgrades take effect immediately.</li>
          <li>Entitlements are determined by verified billing events, not by the browser.</li>
        </ul>

        <h2>4. Acceptable use</h2>
        <p>
          Do not attempt to access another customer&apos;s records, probe or bypass authorization, interfere with the
          service, or use it to store unlawful material. Automated scraping of other users&apos; data is prohibited.
        </p>

        <h2>5. Your data</h2>
        <p>
          You own your records. You grant us the limited right to store and process them to operate the service. You
          can export them at any time. See the privacy policy for detail.
        </p>

        <h2>6. No professional advice</h2>
        <p>
          Gridhub is not a bank, broker, accountant, tax adviser or medical professional. Calculations, forecasts and
          projections are estimates based on the data you enter. Debt payoff projections depend on assumptions and may
          differ from your lender&apos;s calculations. Nutrition tracking is a personal diary, not medical advice.
        </p>

        <h2>7. Availability</h2>
        <p>
          We aim for high availability but do not guarantee uninterrupted service. Offline support reduces the impact
          of outages for tools you have already loaded.
        </p>

        <h2>8. Liability</h2>
        <p>
          To the maximum extent permitted by law, our aggregate liability arising from the service is limited to the
          amount you paid in the twelve months preceding the claim. We are not liable for indirect or consequential
          loss.
        </p>

        <h2>9. Termination</h2>
        <p>
          You may cancel or delete your account at any time. We may suspend accounts that violate these terms or
          threaten the security of the service, and will explain why where it is lawful to do so.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update these terms. Material changes will be announced in the product before taking effect. Continued
          use after that point constitutes acceptance.
        </p>
      </Prose>
    </MarketingShell>
  );
}
