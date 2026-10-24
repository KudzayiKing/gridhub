"use client";

/**
 * Settings → Gridhub AI.
 *
 * Everything here is device-scoped: the model, the microphone preference and the command history
 * live in this browser only. The page states plainly what runs locally and what is stored.
 */

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { Field, Select, Switch } from "@/components/ui/field";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { AIModelInstaller } from "@/components/ai/ai-model-installer";
import { AISpeechInstaller } from "@/components/ai/ai-speech-installer";
import { useGridhubAI } from "@/components/ai/ai-provider";
import { PRIVACY_FACTS, type HistoryRetention } from "@/lib/ai/ai-privacy";
import { useAISettings } from "@/lib/use-ai-settings";
import { formatBytes } from "@/lib/ai/model-manifest";

const RETENTION_LABEL: Record<HistoryRetention, string> = {
  session: "Until this tab closes",
  "7days": "7 days",
  "30days": "30 days",
  off: "Don't keep history",
};

export default function GridhubAISettingsPage() {
  const { ai, model, speech } = useGridhubAI();
  const { settings, update: updateSettings } = useAISettings();

  const update = (patch: Parameters<typeof updateSettings>[0]) => {
    updateSettings(patch);
    if (patch.retention === "off") ai.clearHistory();
  };

  const caps = model.capabilities;
  const level = caps?.level ?? "basic";
  const levelLabel =
    level === "full"
      ? "Voice and text"
      : level === "text"
        ? "Text only"
        : level === "basic"
          ? "Basic commands"
          : "Unavailable";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/app/settings"
          className="press inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg"
        >
          <AnimatedIcon name="chevronLeft" size={14} trigger="hover" />
          Settings
        </Link>
      </div>

      <SectionHeading
        eyebrow="Assistant"
        title="Gridhub AI"
        description="Voice and natural-language commands that run on this device."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold">Local model</h2>
              <p className="mt-0.5 text-[12px] text-fg-muted">
                Downloaded once, then used offline. No API key, no hosted endpoint.
              </p>
            </div>
            <Badge tone={model.status === "ready" ? "positive" : "neutral"}>
              {model.status === "ready" ? "Installed" : "Not installed"}
            </Badge>
          </div>
          <div className="mt-3">
            <AIModelInstaller model={model} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold">Voice input</h2>
              <p className="mt-0.5 text-[12px] text-fg-muted">
                A small speech model, installed separately from the assistant.
              </p>
            </div>
            <Badge tone={speech.status === "ready" ? "positive" : "neutral"}>
              {speech.status === "ready" ? "Installed" : "Not installed"}
            </Badge>
          </div>
          <div className="mt-3">
            <AISpeechInstaller speech={speech} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">
            Transcription runs locally. Audio is never uploaded and is discarded as soon as the
            words are extracted.
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">This device</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            What Gridhub AI can use in this browser.
          </p>
          <div className="mt-3 space-y-1.5 text-[12px]">
            <Row label="Capability" value={levelLabel} />
            <Row label="WebAssembly" value={caps?.wasm ? "Available" : "Missing"} />
            <Row label="WebGPU" value={caps?.webgpu ? "Available" : "Not available"} />
            <Row label="Microphone" value={caps?.microphone ? "Available" : "Not available"} />
            <Row label="Recording" value={caps?.mediaRecorder ? "Available" : "Not available"} />
            <Row
              label="Storage"
              value={
                caps?.storage.supported
                  ? caps.storage.quota
                    ? `${formatBytes(caps.storage.usage)} used of ${formatBytes(caps.storage.quota)}`
                    : "Reported"
                  : "Unknown"
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
          <h2 className="text-[14px] font-semibold">Behavior</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Applies to this device. Typed commands always work.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px]">Show the assistant button</p>
                <p className="text-[11.5px] text-fg-subtle">
                  The floating microphone on every page.
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
                aria-label="Show the assistant button"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px]">Voice input</p>
                <p className="text-[11.5px] text-fg-subtle">
                  Speech is transcribed on this device and never uploaded.
                </p>
              </div>
              <Switch
                checked={settings.voice}
                onCheckedChange={(v) => update({ voice: v })}
                aria-label="Voice input"
                disabled={!caps?.microphone}
              />
            </div>
            <Field
              label="Language"
              htmlFor="ai-locale"
              hint="Gridhub AI responds in English. Changing your interface language does not change AI responses."
            >
              {/* Uncontrolled + disabled: the value is fixed, so a controlled `value` would only
                  trigger React's "value without onChange" warning. */}
              <Select id="ai-locale" defaultValue="en" disabled>
                <option value="en">English</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-[14px] font-semibold">Command history</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            Kept on this device so you can see what you asked. Never sent anywhere.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <Field label="Keep history for" htmlFor="ai-retention">
              <Select
                id="ai-retention"
                value={settings.retention}
                onChange={(e) => update({ retention: e.target.value as HistoryRetention })}
              >
                {(Object.keys(RETENTION_LABEL) as HistoryRetention[]).map((key) => (
                  <option key={key} value={key}>
                    {RETENTION_LABEL[key]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-fg-subtle">
                {ai.history.length} saved {ai.history.length === 1 ? "command" : "commands"}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon="trash"
                onClick={() => ai.clearHistory()}
                disabled={!ai.history.length}
              >
                Clear history
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="text-[14px] font-semibold">Privacy</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PRIVACY_FACTS.map((fact) => (
              <div key={fact.title} className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-3">
                <p className="text-[12.5px] font-medium text-fg">{fact.title}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">{fact.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2">
          <InlineAlert tone="info">
            Gridhub AI proposes changes and waits for your confirmation. It never writes to your
            records directly, and it can only use the tools included in your plan.
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
