"use client";

import * as React from "react";
import { FREE_TOOL_ANALYTICS_CONSENT_KEY, trackFreeToolEvent } from "@/lib/free-tool-analytics";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function FreeToolAnalyticsConsent({ toolId }: { toolId: string }) {
  const { t } = useI18n();
  const [choice, setChoice] = React.useState<string | null>(null);
  React.useEffect(() => setChoice(window.localStorage.getItem(FREE_TOOL_ANALYTICS_CONSENT_KEY)), []);
  const choose = (value: "yes" | "no") => {
    window.localStorage.setItem(FREE_TOOL_ANALYTICS_CONSENT_KEY, value);
    setChoice(value);
    if (value === "yes") trackFreeToolEvent("calculator_view", toolId);
  };
  if (choice) return <div className="mx-auto mt-6 max-w-4xl text-right"><button className="text-[11px] text-fg-subtle underline underline-offset-2" onClick={() => choose(choice === "yes" ? "no" : "yes")}>{choice === "yes" ? t("Turn off anonymous usage analytics") : t("Allow anonymous usage analytics")}</button></div>;
  return <aside className="mx-auto mt-6 flex max-w-4xl flex-col gap-3 rounded-2xl border border-line bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-xs leading-relaxed text-fg-muted">{t("Help us improve these free calculators by sharing anonymous page and signup counts. No amounts, names, or calculator inputs are collected.")}</p>
    <div className="flex shrink-0 gap-2"><Button size="sm" variant="ghost" onClick={() => choose("no")}>{t("No thanks")}</Button><Button size="sm" variant="secondary" onClick={() => choose("yes")}>{t("Allow analytics")}</Button></div>
  </aside>;
}
