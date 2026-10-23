"use client";

/**
 * Gridhub AI — model installer.
 *
 * Download is always explicit: nothing is fetched until the user presses the button, and the
 * progress bar reports real received bytes. When the server does not advertise a size the UI says
 * "Size unknown" rather than inventing a number.
 */

import * as React from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { formatBytes } from "@/lib/ai/model-manifest";
import type { UseAIModel } from "@/lib/use-ai-model";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-fg-subtle">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-fg">{value}</span>
    </div>
  );
}

export function AIModelInstaller({
  model,
  onLearnMore,
  compact = false,
}: {
  model: UseAIModel;
  onLearnMore?: () => void;
  compact?: boolean;
}) {
  const { status, progress, meta, error, capabilities } = model;

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3 text-[12.5px] text-fg-muted">
        <AnimatedIcon name="loader" size={15} trigger="mount" className="animate-spin" />
        Checking what this device supports…
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <AnimatedIcon name="info" size={15} className="text-fg-muted" trigger="none" />
          <p className="text-[13px] font-medium text-fg">Gridhub AI can&apos;t run here</p>
        </div>
        <p className="text-[12px] leading-relaxed text-fg-muted">
          This browser does not expose the features the on-device model needs. Typing, manual entry
          and every tool still work exactly as before.
        </p>
        {capabilities?.reasons.length ? (
          <ul className="mt-2 space-y-1">
            {capabilities.reasons.map((reason) => (
              <li key={reason} className="text-[11.5px] leading-relaxed text-fg-subtle">
                · {reason}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (status === "downloading") {
    const received = progress?.received ?? 0;
    const total = progress?.total ?? 0;
    const ratio = progress?.ratio;
    return (
      <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-fg">Downloading the local model</p>
          <span className="text-[11.5px] tabular-nums text-fg-subtle">
            {total > 0 ? `${Math.round((ratio ?? 0) * 100)}%` : formatBytes(received)}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ratio ? Math.round(ratio * 100) : undefined}
          aria-label="Model download progress"
        >
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-200"
            style={{ width: `${Math.max(2, Math.round((ratio ?? 0) * 100))}%` }}
          />
        </div>
        <p className="mt-2 text-[11.5px] text-fg-subtle">
          {total > 0
            ? `${formatBytes(received)} of ${formatBytes(total)}`
            : `${formatBytes(received)} downloaded`}
          {" · "}
          Keep this tab open. You can cancel at any time.
        </p>
        <div className="mt-2.5 flex justify-end">
          <Button variant="secondary" size="sm" icon="close" onClick={model.cancel}>
            Cancel download
          </Button>
        </div>
      </div>
    );
  }

  if (status === "ready" && meta) {
    return (
      <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AnimatedIcon name="check" size={15} className="text-[var(--positive)]" trigger="none" />
            <p className="text-[13px] font-medium text-fg">Gridhub AI is installed</p>
          </div>
          <Badge tone="positive">Ready</Badge>
        </div>
        <div className="space-y-1">
          <Row label="Model" value={`${model.manifest.name} · v${meta.version}`} />
          <Row label="Stored on device" value={formatBytes(meta.bytes)} />
          <Row
            label="Integrity"
            value={
              meta.integrity === "verified"
                ? "Verified against a known hash"
                : "Hash recorded on download"
            }
          />
          <Row label="Installed" value={new Date(meta.installedAt).toLocaleDateString()} />
        </div>
        {!compact ? (
          <p className="mt-2 break-all font-mono text-[10.5px] leading-relaxed text-fg-subtle">
            SHA-256 {meta.sha256}
          </p>
        ) : null}
        <div className="mt-2.5 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon="trash"
            onClick={() => void model.remove()}
            className="text-[var(--negative)]"
          >
            Remove from this device
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <AnimatedIcon name="warning" size={15} className="text-[var(--negative)]" trigger="none" />
          <p className="text-[13px] font-medium text-fg">The download didn&apos;t finish</p>
        </div>
        <p className="text-[12px] leading-relaxed text-fg-muted">
          {error ?? "Something interrupted the download."}
        </p>
        <div className="mt-2.5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" icon="refresh" onClick={() => void model.install()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // not-installed
  return (
    <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        {/* This card's ask is a one-time download, so the icon says download, not "AI". */}
        <AnimatedIcon name="download" size={15} className="text-[var(--brand)]" trigger="mount" />
        <p className="text-[13px] font-medium text-fg">Enable Gridhub AI</p>
      </div>
      <p className="text-[12px] leading-relaxed text-fg-muted">
        Voice commands and natural-language entry run entirely on this device. Download the model
        once — after that it works offline, and nothing you say leaves your browser.
      </p>
      <div className="mt-2 space-y-1">
        <Row label="Download size" value={formatBytes(model.manifest.sizeBytes)} />
        <Row
          label="Runs on"
          value={capabilities?.webgpu ? "GPU (WebGPU) with CPU fallback" : "CPU"}
        />
        <Row label="Account" value="Included in every plan" />
      </div>
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {onLearnMore ? (
          <button
            type="button"
            onClick={onLearnMore}
            className="press text-left text-[11.5px] text-fg-subtle underline decoration-line-strong underline-offset-2 hover:text-fg"
          >
            Learn more
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => void model.remove()}>
            Not now
          </Button>
          <Button variant="primary" size="sm" icon="download" onClick={() => void model.install()}>
            Download AI
          </Button>
        </div>
      </div>
    </div>
  );
}
