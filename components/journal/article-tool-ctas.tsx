"use client";

import Link from "next/link";
import { trackJournalEvent } from "@/lib/journal/analytics";

type ArticleToolCtasProps = {
  articleId: string;
  calculator?: { href: string; label: string };
  tool?: { href: string; label: string };
};

export function ArticleToolCtas({ articleId, calculator, tool }: ArticleToolCtasProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {calculator && (
        <Link
          href={calculator.href}
          onClick={() => {
            trackJournalEvent(articleId, "journal_cta_clicked");
            trackJournalEvent(articleId, "journal_calculator_opened");
          }}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
        >
          {calculator.label}
        </Link>
      )}
      {tool && (
        <Link
          href={tool.href}
          onClick={() => trackJournalEvent(articleId, "journal_cta_clicked")}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium"
        >
          Explore {tool.label}
        </Link>
      )}
    </div>
  );
}
