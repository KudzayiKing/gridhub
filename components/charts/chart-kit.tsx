"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Client-mount gate.
 *
 * Recharts renders differently on the server (no measured width) than on the
 * client, which produces hydration warnings. Every chart here only paints after
 * mount, mirroring the existing hand-rolled primitives in trend.tsx that exist
 * specifically to avoid that mismatch. Until then we show the placeholder state.
 * -------------------------------------------------------------------------- */
export function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted;
}

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03" -> "Mar", "2026" -> "2026". */
export function monthLabel(period: string, language: string = "en"): string {
  if (period.length >= 7) {
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7));
    if (Number.isFinite(year) && month >= 1 && month <= 12) {
      const locale = ({ es: "es-ES", "zh-CN": "zh-CN", "pt-BR": "pt-BR", fr: "fr-FR", ar: "ar", ru: "ru-RU" } as Record<string, string>)[language] ?? "en-US";
      return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(year, month - 1, 1));
    }
    return period;
  }
  return period;
}

/** Stable categorical colour ramp, themed via CSS variables. */
export function chartColor(i: number): string {
  return `var(--chart-${(i % 8) + 1})`;
}

export const SEMANTIC = {
  income: "var(--positive)",
  expense: "var(--chart-3)",
  net: "var(--accent)",
  positive: "var(--positive)",
  negative: "var(--negative)",
  accent: "var(--accent)",
  warning: "var(--warning)",
  grid: "var(--border)",
  axis: "var(--fg-subtle)",
} as const;

/* ----------------------------------------------------------------------------
 * ChartContainer — the glassmorphic shell every chart shares.
 * -------------------------------------------------------------------------- */
export function ChartContainer({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const { t } = useI18n();
  return (
    <section className={cn("gp-card min-w-0 p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold text-fg">{t(title)}</h3>
          {subtitle ? <p className="text-[12px] text-fg-muted">{t(subtitle)}</p> : null}
        </div>
        {action}
      </div>
      <div className={cn("min-w-0 w-full", bodyClassName)}>{children}</div>
    </section>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  const { t } = useI18n();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: it.color }} />
          {t(it.label)}
        </span>
      ))}
    </div>
  );
}

export function ChartEmptyState({ label = "No data for this period yet" }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-[160px] min-w-0 items-center justify-center rounded-xl border border-dashed border-line-strong px-3 text-center text-[12px] leading-relaxed text-fg-subtle [overflow-wrap:anywhere]">
      {t(label)}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * ChartTooltip — shared, locale-aware tooltip. `rows` are pre-formatted
 * { label, value, color } entries so callers control formatting/currency.
 * -------------------------------------------------------------------------- */
export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltip({
  active,
  title,
  rows,
}: {
  active?: boolean;
  title?: string;
  rows?: TooltipRow[];
}) {
  const { t } = useI18n();
  if (!active || !rows?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-[var(--surface-strong)] px-3 py-2 text-[12px] shadow-[var(--shadow-lift)]">
      {title ? <p className="mb-1 font-medium text-fg">{t(title)}</p> : null}
      <div className="flex flex-col gap-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-muted">
              {r.color ? <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} /> : null}
              {t(r.label)}
            </span>
            <span className="tnum font-medium text-fg">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Custom tooltip renderer for recharts `content`. */
export function makeTooltip(
  formatValue: (entry: { name?: string; dataKey?: string; value?: number; color?: string }, title?: string) => TooltipRow[],
) {
  return function Renderer(props: { active?: boolean; label?: string; payload?: { name?: string; dataKey?: string; value?: number; color?: string }[] }) {
    if (!props.active || !props.payload?.length) return null;
    return (
      <ChartTooltip
        active={props.active}
        title={typeof props.label === "string" ? props.label : undefined}
        rows={formatValue(props.payload[0], props.label)}
      />
    );
  };
}

/**
 * Drop-in `content` for any recharts <Tooltip>: builds one row per payload entry and
 * formats each value through `format`. Pair with `formatMoney` so currencies render right.
 */
export function RechartsTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { name?: string; dataKey?: string; value?: number | string; color?: string; fill?: string }[];
  label?: string | number;
  format?: (value: number | string | undefined, dataKey?: string, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const rows: TooltipRow[] = payload.map((p) => ({
    label: p.name ?? p.dataKey ?? "",
    value: format ? format(p.value, p.dataKey, p.name) : String(p.value ?? ""),
    color: p.color || p.fill,
  }));
  return <ChartTooltip active title={typeof label === "string" ? label : undefined} rows={rows} />;
}
