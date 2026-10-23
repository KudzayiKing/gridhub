"use client";

/**
 * Universal, per-tool reporting period control (spec #3).
 *
 * Every reporting screen shares the same idea — pick a window and everything (KPI cards, bars,
 * donuts, trends, tables) updates to match. This hook owns the *persisted* selection so a user's
 * preferred year/month survives reloads, and exposes the same `PeriodOption` shape the
 * `ChartPeriodSelector` component renders. The selection is stored on `UserPreferences.periods`
 * keyed by tool id, so it never collides with other tools and reconciles with the server like any
 * other preference.
 *
 * The hook is intentionally dumb about *what* each option means — the tool decides (a budget shows
 * years, nutrition shows day/week/month). It only guarantees the stored value is one of the offered
 * options and falls back to a sensible default when nothing is stored yet.
 */

import * as React from "react";
import { usePrefs } from "@/components/providers";
import type { ToolId } from "@/lib/catalog";

export interface PeriodOption {
  value: string;
  label: string;
}

export interface ToolPeriod {
  value: string;
  setValue: (value: string) => void;
  options: PeriodOption[];
}

export function useToolPeriod(
  toolId: ToolId,
  options: PeriodOption[],
  defaultValue: string,
): ToolPeriod {
  const { prefs, setPrefs } = usePrefs();

  const stored = prefs.periods?.[toolId];
  const value =
    stored && options.some((o) => o.value === stored) ? stored : defaultValue;

  const setValue = React.useCallback(
    (next: string) => {
      if (!options.some((o) => o.value === next)) return; // never adopt an invalid period
      void setPrefs({ periods: { ...(prefs.periods ?? {}), [toolId]: next } });
    },
    [options, prefs, setPrefs, toolId],
  );

  return { value, setValue, options };
}

/**
 * Build the standard year list for a period selector. Always includes the current year and every
 * year that actually has records, sorted descending, capped at `max`. Future years with no data are
 * excluded so the control never implies a projection the user did not author.
 */
export function yearOptions(
  recordDates: Array<string | undefined | null>,
  max = 6,
): PeriodOption[] {
  const current = new Date().getFullYear();
  const seen = new Set<number>([current]);
  for (const d of recordDates) {
    if (!d) continue;
    const y = Number(d.slice(0, 4));
    if (Number.isFinite(y) && y > 0) seen.add(y);
  }
  return [...seen]
    .sort((a, b) => b - a)
    .slice(0, max)
    .map((y) => ({ value: String(y), label: String(y) }));
}
