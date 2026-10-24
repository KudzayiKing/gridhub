"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { useI18n } from "@/lib/i18n";

/* -------------------------------- Card --------------------------------- */

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { sheen?: boolean }
>(function Card({ className, sheen = true, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("gp-card glass-sheen", className)}
      {...props}
    />
  );
});

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-[var(--bg-subtle)] text-fg-muted">
            <AnimatedIcon name={icon} size={16} trigger="hover" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-fg">{typeof title === "string" ? t(title) : title}</h3>
          {description ? (
            <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{typeof description === "string" ? t(description) : description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------- Badge --------------------------------- */

const badgeTones = {
  neutral: "border-line bg-[var(--bg-subtle)] text-fg-muted",
  accent: "border-transparent bg-[var(--accent-soft)] text-fg",
  positive: "border-transparent bg-[color-mix(in_oklab,var(--positive)_16%,transparent)] text-[var(--positive)]",
  negative: "border-transparent bg-[color-mix(in_oklab,var(--negative)_14%,transparent)] text-[var(--negative)]",
  warning: "border-transparent bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] text-[var(--warning)]",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
        badgeTones[tone],
        className,
      )}
    >
      {typeof children === "string" ? t(children) : children}
    </span>
  );
}

/* ----------------------------- Metric card ----------------------------- */

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  trend,
  className,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
  trend?: { direction: "up" | "down" | "flat"; label: string };
  className?: string;
  onClick?: () => void;
}) {
  const { t } = useI18n();
  const toneColor =
    tone === "positive"
      ? "var(--positive)"
      : tone === "negative"
        ? "var(--negative)"
        : tone === "warning"
          ? "var(--warning)"
          : "var(--fg)";

  return (
    <div
      className={cn(
        "gp-card glass-sheen flex flex-col justify-between gap-3 p-4 sm:p-5",
        onClick && "press cursor-pointer text-left hover:bg-[var(--surface-hover)]",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-fg-subtle">{t(label)}</p>
        {icon ? <AnimatedIcon name={icon} size={16} className="text-fg-subtle" trigger="hover" /> : null}
      </div>
      <div>
        <p className="tnum text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]" style={{ color: toneColor }}>
          {value}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-medium",
                trend.direction === "up"
                  ? "text-[var(--positive)]"
                  : trend.direction === "down"
                    ? "text-[var(--negative)]"
                    : "text-fg-subtle",
              )}
            >
              <AnimatedIcon
                name={trend.direction === "down" ? "arrowDown" : "arrowUp"}
                size={12}
                trigger="none"
              />
              {trend.label}
            </span>
          ) : null}
          {hint ? <span className="text-[11px] text-fg-subtle">{typeof hint === "string" ? t(hint) : hint}</span> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Empty state ---------------------------- */

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-[color-mix(in_oklab,var(--bg-subtle)_55%,transparent)] text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full border border-line bg-[var(--surface-strong)] text-fg-muted">
        <AnimatedIcon name={icon} size={20} trigger="hover" />
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-medium text-fg">{t(title)}</p>
        {description ? <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{t(description)}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/* ------------------------------- Skeleton ------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} aria-hidden="true" />;
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/* ---------------------------- Section heading -------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{t(eyebrow)}</p> : null}
        <h2 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{typeof title === "string" ? t(title) : title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-fg-muted">{typeof description === "string" ? t(description) : description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Stat row ----------------------------- */

export function Stat({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">{t(label)}</p>
      <p
        className="tnum mt-0.5 truncate text-sm font-semibold"
        style={{
          color:
            tone === "positive"
              ? "var(--positive)"
              : tone === "negative"
                ? "var(--negative)"
                : tone === "warning"
                  ? "var(--warning)"
                  : "var(--fg)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

/** Small inline warning strip used by tool pages. */
export function InlineAlert({
  tone = "warning",
  title,
  children,
  icon,
}: {
  tone?: "warning" | "negative" | "positive" | "info";
  title?: string;
  children: React.ReactNode;
  icon?: string;
}) {
  const { t } = useI18n();
  const color =
    tone === "negative"
      ? "var(--negative)"
      : tone === "positive"
        ? "var(--positive)"
        : tone === "info"
          ? "var(--fg-muted)"
          : "var(--warning)";
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] leading-snug"
      style={{
        borderColor: `color-mix(in oklab, ${color} 30%, transparent)`,
        background: `color-mix(in oklab, ${color} 8%, transparent)`,
        color: "var(--fg)",
      }}
      role={tone === "negative" ? "alert" : "status"}
    >
      <AnimatedIcon
        name={icon ?? (tone === "positive" ? "check" : tone === "info" ? "info" : "alert")}
        size={16}
        className="mt-0.5 shrink-0"
        trigger="hover"
      />
      <div className="min-w-0">
        {title ? <p className="font-medium">{t(title)}</p> : null}
        <div className="text-fg-muted">{typeof children === "string" ? t(children) : children}</div>
      </div>
    </div>
  );
}
