"use client";

/**
 * Gridhub AI — the floating microphone.
 *
 * Present on every authenticated route. On a phone it sits above the bottom navigation and the
 * safe area; on desktop it sits in the bottom-right corner. It is the only entry point that starts
 * listening, and it never listens without a tap.
 */

import * as React from "react";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { useGridhubAI } from "./ai-provider";
import { cn } from "@/lib/utils";

export function GridhubAIFab() {
  const { ai, model, recorder, listen, stopListening, enabled, voiceEnabled } = useGridhubAI();

  const recording = recorder.status === "recording";
  const transcribing = recorder.status === "transcribing" || recorder.status === "requesting";
  const thinking = ai.phase === "thinking";
  const installed = model.status === "ready";

  if (!enabled) return null;

  const onClick = async () => {
    if (recording) {
      await stopListening();
      return;
    }
    if (transcribing) {
      recorder.cancel();
      return;
    }
    if (!ai.open) ai.openPanel();
    // With voice turned off the button is still the way into the panel; it just doesn't listen.
    if (voiceEnabled) await listen();
  };

  const label = recording
    ? "Stop listening"
    : transcribing
      ? "Transcribing…"
      : thinking
        ? "Gridhub AI is thinking"
        : "Ask Gridhub AI";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-end px-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:px-0">
      <div className="pointer-events-auto relative">
        {/* Halo: only while recording, so the resting state stays calm. */}
        {recording ? (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-ping rounded-full bg-[var(--brand)] opacity-30 [animation-duration:1.8s]"
            />
            <span
              aria-hidden="true"
              className="absolute -inset-1.5 rounded-full border border-[var(--brand)]/50"
            />
          </>
        ) : null}

        <button
          type="button"
          onClick={() => void onClick()}
          aria-label={label}
          aria-expanded={ai.open}
          aria-pressed={recording}
          title={label}
          className={cn(
            "press group relative grid h-14 w-14 place-items-center rounded-full",
            "bg-[var(--brand)] text-[#06231a]",
            "shadow-[0_10px_30px_-8px_rgba(0,213,135,0.55),0_2px_6px_rgba(23,26,24,0.18)]",
            "transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
            recording && "scale-[1.03]",
          )}
        >
          {transcribing ? (
            <AnimatedIcon name="loader" size={22} trigger="mount" className="animate-spin" />
          ) : recording ? (
            <AnimatedIcon name="stop" size={22} trigger="click" />
          ) : (
            <AnimatedIcon name="mic" size={22} trigger="both" />
          )}

          {/* Unread dot: the model is not installed, so only quick commands work. */}
          {!installed && !recording && !transcribing ? (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#06231a] ring-2 ring-[var(--brand)]"
            />
          ) : null}
        </button>

        {/* Desktop affordance: the keyboard shortcut, shown on hover only. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-line bg-[var(--surface-strong)] px-2 py-1 text-[11px] text-fg-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100 lg:block"
        >
          Ask Gridhub AI <kbd className="ml-1 text-fg-subtle">⌘J</kbd>
        </span>
      </div>
    </div>
  );
}
