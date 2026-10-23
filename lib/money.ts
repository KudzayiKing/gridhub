import Decimal from "decimal.js";

/**
 * Money handling rules for Gridhub.
 *
 * - Amounts are stored as positive magnitudes with an explicit type
 *   (`income` / `expense` / `transfer` / `savings`), never as ambiguous signed numbers.
 * - All arithmetic goes through decimal.js. Binary floating point is never used for
 *   money totals, tax, interest or allocation.
 * - Rounding is half-up to 2 decimal places at the presentation boundary only;
 *   intermediate interest calculations keep full precision.
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = number | string | Decimal | null | undefined;

export function D(v: MoneyInput): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  if (v instanceof Decimal) return v;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return new Decimal(0);
  return new Decimal(n);
}

export function sum(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(D(v)), new Decimal(0));
}

export function sumBy<T>(rows: T[], pick: (row: T) => MoneyInput): Decimal {
  return rows.reduce<Decimal>((acc, r) => acc.plus(D(pick(r))), new Decimal(0));
}

/** Round to 2dp for display/persistence. */
export function round2(v: MoneyInput): number {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function toNum(v: MoneyInput): number {
  return D(v).toNumber();
}

/** Percentage helper: safe when the denominator is zero. Returns null for N/A. */
export function pct(numerator: MoneyInput, denominator: MoneyInput): number | null {
  const d = D(denominator);
  if (d.isZero()) return null;
  return D(numerator).div(d).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** Ratio helper returning null when the denominator is zero. */
export function ratio(numerator: MoneyInput, denominator: MoneyInput): number | null {
  const d = D(denominator);
  if (d.isZero()) return null;
  return D(numerator).div(d).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

export function maxZero(v: MoneyInput): number {
  const d = D(v);
  return d.isNegative() ? 0 : round2(d);
}

export function negate(v: MoneyInput): number {
  return D(v).negated().toNumber();
}

export interface FormatMoneyOptions {
  currency?: string;
  /** Force sign display, e.g. "+$120.00" */
  signed?: boolean;
  /** Compact for large dashboard numbers: $1.2k */
  compact?: boolean;
  locale?: string;
  /** Hide decimals for whole dashboard tiles */
  maximumFractionDigits?: number;
}

export function formatMoney(value: MoneyInput, opts: FormatMoneyOptions = {}): string {
  const {
    currency = "USD",
    signed = false,
    compact = false,
    locale,
    maximumFractionDigits = 2,
  } = opts;
  const n = toNum(value);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits,
      minimumFractionDigits: compact ? 0 : maximumFractionDigits === 0 ? 0 : 2,
      signDisplay: signed ? "exceptZero" : "auto",
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(maximumFractionDigits)}`;
  }
}

export function formatNumber(value: MoneyInput, digits = 0): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(toNum(value));
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(digits)}%`;
}

/** Currency symbols for the supported display currencies. */
export const CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "KES", "ZAR", "CAD", "AUD", "INR", "AED", "GHS", "JPY",
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** Simple FX table is intentionally NOT bundled — multi-currency totals must be explicit. */
export function groupByCurrency<T>(
  rows: T[],
  currencyOf: (row: T) => string,
  amountOf: (row: T) => MoneyInput,
): { currency: string; total: number }[] {
  const map = new Map<string, Decimal>();
  for (const r of rows) {
    const c = currencyOf(r) || "USD";
    map.set(c, (map.get(c) ?? new Decimal(0)).plus(D(amountOf(r))));
  }
  return [...map.entries()].map(([currency, total]) => ({ currency, total: round2(total) }));
}
