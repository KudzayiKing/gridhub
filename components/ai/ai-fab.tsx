"use client";

/**
 * GridHub AI — a text-command entry point available from anywhere in the app.
 *
 * Present on every authenticated route. On a phone it sits above the bottom navigation and the
 * safe area; on desktop it sits in the bottom-right corner.
 */

import { AnimatedIcon } from "@/components/icons/animated-icon";
import { useGridhubAI } from "./ai-provider";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function GridhubAIFab() {
  const { ai } = useGridhubAI();
  const { t } = useI18n();

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-end px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:px-0">
        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => ai.openPanel()}
            aria-label={t("Ask Gridhub AI")}
            aria-haspopup="dialog"
            aria-expanded={ai.open}
            title={t("Ask Gridhub AI")}
            className={cn(
              "press group relative grid h-14 w-14 place-items-center rounded-full",
              "bg-[var(--brand)] text-[#06231a]",
              "shadow-[0_10px_30px_-8px_rgba(0,213,135,0.55),0_2px_6px_rgba(23,26,24,0.18)]",
              "transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
            )}
          >
            <AnimatedIcon name="plus" size={24} trigger="both" />
          </button>

        {/* Desktop affordance: the keyboard shortcut, shown on hover only. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-[var(--surface-strong)] px-2 py-1 text-[11px] text-fg-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100 lg:block"
        >
            {t("Ask Gridhub AI")} <kbd className="ml-1 text-fg-subtle">⌘J</kbd>
          </span>
        </div>
      </div>
    </>
  );
}
