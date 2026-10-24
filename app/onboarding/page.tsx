"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { COLLECTIONS, TOOLS, toolsByCollection, type CollectionId, type ToolId } from "@/lib/catalog";
import { useActiveTools } from "@/lib/use-tools";
import { usePrefs } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ToolIcon } from "@/components/icons/tool-icons";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { plansCovering, recommendPlan, annualSavings } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { UI_LANGUAGES, useI18n } from "@/lib/i18n";

const STEPS = ["Welcome", "Interests", "Tools", "Plan", "Preferences"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { setActive } = useActiveTools();
  const { prefs, setPrefs } = usePrefs();
  const { t } = useI18n();
  const [step, setStep] = React.useState(0);
  const [collections, setCollections] = React.useState<CollectionId[]>([]);
  const [selected, setSelected] = React.useState<ToolId[]>([]);

  const recommended = recommendPlan(Math.max(1, selected.length));
  const alternatives = plansCovering(Math.max(1, selected.length));

  const toggleCollection = (id: CollectionId) =>
    setCollections((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const toggleTool = (id: ToolId) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const finish = async () => {
    await setActive(selected.length ? selected : ["budget"]);
    router.push("/app");
  };

  const visibleTools = collections.length
    ? TOOLS.filter((t) => collections.includes(t.collection))
    : TOOLS;

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <Logo size="md" />
        <div className="flex items-center gap-1" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-[var(--accent)]" : i < step ? "w-3 bg-[var(--accent)]/60" : "w-3 bg-[var(--border-strong)]",
              )}
            />
          ))}
        </div>
      </div>

      {step === 0 ? (
        <Card className="p-6 sm:p-8">
          <p className="eyebrow mb-2">{t("Welcome")}</p>
          <h1 className="display-xl text-3xl sm:text-4xl">{t("Welcome to Gridhub.")}</h1>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-fg-muted">
            {t("Let's create a workspace built around what matters to you. Pick a few collections, choose your tools, and we'll suggest the least expensive plan that covers them.")}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COLLECTIONS.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-[var(--bg-subtle)]/50 p-3">
                <p className="text-[12.5px] font-medium">{t(c.name)}</p>
                <p className="text-[11px] text-fg-subtle">{toolsByCollection(c.id).length} {t("tools")}</p>
              </div>
            ))}
          </div>
          <Button variant="primary" size="lg" className="mt-6" iconRight="arrowRight" onClick={() => setStep(1)}>
            Get started
          </Button>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{t("What are you organizing?")}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">{t("Choose any that apply. This only filters the next step.")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {COLLECTIONS.map((c) => {
              const on = collections.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCollection(c.id)}
                  aria-pressed={on}
                  className={cn(
                    "press rounded-xl border p-3 text-left transition-colors",
                    on ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line bg-[var(--surface-strong)]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[13.5px] font-medium">{t(c.label)}</p>
                    {on ? <AnimatedIcon name="check" size={14} trigger="none" /> : null}
                  </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-fg-muted">{t(c.blurb)}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button variant="primary" size="sm" iconRight="arrowRight" onClick={() => setStep(2)}>
              Choose tools
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{t("Select your tools")}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {selected.length} {t("selected. You can change this any time — your records are never deleted.")}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {visibleTools.map((tool) => {
              const on = selected.includes(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  aria-pressed={on}
                  className={cn(
                    "press flex items-start gap-2.5 rounded-xl border p-2.5 text-left",
                    on ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line bg-[var(--surface-strong)]",
                  )}
                >
                  <ToolIcon toolId={tool.id} size={15} tinted={false} trigger="none" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{t(tool.name)}</span>
                    <span className="block truncate text-[11px] text-fg-subtle">{t(tool.tagline)}</span>
                  </span>
                  {on ? <AnimatedIcon name="check" size={13} trigger="none" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" size="sm" iconRight="arrowRight" onClick={() => setStep(3)} disabled={!selected.length}>
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{t("Recommended plan")}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {t("Based on {count} tools. Nothing is purchased until you confirm at checkout.", { count: selected.length })}
          </p>

          <div className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-semibold">{t(recommended.name)}</p>
                <p className="text-[12px] text-fg-muted">{t(recommended.blurb)}</p>
              </div>
              <div className="text-right">
                <p className="tnum text-xl font-semibold">${recommended.monthly}<span className="text-[12px] font-normal text-fg-muted">/mo</span></p>
                <p className="text-[11px] text-fg-muted">
                  ${recommended.annual}/yr · save {annualSavings(recommended)}%
                </p>
              </div>
            </div>
          </div>

          {alternatives.length > 1 ? (
            <div className="mt-3 flex flex-col gap-1.5">
              {alternatives.slice(1).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[12px]">
                  <span>{t(p.name)} · {t("up to {count} tools", { count: p.toolLimit })}</span>
                  <span className="tnum text-fg-muted">{formatMoney(p.monthly, { currency: "USD" })}/mo</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex justify-between">
            <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button variant="primary" size="sm" iconRight="arrowRight" onClick={() => setStep(4)}>
              Continue
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="p-6">
          <h1 className="text-xl font-semibold">{t("A few details")}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">{t("Only what changes how numbers are displayed.")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Currency" htmlFor="ob-currency">
              <Select id="ob-currency" value={prefs.currency} onChange={(e) => void setPrefs({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Time zone" htmlFor="ob-tz">
              <Input id="ob-tz" value={prefs.timeZone} onChange={(e) => void setPrefs({ timeZone: e.target.value })} placeholder="Africa/Lagos" />
            </Field>
            <Field label="Business name (optional)" htmlFor="ob-biz">
              <Input id="ob-biz" value={prefs.businessName ?? ""} onChange={(e) => void setPrefs({ businessName: e.target.value })} />
            </Field>
            <Field label="Date format" htmlFor="ob-date">
              <Select
                id="ob-date"
                value={prefs.dateFormat}
                onChange={(e) => void setPrefs({ dateFormat: e.target.value as typeof prefs.dateFormat })}
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </Select>
            </Field>
            <Field label="Interface language" htmlFor="ob-language">
              <Select id="ob-language" value={prefs.uiLanguage ?? "en"} onChange={(e) => void setPrefs({ uiLanguage: e.target.value as typeof prefs.uiLanguage })}>
                {UI_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
              </Select>
            </Field>
          </div>

          <div className="mt-5 flex justify-between">
            <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button variant="primary" size="sm" icon="check" onClick={() => void finish()}>
              Enter my workspace
            </Button>
          </div>
        </Card>
      ) : null}

      <p className="text-center text-[11.5px] text-fg-subtle">
        {t("Step {current} of {total}", { current: step + 1, total: STEPS.length })} · {t(STEPS[step])}
      </p>
    </div>
  );
}
