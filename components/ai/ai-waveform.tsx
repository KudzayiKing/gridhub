"use client";

/**
 * Gridhub AI — live input meter.
 *
 * A row of bars whose heights follow the microphone's RMS level. It is decoration with a purpose:
 * it proves the microphone is actually open, so a silent recording is visible immediately. It is
 * aria-hidden because the recorder status is already announced in text.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const BARS = 21;

export function AIWaveform({ level, active }: { level: number; active: boolean }) {
  // A fixed shape keeps the meter from looking like random noise when nobody is speaking.
  const shape = React.useMemo(
    () => Array.from({ length: BARS }, (_, i) => 0.35 + 0.65 * Math.sin((i / (BARS - 1)) * Math.PI)),
    [],
  );

  return (
    <div className="flex h-10 items-center justify-center gap-[3px]" aria-hidden="true">
      {shape.map((weight, index) => {
        const height = active ? 6 + level * 34 * weight : 3 + weight * 3;
        return (
          <span
            key={index}
            className={cn(
              "w-[3px] rounded-full transition-[height,background-color] duration-100",
              active ? "bg-[var(--brand)]" : "bg-[var(--border-strong)]",
            )}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}
