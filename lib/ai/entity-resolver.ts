/**
 * Gridhub AI — entity and date resolution.
 *
 * The model is never trusted with record ids. It names things ("Groceries", "the credit card") and
 * this module maps those names onto the customer's own records, refusing to guess when more than
 * one record matches.
 */

export type ResolveResult<T> =
  | { status: "match"; record: T }
  | { status: "ambiguous"; candidates: T[] }
  | { status: "none" };

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveByName<T extends { id: string }>(
  records: T[],
  query: string,
  getName: (record: T) => string,
): ResolveResult<T> {
  const q = normalizeName(query);
  if (!q) return { status: "none" };

  const scored: Array<{ record: T; score: number }> = [];
  for (const record of records) {
    const name = normalizeName(getName(record));
    if (!name) continue;
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (q.includes(name) && name.length >= 3) score = 50;
    if (score > 0) scored.push({ record, score });
  }

  if (!scored.length) return { status: "none" };

  const best = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === best).map((s) => s.record);
  if (top.length === 1) return { status: "match", record: top[0] };
  return { status: "ambiguous", candidates: top.slice(0, 5) };
}

function shiftDay(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function validDate(y: number, m: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject overflow (Feb 31) rather than silently rolling into March.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function monthIndex(word: string): number | null {
  const w = word.replace(/\.$/, "");
  if (w.length < 3) return null;
  const idx = MONTHS.findIndex((m) => m.startsWith(w.slice(0, 3)));
  return idx >= 0 ? idx + 1 : null;
}

/**
 * Resolves a model-supplied date into `YYYY-MM-DD` in the user's configured day.
 *
 * Returns `null` when a date *was* supplied but could not be understood, so the caller can ask
 * instead of guessing. An omitted date still means today — that is a legitimate default, and
 * conflating the two is what previously let "the 3rd" silently book an expense today.
 *
 * All arithmetic goes through `Date.UTC`, never `new Date(string).toISOString()`: the latter
 * converts local midnight to UTC and lands on the previous day for anyone east of Greenwich.
 */
export function resolveDate(input: string | undefined, today: string): string | null {
  if (!input) return today;

  const v = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return today;

  const [y, m, d] = today.split("-").map(Number);

  if (/^(today|now|tonight|this morning|this afternoon|this evening)$/.test(v)) return today;
  if (/^(yesterday|last night)$/.test(v)) return shiftDay(today, -1);
  if (/^tomorrow$/.test(v)) return shiftDay(today, 1);

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [yy, mm, dd] = v.split("-").map(Number);
    return validDate(yy, mm, dd);
  }

  // Weekday: "friday", "last friday", "next friday".
  const weekday = v.match(/^(?:(last|next|this)\s+)?([a-z]+)$/);
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[2]);
    if (target >= 0) {
      const todayIdx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const back = (todayIdx - target + 7) % 7;
      const forward = (target - todayIdx + 7) % 7;
      if (weekday[1] === "next") return shiftDay(today, forward === 0 ? 7 : forward);
      if (weekday[1] === "last") return shiftDay(today, back === 0 ? -7 : -back);
      // Bare or "this": the most recent occurrence, including today. The confirmation card shows
      // the resolved date, so a wrong guess is visible before anything is saved.
      return shiftDay(today, -back);
    }
  }

  // Ordinal day of the current month: "the 3rd", "on the 3rd", "3rd".
  const ordinal = v.match(/^(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)$/);
  if (ordinal) return validDate(y, m, Number(ordinal[1]));

  // Numeric M/D, M/D/YYYY (also accepts a dash). US order by default; a first number above 12
  // can only be a day, so D/M is inferred from the data rather than from a locale setting.
  const numeric = v.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const year = numeric[3]
      ? numeric[3].length === 2
        ? 2000 + Number(numeric[3])
        : Number(numeric[3])
      : y;
    return validDate(year, month, day);
  }

  // "Oct 3", "October 3, 2026", "3 Oct".
  const monthFirst = v.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/);
  if (monthFirst) {
    const month = monthIndex(monthFirst[1]);
    if (month) return validDate(monthFirst[3] ? Number(monthFirst[3]) : y, month, Number(monthFirst[2]));
  }
  const dayFirst = v.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:,?\s+(\d{4}))?$/);
  if (dayFirst) {
    const month = monthIndex(dayFirst[2]);
    if (month) return validDate(dayFirst[3] ? Number(dayFirst[3]) : y, month, Number(dayFirst[1]));
  }

  return null;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Resolves a period phrase into `YYYY-MM`, `YYYY`, or `all` for the calculation services. */
export function resolvePeriod(input: string | undefined, today: string): string {
  const v = (input ?? "").trim().toLowerCase();
  const thisMonth = today.slice(0, 7);
  const thisYear = today.slice(0, 4);

  if (!v || v === "this month" || v === "current month" || v === "month") return thisMonth;
  if (v === "last month" || v === "previous month") {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  }
  if (v === "this year" || v === "current year" || v === "year") return thisYear;
  if (v === "last year" || v === "previous year") return String(Number(thisYear) - 1);
  if (v === "all" || v === "all time" || v === "everything") return "all";
  if (/^\d{4}-\d{2}$/.test(v)) return v;
  if (/^\d{4}$/.test(v)) return v;

  const idx = MONTHS.findIndex((m) => v.startsWith(m.slice(0, 3)));
  if (idx >= 0) return `${thisYear}-${String(idx + 1).padStart(2, "0")}`;

  return thisMonth;
}
