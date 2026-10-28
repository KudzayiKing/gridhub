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
    <div className="mt-4 flex flex-wrap gap-2">
      {calculator && (
        <Link
          href={calculator.href}
          onClick={() => {
            trackJournalEvent(articleId, "journal_cta_clicked");
            trackJournalEvent(articleId, "journal_calculator_opened");
          }}
          className="max-w-full whitespace-nowrap rounded-full bg-[var(--accent)] px-3 py-2 text-[clamp(0.625rem,3.1vw,0.875rem)] font-semibold text-[var(--accent-fg)] sm:px-4"
        >
          {calculator.label}
        </Link>
      )}
      {tool && (
        <Link
          href={tool.href}
          onClick={() => trackJournalEvent(articleId, "journal_cta_clicked")}
          className="max-w-full whitespace-nowrap rounded-full border border-line px-3 py-2 text-[clamp(0.625rem,3.1vw,0.875rem)] font-medium sm:px-4"
        >
          {t("Explore {tool}", { tool: t(tool.label) })}
        </Link>
      )}
    </div>
  );
}
