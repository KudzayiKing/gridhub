"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n";

/**
 * The name the app suggests when someone creates an emergency fund. It is app copy rather
 * than the person's own words, so it is displayed translated — the same rule that translates
 * the "Uncategorized" sentinel while leaving a user's real category names alone.
 *
 * Records created before this rule still carry the English name, so the translation happens at
 * render time instead of relying on a data migration.
 */
export const EMERGENCY_FUND_DEFAULT_NAME = "Emergency Fund";

export type GoalKind = "goal" | "emergency";

/** True only for the unmodified default, so a renamed goal keeps the person's wording. */
export function isEmergencyFundDefaultName(name: string): boolean {
  return name.trim().toLowerCase() === EMERGENCY_FUND_DEFAULT_NAME.toLowerCase();
}

/**
 * Returns a display label for a savings goal.
 *
 * Only the seeded default is translated. Anything else — "Holiday", "Подушка на чёрный день",
 * "Kitchen" — is user data and must render exactly as typed, in every language.
 */
export function useGoalLabel() {
  const { t } = useI18n();
  return React.useCallback(
    (goal: { name: string; kind?: GoalKind }): string =>
      goal.kind === "emergency" && isEmergencyFundDefaultName(goal.name)
        ? t(EMERGENCY_FUND_DEFAULT_NAME)
        : goal.name,
    [t],
  );
}
