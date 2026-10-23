import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, Prose } from "@/components/marketing/page-parts";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Gridhub handles your data: what is stored, where, for how long, and how to remove it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <PageHeader eyebrow="Legal" title="Privacy policy" description="Last updated: October 2026" />
      <Prose>
        <p>
          Gridhub is designed so that your financial, business and health records are readable by you and nobody
          else. This page explains what we store, why, and what you can do about it. It is written to be understood,
          not to hide behind length.
        </p>

        <h2>1. What we collect</h2>
        <ul>
          <li><strong>Account data:</strong> your email address, display name and avatar from Google sign-in, plus a user id.</li>
          <li><strong>Workspace records:</strong> the records you create in the tools you use — transactions, invoices, guests, meals, tasks and so on.</li>
          <li><strong>Preferences:</strong> currency, locale, time zone, theme and dashboard layout.</li>
          <li><strong>Billing data:</strong> Stripe customer and subscription identifiers, plan, status and renewal date. Card details are handled by Stripe and never reach our servers.</li>
          <li><strong>Operational data:</strong> sync errors and basic request logs used to keep the service working.</li>
        </ul>

        <h2>2. What we do not collect</h2>
        <ul>
          <li>We do not send transaction descriptions, invoice contents, guest names or nutrition entries to marketing or advertising tools.</li>
          <li>We do not sell personal data.</li>
          <li>We do not use your records to train third-party models.</li>
        </ul>

        <h2>3. Where data lives</h2>
        <p>
          Records are written to your device first (IndexedDB) and synchronised to your private Supabase workspace.
          Row-level security policies restrict every row to its owning user. Billing tables are writable only by
          server-side webhook processing, never by the browser.
        </p>

        <h2>4. Processors</h2>
        <ul>
          <li><strong>Supabase</strong> — authentication, Postgres database and storage.</li>
          <li><strong>Stripe</strong> — subscription billing, invoicing and the customer portal.</li>
          <li><strong>Hosting provider</strong> — serves the application; records are not cached in shared public caches.</li>
        </ul>

        <h2>5. Retention</h2>
        <p>
          Workspace records are retained while your account exists, including after a subscription ends, so you can
          export or reactivate. Billing records are retained as required for tax and accounting. Deleting your account
          removes your workspace records and local cache.
        </p>

        <h2>6. Your rights</h2>
        <ul>
          <li>Export all of your records as JSON or per-table CSV, at any time, on any plan.</li>
          <li>Delete your account and workspace records from Settings.</li>
          <li>Request correction or a copy of your data by email.</li>
        </ul>

        <h2>7. Cookies and local storage</h2>
        <p>
          We use a session cookie for authentication and local storage for your offline records and preferences. We do
          not use advertising cookies. Analytics, where enabled, are aggregate and do not include record contents.
        </p>

        <h2>8. Children</h2>
        <p>Gridhub is not intended for children under 16 and we do not knowingly collect their data.</p>

        <h2>9. Changes and contact</h2>
        <p>
          Material changes will be announced in the product before they take effect. Privacy questions can be sent to
          the support address listed on the contact page.
        </p>
      </Prose>
    </MarketingShell>
  );
}
