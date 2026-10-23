import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About",
  description: "Why Gridhub exists, and the principles behind it.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="About"
        title="Software that respects your attention."
        description="Gridhub started from a simple frustration: the tools people use to run their money, business and week are either beautiful and useless, or capable and exhausting."
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-12 text-[13.5px] leading-relaxed text-fg-muted">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-fg">The idea</h2>
          <p className="mt-1.5">
            Sixteen focused applications, each doing one job properly, sharing the same records. A budget that knows
            about your savings goal. An invoice that feeds your cash-flow forecast. A dashboard that shows only what
            you actually use.
          </p>
          <p className="mt-2">
            No formulas to write. No template to wrestle. No sixteen-tab spreadsheet pretending to be software.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-fg">Principles we hold to</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li>· Accurate beats impressive. If a number cannot be trusted, it is not shown.</li>
            <li>· Empty is a state, not a failure. Empty screens explain the next step.</li>
            <li>· Offline is a feature, not an apology.</li>
            <li>· Your data is yours — export is never paywalled.</li>
            <li>· Motion is seasoning. It never blocks an action.</li>
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-fg">What we will not claim</h2>
          <p className="mt-1.5">
            Gridhub is not a bank, a broker, a tax adviser or a medical service. Projections are estimates.
            Bookkeeping is a defined cash-basis model, not full GAAP accounting. Nutrition tracking is a diary, not
            medical advice. Where an integration requires credentials we do not have, the product says so plainly
            instead of pretending.
          </p>
        </Card>
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
