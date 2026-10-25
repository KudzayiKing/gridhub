import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { PricingTable } from "@/components/marketing/pricing-table";
import { AnimatedIcon } from "@/components/icons/animated-icon";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "GridHub pricing in USD: Free; Single $3/month or $29/year; Plus $7/$69; Pro $11/$109; Unlimited $15/$149. Paid plans include 1, 3, 6, or all 16 tools.",
  alternates: { canonical: "/pricing" },
};

const BILLING_FAQ = [
  {
    q: "How does the free plan work?",
    a: "The Annual Budget Planner is available with basic current-month budgeting, manual transactions and essential summary metrics. Data export is included.",
  },
  {
    q: "What if I need to change tools mid-cycle?",
    a: "Single, Plus and Pro allow one tool swap per billing cycle. Upgrades take effect immediately and are prorated by Stripe. Unlimited has no restrictions.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, at any time from the customer portal. Access continues to the end of the paid period, and your records remain available for export.",
  },
  {
    q: "Do you offer refunds?",
    a: "See the refund policy for the exact terms. We aim to be reasonable: if something did not work, contact us and we will make it right.",
  },
];

export default function PricingPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: BILLING_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader
        eyebrow="Pricing"
        title="Pay for the tools you actually use."
        description="No seats, no tiers hidden behind a sales call. Choose the number of tools you need and change it whenever your work changes."
      />
      <div className="mx-auto max-w-6xl px-4 pb-8">
        <PricingTable />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-xl font-semibold tracking-tight">What every plan includes</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            "Offline editing and installable PWA",
            "CSV and JSON export of your records",
            "Google sign-in and a private workspace",
            "Dark mode and reduced-motion support",
            "Data retained after cancellation",
            "The same privacy protections on every tier",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-[12.5px] text-fg-muted">
              <AnimatedIcon name="check" size={13} className="mt-0.5 text-[var(--accent)]" trigger="none" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-12">
        <h2 className="text-xl font-semibold tracking-tight">Questions about billing</h2>
        <div className="mt-3 flex flex-col divide-y divide-[var(--border)]">
          {BILLING_FAQ.map((item) => (
            <details key={item.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-medium">
                {item.q}
                <AnimatedIcon name="chevronDown" size={14} className="text-fg-subtle group-open:rotate-180" trigger="none" />
              </summary>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-fg-subtle">
          Need a specific tool explained first?{" "}
          <Link href="/tools" className="underline decoration-line-strong underline-offset-2">
            Browse all sixteen tools
          </Link>
          .
        </p>
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
