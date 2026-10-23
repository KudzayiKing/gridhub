"use client";

/**
 * Gridhub AI — speech model installer.
 *
 * Sits beside the language-model installer so the two downloads are visibly separate: the LLM is
 * 1.87 GB, Whisper is tens of megabytes, and someone may reasonably want one without the other.
 */

import * as React from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import type { UseAISpeech } from "@/lib/use-ai-speech";

function prettyFile(file: string): string {
  const base = file.split("/").pop() ?? file;
  return base.replace(/_quantized/, "").replace(/\.onnx$/, "");
}

export function AISpeechInstaller({
  speech,
  compact = false,
}: {
  speech: UseAISpeech;
  compact?: boolean;
}) {
  const { status, progress, meta, error } = speech;

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-[var(--bg-subtle)]/40 px-3 py-2 text-[12px] text-fg-muted">
        <AnimatedIcon name="loader" size={14} trigger="mount" className="animate-spin" />
        Checking the speech model…
      </div>
    );
  }

  if (status === "ready" && meta) {
    return (
      <div className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AnimatedIcon name="check" size={14} className="text-[var(--positive)]" trigger="none" />
            <span className="text-[12.5px] font-medium text-fg">Voice input is ready</span>
          </div>
          <Badge tone="positive">Installed</Badge>
        </div>
        <p className="mt-1 text-[11px] text-fg-subtle">
          {meta.files} file{meta.files === 1 ? "" : "s"} cached · installed{" "}
          {new Date(meta.installedAt).toLocaleDateString()}
        </p>
        {!compact ? (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              onClick={() => void speech.remove()}
              className="text-[var(--negative)]"
            >
              Remove voice
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (status === "downloading") {
    const pct = Math.round(progress?.fileProgress ?? 0);
    return (
      <div className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-fg">Installing voice input</span>
          <span className="text-[11px] tabular-nums text-fg-subtle">{pct}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-strong)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Speech model download progress"
        >
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-200"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
        <p className="mt-1.5 truncate text-[11px] text-fg-subtle">
          {progress ? prettyFile(progress.file) : "Starting…"}
          {progress?.completed ? ` · ${progress.completed} done` : ""}
        </p>
        <div className="mt-2 flex justify-end">
          <Button variant="secondary" size="sm" icon="close" onClick={speech.cancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-[var(--negative)]/30 bg-[var(--negative)]/5 px-3 py-2.5">
        <p className="text-[12px] font-medium text-fg">Voice input could not be installed</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-muted">
          {error ?? "The download was interrupted."}
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" size="sm" icon="refresh" onClick={() => void speech.install()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AnimatedIcon name="mic" size={15} className="mt-0.5 text-fg-muted" trigger="hover" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-fg">Add voice input</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-muted">
            A small speech model that runs on this device. Typing works without it.
          </p>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button variant="secondary" size="sm" icon="download" onClick={() => void speech.install()}>
          Install voice
        </Button>
      </div>
    </div>
  );
}
