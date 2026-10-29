"use client";

import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { PricingTable } from "@/components/marketing/pricing-table";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { BILLING_FAQ, PLAN_INCLUDES } from "@/lib/marketing/faq";
import { useI18n } from "@/lib/i18n";

export function PricingContent() {
  const { t } = useI18n();

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Pricing"
        title="Pay for the tools you actually use."
        description="No seats, no tiers hidden behind a sales call. Choose the number of tools you need and change it whenever your work changes."
      />
      <div className="mx-auto max-w-6xl px-4 pb-8">
        <PricingTable />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-xl font-semibold tracking-tight">{t("What every plan includes")}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PLAN_INCLUDES.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[12.5px] text-fg-muted">
              <AnimatedIcon
                name="check"
                size={13}
                className="mt-0.5 text-[var(--accent)]"
                trigger="none"
              />
              {t(item)}
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-12">
        <h2 className="text-xl font-semibold tracking-tight">{t("Questions about billing")}</h2>
        <div className="mt-3 flex flex-col divide-y divide-[var(--border)]">
          {BILLING_FAQ.map((item) => (
            <details key={item.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-medium">
                {t(item.q)}
                <AnimatedIcon
                  name="chevronDown"
                  size={14}
                  className="text-fg-subtle group-open:rotate-180"
                  trigger="none"
                />
              </summary>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{t(item.a)}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-fg-subtle">
          {t("Need a specific tool explained first?")}{" "}
          <Link href="/tools" className="underline decoration-line-strong underline-offset-2">
            {t("Browse all sixteen tools")}
          </Link>
          .
        </p>
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
