"use client";

import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

export function AboutContent() {
  const { t } = useI18n();

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="About"
        title="Software that respects your attention."
        description="Gridhub started from a simple frustration: the tools people use to run their money, business and week are either beautiful and useless, or capable and exhausting."
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-12 text-[13.5px] leading-relaxed text-fg-muted">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-fg">{t("The idea")}</h2>
          <p className="mt-1.5">
            {t(
              "Sixteen focused applications, each doing one job properly, sharing the same records. A budget that knows about your savings goal. An invoice that feeds your cash-flow forecast. A dashboard that shows only what you actually use.",
            )}
          </p>
          <p className="mt-2">
            {t(
              "No formulas to write. No template to wrestle. No sixteen-tab spreadsheet pretending to be software.",
            )}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-fg">{t("Principles we hold to")}</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li>· {t("Accurate beats impressive. If a number cannot be trusted, it is not shown.")}</li>
            <li>· {t("Empty is a state, not a failure. Empty screens explain the next step.")}</li>
            <li>· {t("Offline is a feature, not an apology.")}</li>
            <li>· {t("Your data is yours — export is never paywalled.")}</li>
            <li>· {t("Motion is seasoning. It never blocks an action.")}</li>
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-fg">{t("What we will not claim")}</h2>
          <p className="mt-1.5">
            {t(
              "Gridhub is not a bank, a broker, a tax adviser or a medical service. Projections are estimates. Bookkeeping is a defined cash-basis model, not full GAAP accounting. Nutrition tracking is a diary, not medical advice. Where an integration requires credentials we do not have, the product says so plainly instead of pretending.",
            )}
          </p>
        </Card>
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
