"use client";

import Link from "next/link";
import * as React from "react";
import { trackJournalEvent } from "@/lib/journal/analytics";
import { useI18n } from "@/lib/i18n";

type ArticleToolCtasProps = {
  articleId: string;
  calculator?: { href: string; label: string };
  tool?: { href: string; label: string };
};

export function ArticleToolCtas({ articleId, calculator, tool }: ArticleToolCtasProps) {
  const { t } = useI18n();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fitLabels = () => {
      const availableWidth = container.clientWidth;
      if (!availableWidth) return;

      container.querySelectorAll<HTMLElement>("[data-cta-label]").forEach((label) => {
        const button = label.parentElement;
        if (!button) return;
        label.style.fontSize = "14px";
        const style = window.getComputedStyle(button);
        const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
        const naturalWidth = label.scrollWidth;
        const usableWidth = Math.max(0, availableWidth - horizontalPadding);
        const fontSize = naturalWidth > usableWidth && naturalWidth > 0
          ? Math.max(8, 14 * usableWidth / naturalWidth)
          : 14;
        label.style.fontSize = `${fontSize}px`;
      });
    };

    fitLabels();
    const observer = new ResizeObserver(fitLabels);
    observer.observe(container);
    return () => observer.disconnect();
  }, [calculator?.label, tool?.label]);

  return (
    <div ref={containerRef} className="mt-4 flex flex-wrap gap-2">
      {calculator && (
        <Link
          href={calculator.href}
          onClick={() => {
            trackJournalEvent(articleId, "journal_cta_clicked");
            trackJournalEvent(articleId, "journal_calculator_opened");
          }}
          className="inline-flex w-fit min-w-0 max-w-full flex-[0_1_auto] items-center justify-center whitespace-nowrap rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] sm:px-4"
        >
          <span data-cta-label className="whitespace-nowrap">{calculator.label}</span>
        </Link>
      )}
      {tool && (
        <Link
          href={tool.href}
          onClick={() => trackJournalEvent(articleId, "journal_cta_clicked")}
          className="inline-flex w-fit min-w-0 max-w-full flex-[0_1_auto] items-center justify-center whitespace-nowrap rounded-full border border-line px-3 py-2 text-sm font-medium sm:px-4"
        >
          <span data-cta-label className="whitespace-nowrap">{t("Explore {tool}", { tool: t(tool.label) })}</span>
        </Link>
      )}
    </div>
  );
}
