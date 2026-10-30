"use client";

/**
 * Settings → Gridhub AI.
 *
 * Everything here is device-scoped: the model and command history live in this browser only.
 * The page states plainly what runs locally and what is stored.
 */

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { Field, Select, Switch } from "@/components/ui/field";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { AIModelInstaller } from "@/components/ai/ai-model-installer";
import { useGridhubAI } from "@/components/ai/ai-provider";
import { PRIVACY_FACTS, type HistoryRetention } from "@/lib/ai/ai-privacy";
import { useAISettings } from "@/lib/use-ai-settings";
import { formatBytes } from "@/lib/ai/model-manifest";
import { useI18n } from "@/lib/i18n";

const RETENTION_LABEL: Record<HistoryRetention, string> = {
  session: "Until this tab closes",
  "7days": "7 days",
  "30days": "30 days",
  off: "Don't keep history",
};

export default function GridhubAISettingsPage() {
  const { t } = useI18n();
  const { ai, model } = useGridhubAI();
  const { settings, update: updateSettings } = useAISettings();

  const update = (patch: Parameters<typeof updateSettings>[0]) => {
    updateSettings(patch);
    if (patch.retention === "off") ai.clearHistory();
  };

  const caps = model.capabilities;
  const level = caps?.level ?? "basic";
  const levelLabel =
    level === "full" || level === "text"
      ? t("Text commands")
      : level === "basic"
        ? t("Basic commands")
        : t("Unavailable");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/app/settings"
          className="press inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg"
        >
          <AnimatedIcon name="chevronLeft" size={14} trigger="hover" />
          {t("Settings")}
        </Link>
      </div>

      <SectionHeading
        eyebrow={t("Assistant")}
        title={t("Gridhub AI")}
        description={t("Typed commands and quick entry that work with your local workspace.")}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold">{t("Local model")}</h2>
              <p className="mt-0.5 text-[12px] text-fg-muted">
                {t("Downloaded once, then used offline. No API key, no hosted endpoint.")}
              </p>
            </div>
            <Badge tone={model.status === "ready" ? "positive" : "neutral"}>
              {model.status === "ready" ? t("Installed") : t("Not installed")}
            </Badge>
          </div>
          <div className="mt-3">
            <AIModelInstaller model={model} />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("This device")}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {t("What Gridhub AI can use in this browser.")}
          </p>
          <div className="mt-3 space-y-1.5 text-[12px]">
            <Row label={t("Capability")} value={levelLabel} />
            <Row label={t("WebAssembly")} value={caps?.wasm ? t("Available") : t("Missing")} />
            <Row label={t("WebGPU")} value={caps?.webgpu ? t("Available") : t("Not available")} />
            <Row
              label={t("Storage")}
              value={
                caps?.storage.supported
                  ? caps.storage.quota
                    ? t("{used} used of {total}", { used: formatBytes(caps.storage.usage), total: formatBytes(caps.storage.quota) })
                    : t("Reported")
                  : t("Unknown")
              }
            />
          </div>
          {caps?.reasons.length ? (
            <ul className="mt-2.5 space-y-1">
              {caps.reasons.map((reason) => (
                <li key={reason} className="text-[11.5px] leading-relaxed text-fg-subtle">
                  · {reason}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("Behavior")}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {t("Applies to this device. Typed commands always work.")}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px]">{t("Enable the text assistant")}</p>
                <p className="text-[11.5px] text-fg-subtle">
                  {t("Opens the assistant from the ⌘J / Ctrl+J shortcut.")}
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
                aria-label={t("Enable the text assistant")}
              />
            </div>
            <Field
              label={t("Language")}
              htmlFor="ai-locale"
              hint={t("Text commands recognize supported phrases in your interface language.")}
            >
              {/* Uncontrolled + disabled: the value is fixed, so a controlled `value` would only
                  trigger React's "value without onChange" warning. */}
              <Select id="ai-locale" defaultValue="en" disabled>
                <option value="en">{t("English")}</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">{t("Command history")}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {t("Kept on this device so you can see what you asked. Never sent anywhere.")}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <Field label={t("Keep history for")} htmlFor="ai-retention">
              <Select
                id="ai-retention"
                value={settings.retention}
                onChange={(e) => update({ retention: e.target.value as HistoryRetention })}
              >
                {(Object.keys(RETENTION_LABEL) as HistoryRetention[]).map((key) => (
                  <option key={key} value={key}>
                    {t(RETENTION_LABEL[key])}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-fg-subtle">
                {t("{count} saved commands", { count: ai.history.length })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon="trash"
                onClick={() => ai.clearHistory()}
                disabled={!ai.history.length}
              >
                {t("Clear history")}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="text-[14px] font-semibold">{t("Privacy")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PRIVACY_FACTS.map((fact) => (
              <div key={fact.title} className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-3">
                <p className="text-[12.5px] font-medium text-fg">{t(fact.title)}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">{t(fact.detail)}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2">
          <InlineAlert tone="info">
            {t("Gridhub AI proposes changes and waits for your confirmation. It never writes to your records directly, and it can only use the tools included in your plan.")}
          </InlineAlert>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-fg-subtle">{label}</span>
      <span className="text-right font-medium text-fg">{value}</span>
    </div>
  );
}
