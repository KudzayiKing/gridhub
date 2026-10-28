"use client";

import Link from "next/link";
import { trackJournalEvent } from "@/lib/journal/analytics";
import { useI18n } from "@/lib/i18n";

type ArticleToolCtasProps = {
  articleId: string;
  calculator?: { href: string; label: string };
  tool?: { href: string; label: string };
};

export function ArticleToolCtas({ articleId, calculator, tool }: ArticleToolCtasProps) {
  const { t } = useI18n();
  return (
    <div className="mt-4 flex flex-wrap gap-2 [container-type:inline-size]">
      {calculator && (
        <Link
          href={calculator.href}
          onClick={() => {
            trackJournalEvent(articleId, "journal_cta_clicked");
            trackJournalEvent(articleId, "journal_calculator_opened");
          }}
          className="inline-flex min-w-0 max-w-full flex-[0_1_auto] items-center justify-center whitespace-nowrap rounded-full bg-[var(--accent)] px-3 py-2 text-[clamp(0.5rem,4cqw,0.875rem)] font-semibold text-[var(--accent-fg)] sm:px-4"
        >
          {calculator.label}
        </Link>
      )}
      {tool && (
        <Link
          href={tool.href}
          onClick={() => trackJournalEvent(articleId, "journal_cta_clicked")}
          className="inline-flex min-w-0 max-w-full flex-[0_1_auto] items-center justify-center whitespace-nowrap rounded-full border border-line px-3 py-2 text-[clamp(0.5rem,4cqw,0.875rem)] font-medium sm:px-4"
        >
          {t("Explore {tool}", { tool: t(tool.label) })}
        </Link>
      )}
    </div>
  );
}
