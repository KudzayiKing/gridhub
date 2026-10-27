"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatedTabs } from "@/components/ui/animated-tabs";

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
  return (
    <AnimatedTabs
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
      options={options}
      className={cn(
        "no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-[var(--bg-subtle)]/60 p-0.5",
        className,
      )}
      buttonClassName={cn(size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]")}
    />
  );
}
