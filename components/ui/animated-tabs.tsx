"use client";

import * as React from "react";
import { LayoutGroup, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface AnimatedTabOption<T extends string> {
  value: T;
  label: React.ReactNode;
  ariaLabel?: string;
}

/** Shared sliding selected background for tab-like controls across tools. */
export function AnimatedTabs<T extends string>({
  value,
  options,
  onChange,
  className,
  buttonClassName,
  ariaLabel,
}: {
  value: T;
  options: AnimatedTabOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
}) {
  const id = React.useId();

  return (
    <LayoutGroup id={`animated-tabs-${id}`}>
      <div role="tablist" aria-label={ariaLabel} className={className}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={option.ariaLabel}
              onClick={() => onChange(option.value)}
              className={cn(
                "press relative isolate inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors",
                active ? "text-[var(--accent-fg)]" : "text-fg-muted hover:text-fg",
                buttonClassName,
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`animated-tabs-indicator-${id}`}
                  className="absolute inset-0 -z-10 rounded-full bg-[var(--accent)]"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-1.5">{option.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
