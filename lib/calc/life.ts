import { D, pct, round2, sumBy, toNum } from "../money";
import type {
  NutritionFood,
  NutritionLog,
  NutritionRecipe,
  PropertyBooking,
  PropertyExpense,
  PropertyMaintenance,
  RecipeIngredient,
  WeddingExpense,
  WeddingGuest,
  WeddingPayment,
  WeddingTable,
  WeddingVendor,
} from "../types";

/* ==========================================================================
   LIFE TOOL 11 — Wedding planner
   ========================================================================== */

export interface WeddingSummary {
  totalBudget: number;
  actualExpenses: number;
  committed: number;
  paid: number;
  budgetRemaining: number;
  committedRemaining: number;
  overBudget: boolean;
  daysUntil: number;
  guestSeatsInvited: number;
  guestSeatsAccepted: number;
  acceptanceRate: number | null;
  declined: number;
  tentative: number;
  vendorOutstanding: number;
  byCategory: { category: string; committed: number; actual: number; paid: number }[];
  tableCapacity: number;
  seated: number;
  unseated: number;
  seatingWarnings: string[];
}

export function weddingSummary(input: {
  eventDate: string;
  totalBudget: number;
  expenses: WeddingExpense[];
  guests: WeddingGuest[];
  vendors: WeddingVendor[];
  payments: WeddingPayment[];
  tables: WeddingTable[];
  today?: string;
}): WeddingSummary {
  const expenses = input.expenses.filter((e) => !e.deleted);
  const actual = round2(sumBy(expenses, (e) => e.actual));
  const committed = round2(sumBy(expenses, (e) => e.committed));
  const paid = round2(sumBy(expenses, (e) => e.paid));
  const totalBudget = toNum(input.totalBudget);

  const guests = input.guests.filter((g) => !g.deleted);
  const seats = (list: WeddingGuest[]) => round2(sumBy(list, (g) => g.seats || 1));
  const invited = seats(guests);
  const accepted = seats(guests.filter((g) => g.rsvp === "accepted"));
  const declined = seats(guests.filter((g) => g.rsvp === "declined"));
  const tentative = seats(guests.filter((g) => g.rsvp === "tentative"));

  const vendors = input.vendors.filter((v) => !v.deleted);
  const payments = input.payments.filter((p) => !p.deleted);
  const contracted = round2(sumBy(vendors, (v) => v.contractedAmount));
  const vendorPaid = round2(sumBy(payments, (p) => p.amount));

  const tables = input.tables.filter((t) => !t.deleted);
  const capacity = tables.reduce((acc, t) => acc + toNum(t.capacity), 0);
  const seated = round2(
    sumBy(
      guests.filter((g) => g.tableId && g.rsvp !== "declined"),
      (g) => g.seats || 1,
    ),
  );

  const seatingWarnings: string[] = [];
  for (const table of tables) {
    const occupancy = round2(
      sumBy(
        guests.filter((g) => g.tableId === table.id && g.rsvp !== "declined"),
        (g) => g.seats || 1,
      ),
    );
    if (occupancy > table.capacity) {
      seatingWarnings.push(`${table.name} is over capacity (${occupancy}/${table.capacity}).`);
    }
  }
  if (seated > capacity && capacity > 0) {
    seatingWarnings.push(`Total seated guests (${seated}) exceed total capacity (${capacity}).`);
  }

  const catMap = new Map<string, { committed: number; actual: number; paid: number }>();
  for (const e of expenses) {
    const prev = catMap.get(e.category) ?? { committed: 0, actual: 0, paid: 0 };
    prev.committed = round2(D(prev.committed).plus(e.committed));
    prev.actual = round2(D(prev.actual).plus(e.actual));
    prev.paid = round2(D(prev.paid).plus(e.paid));
    catMap.set(e.category, prev);
  }

  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const daysUntil = Math.round(
    (new Date(`${input.eventDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) /
      86_400_000,
  );

  return {
    totalBudget,
    actualExpenses: actual,
    committed,
    paid,
    budgetRemaining: round2(D(totalBudget).minus(actual)),
    committedRemaining: round2(D(totalBudget).minus(committed)),
    overBudget: actual > totalBudget,
    daysUntil,
    guestSeatsInvited: invited,
    guestSeatsAccepted: accepted,
    acceptanceRate: invited > 0 ? pct(accepted, invited) : null,
    declined,
    tentative,
    vendorOutstanding: round2(D(contracted).minus(vendorPaid)),
    byCategory: [...catMap.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.committed - a.committed),
    tableCapacity: capacity,
    seated,
    unseated: round2(Math.max(0, toNum(D(accepted).minus(seated)))),
    seatingWarnings,
  };
}

export function vendorBalance(vendor: WeddingVendor, payments: WeddingPayment[]): number {
  const paid = sumBy(
    payments.filter((p) => !p.deleted && p.vendorId === vendor.id),
    (p) => p.amount,
  );
  return round2(D(vendor.contractedAmount).minus(paid));
}

/* ==========================================================================
   LIFE TOOL 12 — Rental property
   ========================================================================== */

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** True when two stays in the same unit share any night. */
export function bookingsOverlap(a: PropertyBooking, b: PropertyBooking): boolean {
  if (a.unitId !== b.unitId) return false;
  if (a.status === "cancelled" || b.status === "cancelled") return false;
  return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
}

export function findOverlaps(bookings: PropertyBooking[]): [PropertyBooking, PropertyBooking][] {
  const live = bookings.filter((b) => !b.deleted);
  const out: [PropertyBooking, PropertyBooking][] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      if (bookingsOverlap(live[i], live[j])) out.push([live[i], live[j]]);
    }
  }
  return out;
}

export interface PropertySummary {
  grossRevenue: number;
  accommodationRevenue: number;
  fees: number;
  cleaning: number;
  operatingExpenses: number;
  maintenance: number;
  netOperatingIncome: number;
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number | null;
  adr: number | null;
  revPan: number | null;
  bookings: number;
  paidRevenue: number;
  unpaidRevenue: number;
  overlaps: [PropertyBooking, PropertyBooking][];
}

export function propertySummary(input: {
  bookings: PropertyBooking[];
  expenses: PropertyExpense[];
  maintenance: PropertyMaintenance[];
  availableNights: number;
  propertyId?: string;
  period?: string;
}): PropertySummary {
  const bookings = input.bookings.filter(
    (b) =>
      !b.deleted &&
      b.status !== "cancelled" &&
      (!input.propertyId || b.propertyId === input.propertyId) &&
      (!input.period || b.checkIn.startsWith(input.period)),
  );
  const expenses = input.expenses.filter(
    (e) => !e.deleted && (!input.propertyId || e.propertyId === input.propertyId) && (!input.period || e.date.startsWith(input.period)),
  );
  const maintenance = input.maintenance.filter(
    (m) => !m.deleted && (!input.propertyId || m.propertyId === input.propertyId) && (!input.period || m.date.startsWith(input.period)),
  );

  const accommodationRevenue = round2(sumBy(bookings, (b) => b.accommodation));
  const platformFees = round2(sumBy(bookings, (b) => b.platformFee));
  const cleaningFees = round2(sumBy(bookings, (b) => b.cleaningFee));
  const otherExpenses = round2(sumBy(expenses, (e) => e.amount));
  const maintenanceCost = round2(sumBy(maintenance, (m) => m.cost));
  const operatingExpenses = round2(D(platformFees).plus(cleaningFees).plus(otherExpenses).plus(maintenanceCost));

  const occupiedNights = bookings.reduce((acc, b) => acc + (b.nights || nightsBetween(b.checkIn, b.checkOut)), 0);
  const available = input.availableNights > 0 ? input.availableNights : 0;

  return {
    grossRevenue: round2(D(accommodationRevenue).plus(cleaningFees)),
    accommodationRevenue,
    fees: platformFees,
    cleaning: cleaningFees,
    operatingExpenses,
    maintenance: maintenanceCost,
    netOperatingIncome: round2(D(accommodationRevenue).plus(cleaningFees).minus(operatingExpenses)),
    occupiedNights,
    availableNights: available,
    occupancyRate: available > 0 ? pct(occupiedNights, available) : null,
    adr: occupiedNights > 0 ? round2(D(accommodationRevenue).div(occupiedNights)) : null,
    revPan: available > 0 ? round2(D(accommodationRevenue).div(available)) : null,
    bookings: bookings.length,
    paidRevenue: round2(sumBy(bookings.filter((b) => b.paid), (b) => D(b.accommodation).plus(b.cleaningFee))),
    unpaidRevenue: round2(sumBy(bookings.filter((b) => !b.paid), (b) => D(b.accommodation).plus(b.cleaningFee))),
    overlaps: findOverlaps(bookings),
  };
}

/* ==========================================================================
   LIFE TOOL 13 — Nutrition
   ========================================================================== */

export interface MacroSet {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const ZERO_MACROS: MacroSet = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/** Scale a per-100g food to a consumed weight. */
export function scaleFood(food: Pick<NutritionFood, "kcal" | "protein" | "carbs" | "fat" | "fiber">, grams: number): MacroSet {
  const factor = D(grams).div(100);
  return {
    kcal: round2(D(food.kcal).times(factor)),
    protein: round2(D(food.protein).times(factor)),
    carbs: round2(D(food.carbs).times(factor)),
    fat: round2(D(food.fat).times(factor)),
    fiber: round2(D(food.fiber ?? 0).times(factor)),
  };
}

export function sumMacros(items: Partial<MacroSet>[]): MacroSet {
  return {
    kcal: round2(sumBy(items, (i) => i.kcal ?? 0)),
    protein: round2(sumBy(items, (i) => i.protein ?? 0)),
    carbs: round2(sumBy(items, (i) => i.carbs ?? 0)),
    fat: round2(sumBy(items, (i) => i.fat ?? 0)),
    fiber: round2(sumBy(items, (i) => i.fiber ?? 0)),
  };
}

export function logsForDate(logs: NutritionLog[], date: string): NutritionLog[] {
  return logs.filter((l) => !l.deleted && l.date === date);
}

export function dailyTotals(logs: NutritionLog[], date: string): MacroSet & { entries: number } {
  const day = logsForDate(logs, date);
  return { ...sumMacros(day), entries: day.length };
}

export function mealTotals(logs: NutritionLog[], date: string) {
  const meals: NutritionLog["meal"][] = ["breakfast", "lunch", "dinner", "snack"];
  return meals.map((meal) => ({
    meal,
    ...sumMacros(logsForDate(logs, date).filter((l) => l.meal === meal)),
  }));
}

export function recipeMacros(recipe: NutritionRecipe, ingredients: RecipeIngredient[]) {
  const total = sumMacros(ingredients);
  const servings = Math.max(1, toNum(recipe.servings));
  return {
    total,
    perServing: {
      kcal: round2(D(total.kcal).div(servings)),
      protein: round2(D(total.protein).div(servings)),
      carbs: round2(D(total.carbs).div(servings)),
      fat: round2(D(total.fat).div(servings)),
      fiber: round2(D(total.fiber).div(servings)),
    },
    servings,
  };
}

/** Macro split by energy contribution — used only for display, never as advice. */
export function macroSplit(m: MacroSet): { protein: number | null; carbs: number | null; fat: number | null } {
  const pCal = D(m.protein).times(4);
  const cCal = D(m.carbs).times(4);
  const fCal = D(m.fat).times(9);
  const total = pCal.plus(cCal).plus(fCal);
  if (total.isZero()) return { protein: null, carbs: null, fat: null };
  return {
    protein: pct(pCal, total),
    carbs: pct(cCal, total),
    fat: pct(fCal, total),
  };
}
