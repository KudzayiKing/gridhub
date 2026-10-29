"use client";

import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { FAQ_GROUPS } from "@/lib/marketing/faq";
import { useI18n } from "@/lib/i18n";

export function FaqContent() {
  const { t } = useI18n();

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="FAQ"
        title="Questions, answered plainly."
        description="If something here is unclear, tell us — we would rather fix the product than write a longer FAQ."
      />

      <div className="mx-auto max-w-3xl px-4 pb-12">
        {FAQ_GROUPS.map((group) => (
          <section key={group.title} className="mb-8">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              {t(group.title)}
            </h2>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {group.items.map((item) => (
                <details key={item.q} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-medium">
                    {t(item.q)}
                    <AnimatedIcon
                      name="chevronDown"
                      size={14}
                      className="shrink-0 text-fg-subtle group-open:rotate-180"
                      trigger="none"
                    />
                  </summary>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{t(item.a)}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
