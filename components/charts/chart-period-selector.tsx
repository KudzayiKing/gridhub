"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PeriodOption {
  value: string;
  label: string;
}

/**
 * Reusable period switcher used by every reporting screen. Each tool passes only the
 * options that mean something for its data — the Annual Budget shows years, Nutrition
 * shows day/week/month, Bookkeeping shows month/quarter/year. The control never fabricates
 * a range; `value` must be one of `options`.
 */
export function ChartPeriodSelector({
  options,
  value,
  onChange,
  size = "sm",
  ariaLabel = "Select period",
  className,
}: {
  options: PeriodOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}) {
  const selectedIndex = options.findIndex((o) => o.value === value);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-[var(--bg-subtle)]/60 p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "press shrink-0 whitespace-nowrap rounded-full font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-fg-muted hover:bg-[var(--surface-strong)] hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
      {/* selectedIndex kept to discourage duplicate labels; index is used by screen readers. */}
      <span className="sr-only">{selectedIndex >= 0 ? options[selectedIndex].label : ""}</span>
    </div>
  );
}
