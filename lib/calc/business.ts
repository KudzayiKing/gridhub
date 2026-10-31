import { D, pct, round2, sumBy, toNum } from "../money";
import type {
  BusinessTransaction,
  CashForecastItem,
  CashScenario,
  InventoryMovement,
  Invoice,
  Payment,
  BusinessProduct,
  Sale,
  SalesTarget,
} from "../types";

/* ==========================================================================
   BUSINESS TOOL 6 — Bookkeeping (cash basis)
   ========================================================================== */

export interface BookkeepingSummary {
  cashRevenue: number;
  operatingExpenses: number;
  operatingSurplus: number;
  expenseRatio: number | null;
  inflows: number;
  outflows: number;
  cashMovement: number;
  ownerContributions: number;
  ownerDraws: number;
  loanProceeds: number;
  loanRepayments: number;
  transfers: number;
  byCategory: { categoryId: string; revenue: number; expenses: number }[];
}

/**
 * Cash-basis model: revenue is recognised when money is received, expenses when paid.
 * Owner contributions, draws, loan proceeds and loan repayments are cash movements but
 * are NOT revenue or operating expenses.
 */
export function bookkeepingSummary(
  txs: BusinessTransaction[],
  period?: string,
): BookkeepingSummary {
  const live = txs.filter((t) => !t.deleted);
  const inPeriod = period
    ? live.filter((t) => (period.length === 4 ? t.date.startsWith(period) : t.date.startsWith(period)))
    : live;

  const of = (type: BusinessTransaction["type"]) => inPeriod.filter((t) => t.type === type);

  const cashRevenue = round2(sumBy(of("revenue"), (t) => t.amount));
  const operatingExpenses = round2(sumBy(of("expense"), (t) => t.amount));
  const ownerContributions = round2(sumBy(of("owner_contribution"), (t) => t.amount));
  const ownerDraws = round2(sumBy(of("owner_draw"), (t) => t.amount));
  const loanProceeds = round2(sumBy(of("loan_proceeds"), (t) => t.amount));
  const loanRepayments = round2(sumBy(of("loan_repayment"), (t) => t.amount));
  const transfers = round2(sumBy(of("transfer"), (t) => t.amount));

  const inflows = round2(
    D(cashRevenue).plus(ownerContributions).plus(loanProceeds),
  );
  const outflows = round2(D(operatingExpenses).plus(ownerDraws).plus(loanRepayments));

  const catMap = new Map<string, { revenue: number; expenses: number }>();
  for (const t of inPeriod) {
    if (t.type !== "revenue" && t.type !== "expense") continue;
    const key = t.categoryId || "uncategorized";
    const prev = catMap.get(key) ?? { revenue: 0, expenses: 0 };
    if (t.type === "revenue") prev.revenue = round2(D(prev.revenue).plus(t.amount));
    else prev.expenses = round2(D(prev.expenses).plus(t.amount));
    catMap.set(key, prev);
  }

  return {
    cashRevenue,
    operatingExpenses,
    operatingSurplus: round2(D(cashRevenue).minus(operatingExpenses)),
    expenseRatio: cashRevenue > 0 ? pct(operatingExpenses, cashRevenue) : null,
    inflows,
    outflows,
    cashMovement: round2(D(inflows).minus(outflows)),
    ownerContributions,
    ownerDraws,
    loanProceeds,
    loanRepayments,
    transfers,
    byCategory: [...catMap.entries()].map(([categoryId, v]) => ({ categoryId, ...v })),
  };
}

/* ==========================================================================
   BUSINESS TOOL 7 — Inventory (moving weighted-average cost)
   ========================================================================== */

export interface ProductValuation {
  productId: string;
  quantity: number;
  averageCost: number;
  inventoryValue: number;
  retailValue: number;
  grossProfitPerUnit: number;
  grossMarginPct: number | null;
  lowStock: boolean;
  /** Signed quantity for display. */
  unitsOut: number;
}

const IN_TYPES: InventoryMovement["type"][] = ["receipt", "return", "adjustment_positive"];
const OUT_TYPES: InventoryMovement["type"][] = ["dispatch", "writeoff", "adjustment_negative"];

export function signedQty(m: InventoryMovement): number {
  if (IN_TYPES.includes(m.type)) return Math.abs(toNum(m.quantity));
  if (OUT_TYPES.includes(m.type)) return -Math.abs(toNum(m.quantity));
  return 0;
}

/**
 * Replays movements in date order to derive quantity on hand and the moving
 * weighted-average unit cost. Receipts re-average; issues leave the average unchanged.
 */
export function valuationForProduct(
  product: Pick<BusinessProduct, "id" | "salePrice" | "unitCost" | "reorderThreshold" | "quantity">,
  movements: InventoryMovement[],
  openingQuantity = 0,
): ProductValuation {
  const moves = movements
    .filter((m) => !m.deleted && m.productId === product.id)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let qty = openingQuantity;
  let avg = toNum(product.unitCost);

  for (const m of moves) {
    const q = Math.abs(toNum(m.quantity));
    if (IN_TYPES.includes(m.type)) {
      const cost = m.unitCost !== undefined && m.unitCost !== null ? toNum(m.unitCost) : avg;
      const newQty = qty + q;
      avg = newQty > 0 ? round2(D(qty).times(avg).plus(D(q).times(cost)).div(newQty)) : cost;
      qty = newQty;
    } else {
      qty = Math.max(0, qty - q);
    }
  }

  const salePrice = toNum(product.salePrice);
  const grossProfitPerUnit = round2(D(salePrice).minus(avg));

  return {
    productId: product.id,
    quantity: round2(qty),
    averageCost: round2(avg),
    inventoryValue: round2(D(qty).times(avg)),
    retailValue: round2(D(qty).times(salePrice)),
    grossProfitPerUnit,
    grossMarginPct: salePrice > 0 ? pct(grossProfitPerUnit, salePrice) : null,
    lowStock: qty <= toNum(product.reorderThreshold),
    unitsOut: round2(
      sumBy(
        moves.filter((m) => OUT_TYPES.includes(m.type)),
        (m) => Math.abs(toNum(m.quantity)),
      ),
    ),
  };
}

export function inventorySummary(products: BusinessProduct[], movements: InventoryMovement[]) {
  const valuations = products
    .filter((p) => !p.deleted)
    .map((p) => ({ product: p, valuation: valuationForProduct(p, movements, p.quantity) }));
  return {
    items: valuations,
    totalUnits: round2(sumBy(valuations, (v) => v.valuation.quantity)),
    inventoryValue: round2(sumBy(valuations, (v) => v.valuation.inventoryValue)),
    retailValue: round2(sumBy(valuations, (v) => v.valuation.retailValue)),
    lowStock: valuations.filter((v) => v.valuation.lowStock),
    productCount: valuations.length,
  };
}

/* ==========================================================================
   BUSINESS TOOL 8 — Sales
   ========================================================================== */

export interface SaleLineTotals {
  gross: number;
  discounts: number;
  returns: number;
  tax: number;
  net: number;
  total: number;
}

export function saleTotals(sale: Pick<Sale, "quantity" | "unitPrice" | "discount" | "returned" | "taxRate">): SaleLineTotals {
  const gross = round2(D(sale.quantity).times(sale.unitPrice));
  const discounts = round2(sale.discount);
  const returns = round2(sale.returned);
  const net = round2(D(gross).minus(discounts).minus(returns));
  const tax = round2(D(net).times(D(sale.taxRate).div(100)));
  return { gross, discounts, returns, tax, net, total: round2(D(net).plus(tax)) };
}

export interface SalesSummary {
  gross: number;
  net: number;
  tax: number;
  orders: number;
  averageOrderValue: number | null;
  unitsSold: number;
  target: number;
  targetProgress: number | null;
  growth: number | null;
  priorNet: number;
  byProduct: { productId: string; label: string; net: number; units: number }[];
  byMonth: { month: string; net: number }[];
  /** Revenue already invoiced through the Invoicing tool. */
  invoicedRevenue: number;
  collectedRevenue: number;
}

export function salesSummary(
  sales: Sale[],
  targets: SalesTarget[],
  opts: { period?: string; priorPeriod?: string } = {},
): SalesSummary {
  const live = sales.filter((s) => !s.deleted);
  const inPeriod = opts.period ? live.filter((s) => s.date.startsWith(opts.period!)) : live;

  const totals = inPeriod.map((s) => ({ sale: s, totals: saleTotals(s) }));
  const net = round2(sumBy(totals, (t) => t.totals.net));
  const gross = round2(sumBy(totals, (t) => t.totals.gross));
  const tax = round2(sumBy(totals, (t) => t.totals.tax));

  const target = opts.period
    ? round2(sumBy(targets.filter((t) => !t.deleted && t.period === opts.period), (t) => t.target))
    : 0;

  const prior = opts.priorPeriod ? live.filter((s) => s.date.startsWith(opts.priorPeriod!)) : [];
  const priorNet = round2(sumBy(prior.map((s) => saleTotals(s)), (t) => t.net));

  const byProductMap = new Map<string, { label: string; net: number; units: number }>();
  for (const { sale, totals: tt } of totals) {
    const key = sale.productId || "unassigned";
    const prev = byProductMap.get(key) ?? { label: sale.description || "Unassigned", net: 0, units: 0 };
    prev.net = round2(D(prev.net).plus(tt.net));
    prev.units = round2(D(prev.units).plus(sale.quantity));
    byProductMap.set(key, prev);
  }

  const byMonthMap = new Map<string, number>();
  for (const { sale, totals: tt } of totals) {
    const m = sale.date.slice(0, 7);
    byMonthMap.set(m, round2(D(byMonthMap.get(m) ?? 0).plus(tt.net)));
  }

  return {
    gross,
    net,
    tax,
    orders: inPeriod.length,
    averageOrderValue: inPeriod.length > 0 ? round2(D(net).div(inPeriod.length)) : null,
    unitsSold: round2(sumBy(inPeriod, (s) => s.quantity)),
    target,
    targetProgress: target > 0 ? pct(net, target) : null,
    growth: priorNet !== 0 ? round2(D(net).minus(priorNet).div(Math.abs(priorNet)).times(100)) : null,
    priorNet,
    byProduct: [...byProductMap.entries()]
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.net - a.net),
    byMonth: [...byMonthMap.entries()].map(([month, v]) => ({ month, net: v })).sort((a, b) => a.month.localeCompare(b.month)),
    invoicedRevenue: round2(sumBy(inPeriod.filter((s) => s.status === "invoiced" || s.status === "paid"), (s) => saleTotals(s).net)),
    collectedRevenue: round2(sumBy(inPeriod.filter((s) => s.status === "paid"), (s) => saleTotals(s).net)),
  };
}

/* ==========================================================================
   BUSINESS TOOL 9 — Invoicing
   ========================================================================== */

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  paid: number;
  balanceDue: number;
  overdueDays: number;
  isOverdue: boolean;
  status: Invoice["status"];
}

/**
 * Rounding rules:
 * - each line total is rounded to 2dp
 * - subtotal is the sum of rounded line totals
 * - discount is applied to the subtotal before tax
 * - tax is rounded to 2dp on the taxable amount
 */
export function invoiceTotals(
  invoice: Pick<Invoice, "lines" | "discount" | "taxRate" | "issueDate" | "dueDate" | "status">,
  payments: Payment[],
  today = new Date().toISOString().slice(0, 10),
): InvoiceTotals {
  const lineTotals = invoice.lines.map((l) => round2(D(l.quantity).times(l.unitPrice)));
  const subtotal = round2(sumBy(lineTotals, (v) => v));
  const discount = round2(Math.min(invoice.discount || 0, subtotal));
  const taxable = round2(D(subtotal).minus(discount));
  const tax = round2(D(taxable).times(D(invoice.taxRate || 0).div(100)));
  const total = round2(D(taxable).plus(tax));
  const paid = round2(sumBy(payments.filter((p) => !p.deleted), (p) => p.amount));
  const balanceDue = round2(D(total).minus(paid));

  const due = new Date(`${invoice.dueDate}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  const overdueDays = Math.max(0, Math.round((now - due) / 86_400_000));
  const isOverdue = balanceDue > 0.004 && overdueDays > 0 && invoice.status !== "void" && invoice.status !== "draft";

  let status: Invoice["status"] = invoice.status;
  if (invoice.status !== "void" && invoice.status !== "draft") {
    if (balanceDue <= 0.004 && total > 0) status = "paid";
    else if (paid > 0) status = "partial";
    else status = "sent";
  }

  return { subtotal, discount, taxable, tax, total, paid, balanceDue, overdueDays, isOverdue, status };
}

export function invoicingSummary(invoices: Invoice[], payments: Payment[], today?: string) {
  const rows = invoices
    .filter((i) => !i.deleted)
    .map((inv) => ({
      invoice: inv,
      totals: invoiceTotals(
        inv,
        payments.filter((p) => p.invoiceId === inv.id),
        today,
      ),
    }));

  const issued = rows.filter((r) => r.invoice.status !== "draft" && r.invoice.status !== "void");
  return {
    rows,
    outstanding: round2(sumBy(issued, (r) => Math.max(0, r.totals.balanceDue))),
    overdue: rows.filter((r) => r.totals.isOverdue),
    overdueAmount: round2(sumBy(rows.filter((r) => r.totals.isOverdue), (r) => Math.max(0, r.totals.balanceDue))),
    paidThisPeriod: round2(sumBy(payments.filter((p) => !p.deleted), (p) => p.amount)),
    draftCount: rows.filter((r) => r.invoice.status === "draft").length,
  };
}

export function nextInvoiceNumber(existing: Invoice[]): string {
  const nums = existing
    .map((i) => Number((i.number.match(/(\d+)$/) ?? [])[1] ?? 0))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `INV-${String(next).padStart(4, "0")}`;
}

/* ==========================================================================
   BUSINESS TOOL 10 — Cash flow forecast
   ========================================================================== */

export interface ForecastWeek {
  week: number;
  label: string;
  inflows: number;
  outflows: number;
  net: number;
  closing: number;
  shortfall: number;
}

export interface ForecastResult {
  weeks: ForecastWeek[];
  closingCash: number;
  netFlow: number;
  lowestCash: number;
  shortfall: number;
  runwayMonths: number | null;
  recurringBurn: number;
}

const CERTAINTY_WEIGHT: Record<CashForecastItem["certainty"], number> = {
  committed: 1,
  likely: 0.9,
  possible: 0.6,
};

export function forecastCashFlow(
  items: CashForecastItem[],
  scenario: Pick<CashScenario, "openingCash" | "minimumCash">,
  opts: {
    weeks?: number;
    mode?: "base" | "optimistic" | "conservative";
    recurringWeeklyBurn?: number;
    startDate?: string;
  } = {},
): ForecastResult {
  const weeks = opts.weeks ?? 13;
  const mode = opts.mode ?? "base";
  const live = items.filter((i) => !i.deleted);
  const start = opts.startDate ? new Date(`${opts.startDate}T00:00:00`) : new Date();

  const weightFor = (i: CashForecastItem) => {
    if (i.certainty === "committed") return 1;
    if (mode === "optimistic") return 1;
    if (mode === "conservative") return i.certainty === "likely" ? 0.8 : 0.35;
    return CERTAINTY_WEIGHT[i.certainty];
  };

  let cash = toNum(scenario.openingCash);
  const rows: ForecastWeek[] = [];

  for (let w = 0; w < weeks; w++) {
    const inWeek = live.filter((i) => i.week === w);
    const inflows = round2(
      sumBy(inWeek.filter((i) => i.kind === "inflow"), (i) => D(i.amount).times(weightFor(i))),
    );
    const outflows = round2(
      sumBy(inWeek.filter((i) => i.kind === "outflow"), (i) => D(i.amount).times(weightFor(i))),
    );
    const net = round2(D(inflows).minus(outflows));
    cash = round2(D(cash).plus(net));
    const d = new Date(start);
    d.setDate(d.getDate() + w * 7);
    rows.push({
      week: w,
      label: d.toISOString().slice(0, 10),
      inflows,
      outflows,
      net,
      closing: cash,
      shortfall: Math.max(0, round2(D(scenario.minimumCash).minus(cash))),
    });
  }

  const recurringBurn = opts.recurringWeeklyBurn ?? 0;
  return {
    weeks: rows,
    closingCash: cash,
    netFlow: round2(sumBy(rows, (r) => r.net)),
    lowestCash: Math.min(...rows.map((r) => r.closing), toNum(scenario.openingCash)),
    shortfall: Math.max(...rows.map((r) => r.shortfall), 0),
    runwayMonths:
      recurringBurn > 0 ? round2(D(scenario.openingCash).div(D(recurringBurn).times(4.333))) : null,
    recurringBurn,
  };
}
