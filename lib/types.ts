import type { ToolId } from "./catalog";

/** Base shape for every locally-stored record. */
export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Soft delete — records are never hard-deleted from the local store. */
  deleted?: boolean;
  /** Monotonic version used for conflict detection during sync. */
  version?: number;
}

export type TxType = "income" | "expense" | "transfer" | "savings";
export type TxStatus = "posted" | "pending";

/* ------------------------------- MONEY ---------------------------------- */

export interface MoneyAccount extends BaseRecord {
  name: string;
  kind: "checking" | "savings" | "cash" | "credit" | "investment";
  openingBalance: number;
  currency: string;
}

export interface MoneyCategory extends BaseRecord {
  name: string;
  kind: "income" | "expense";
  group?: string;
  monthlyBudget?: number;
}

export interface MoneyTransaction extends BaseRecord {
  date: string;
  description: string;
  /** Positive magnitude. Direction comes from `type`. */
  amount: number;
  currency: string;
  type: TxType;
  categoryId?: string;
  accountId?: string;
  /** Destination account for transfers. */
  toAccountId?: string;
  notes?: string;
  status: TxStatus;
  /** Links a savings transfer to a goal, so contributions are not double counted. */
  goalId?: string;
  /** Optional link to a debt payment. */
  debtId?: string;
}

export interface MoneyBudget extends BaseRecord {
  /** YYYY-MM */
  month: string;
  categoryId: string;
  amount: number;
}

export interface RecurringBill extends BaseRecord {
  name: string;
  amount: number;
  dueDay: number;
  categoryId?: string;
  accountId?: string;
  frequency: "monthly" | "weekly" | "annual";
  active: boolean;
}

export interface PaySchedule extends BaseRecord {
  name: string;
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
  nextPayDate: string;
  expectedAmount: number;
  currency: string;
}

export interface Paycheck extends BaseRecord {
  date: string;
  expectedAmount: number;
  actualAmount?: number;
  scheduleId?: string;
  /** Amount moved to savings from this paycheck. */
  savingsAllocation?: number;
  notes?: string;
}

export interface PaycheckAllocation extends BaseRecord {
  paycheckId: string;
  label: string;
  amount: number;
  kind: "bill" | "spending" | "savings";
  /** Set when the planned bill has actually been paid. */
  paidTransactionId?: string;
  paid?: boolean;
}

export interface Debt extends BaseRecord {
  name: string;
  openingPrincipal: number;
  /** Annual nominal rate, e.g. 19.99 */
  annualRate: number;
  minimumPayment: number;
  extraPayment: number;
  currency: string;
  /** Compounding / payment cadence. */
  frequency: "monthly" | "biweekly";
  notes?: string;
}

export interface DebtPayment extends BaseRecord {
  debtId: string;
  date: string;
  amount: number;
  principal?: number;
  interest?: number;
  fees?: number;
  /** Optional link to a budget transaction for the same cash outflow. */
  transactionId?: string;
}

export interface SavingsGoal extends BaseRecord {
  name: string;
  targetAmount: number;
  targetDate?: string;
  openingBalance: number;
  currency: string;
  kind: "goal" | "emergency";
  /** Monthly essential expenses, used for emergency-fund cover. */
  monthlyEssentials?: number;
}

export interface GoalMovement extends BaseRecord {
  goalId: string;
  date: string;
  amount: number;
  kind: "contribution" | "withdrawal";
  note?: string;
  /** Link to a budget transaction when the movement also moves real cash. */
  transactionId?: string;
}

export interface NetWorthItem extends BaseRecord {
  name: string;
  kind: "asset" | "liability";
  category: string;
  value: number;
  currency: string;
  valuationDate: string;
}

export interface Holding extends BaseRecord {
  name: string;
  symbol?: string;
  quantity: number;
  unitPrice: number;
  costBasis: number;
  currency: string;
  valuationDate: string;
  priceSource: "manual" | "import";
}

export interface ValuationSnapshot extends BaseRecord {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  currency: string;
  note?: string;
}

/* ------------------------------ BUSINESS -------------------------------- */

export interface Business extends BaseRecord {
  name: string;
  currency: string;
  fiscalYearStart: number;
}

export interface BusinessAccount extends BaseRecord {
  name: string;
  kind: "bank" | "cash" | "card";
  openingBalance: number;
}

export type BusinessTxType =
  | "revenue"
  | "expense"
  | "owner_contribution"
  | "owner_draw"
  | "loan_proceeds"
  | "loan_repayment"
  | "transfer";

export interface BusinessTransaction extends BaseRecord {
  date: string;
  description: string;
  amount: number;
  type: BusinessTxType;
  categoryId?: string;
  accountId?: string;
  contactId?: string;
  notes?: string;
  /** Source record id when this entry mirrors an invoice payment or sale. */
  sourceType?: "invoice_payment" | "sale" | "manual";
  sourceId?: string;
}

export interface BusinessContact extends BaseRecord {
  name: string;
  kind: "customer" | "supplier" | "both";
  email?: string;
  phone?: string;
  notes?: string;
}

export interface BusinessProduct extends BaseRecord {
  name: string;
  sku: string;
  unit: string;
  salePrice: number;
  /** Current moving weighted-average unit cost. */
  unitCost: number;
  reorderThreshold: number;
  supplierId?: string;
  category?: string;
  /** Quantity on hand derived from posted movements. */
  quantity: number;
}

export type InventoryMovementType =
  | "receipt"
  | "dispatch"
  | "return"
  | "adjustment_positive"
  | "adjustment_negative"
  | "writeoff";

export interface InventoryMovement extends BaseRecord {
  productId: string;
  date: string;
  type: InventoryMovementType;
  /** Always a positive magnitude; direction comes from `type`. */
  quantity: number;
  unitCost?: number;
  reference?: string;
  note?: string;
}

export interface Sale extends BaseRecord {
  date: string;
  customerId?: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  returned: number;
  taxRate: number;
  status: "order" | "invoiced" | "paid";
  /** Invoice reference when this sale was billed through Invoicing. */
  invoiceId?: string;
  currency: string;
}

export interface SalesTarget extends BaseRecord {
  period: string;
  target: number;
  currency: string;
}

export interface Invoice extends BaseRecord {
  number: string;
  customerId?: string;
  issueDate: string;
  dueDate: string;
  status: "draft" | "sent" | "partial" | "paid" | "void";
  taxRate: number;
  discount: number;
  currency: string;
  notes?: string;
  lines: InvoiceLine[];
  /** True once the user confirms the invoice was actually delivered. */
  sentAt?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Payment extends BaseRecord {
  invoiceId: string;
  date: string;
  amount: number;
  method: "bank" | "card" | "cash" | "other";
  reference?: string;
}

export interface CashForecastItem extends BaseRecord {
  label: string;
  kind: "inflow" | "outflow";
  amount: number;
  /** Week index from the forecast start (0-based). */
  week: number;
  certainty: "committed" | "likely" | "possible";
  category?: string;
}

export interface CashScenario extends BaseRecord {
  name: string;
  openingCash: number;
  /** Multiplier applied to "possible" items. */
  optimisticFactor: number;
  conservativeFactor: number;
  minimumCash: number;
}

/* -------------------------------- LIFE ---------------------------------- */

export interface Wedding extends BaseRecord {
  couple: string;
  eventDate: string;
  totalBudget: number;
  currency: string;
  venue?: string;
}

export interface WeddingGuest extends BaseRecord {
  name: string;
  household: string;
  seats: number;
  rsvp: "invited" | "accepted" | "declined" | "tentative";
  tableId?: string;
  email?: string;
  dietary?: string;
}

export interface WeddingVendor extends BaseRecord {
  name: string;
  category: string;
  contractedAmount: number;
  notes?: string;
  phone?: string;
}

export interface WeddingPayment extends BaseRecord {
  vendorId: string;
  date: string;
  amount: number;
  note?: string;
}

export interface WeddingExpense extends BaseRecord {
  category: string;
  label: string;
  committed: number;
  actual: number;
  paid: number;
}

export interface WeddingTable extends BaseRecord {
  name: string;
  capacity: number;
}

export interface WeddingTask extends BaseRecord {
  title: string;
  dueDate?: string;
  done: boolean;
  owner?: string;
}

export interface Property extends BaseRecord {
  name: string;
  address?: string;
  currency: string;
  context: "personal" | "business";
  purchasePrice?: number;
}

export interface PropertyUnit extends BaseRecord {
  propertyId: string;
  name: string;
  nightlyRate: number;
  cleaningFee: number;
}

export interface PropertyBooking extends BaseRecord {
  propertyId: string;
  unitId: string;
  guest: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  accommodation: number;
  platformFee: number;
  cleaningFee: number;
  status: "booked" | "stayed" | "cancelled";
  paid: boolean;
  channel: "direct" | "airbnb" | "booking" | "other";
}

export interface PropertyExpense extends BaseRecord {
  propertyId: string;
  unitId?: string;
  date: string;
  category: string;
  amount: number;
  note?: string;
}

export interface PropertyMaintenance extends BaseRecord {
  propertyId: string;
  date: string;
  title: string;
  cost: number;
  done: boolean;
}

export interface NutritionFood extends BaseRecord {
  name: string;
  brand?: string;
  /** Per 100 g (or per 100 ml) values. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  source: "custom" | "usda" | "manual";
  fdcId?: number;
  servingGrams?: number;
}

export interface NutritionLog extends BaseRecord {
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  foodId?: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface NutritionRecipe extends BaseRecord {
  name: string;
  servings: number;
  notes?: string;
}

export interface RecipeIngredient {
  id: string;
  foodId?: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface GroceryItem extends BaseRecord {
  name: string;
  quantity: string;
  done: boolean;
}

/* -------------------------------- WORK ---------------------------------- */

export interface Project extends BaseRecord {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: "active" | "paused" | "done";
  color?: string;
}

export interface Task extends BaseRecord {
  projectId: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  estimateHours?: number;
  milestoneId?: string;
  order: number;
}

export interface Milestone extends BaseRecord {
  projectId: string;
  title: string;
  dueDate?: string;
  done: boolean;
}

export interface TaskDependency extends BaseRecord {
  taskId: string;
  dependsOnTaskId: string;
}

export interface Habit extends BaseRecord {
  name: string;
  /** 0=Sunday … 6=Saturday */
  days: number[];
  startDate: string;
  frequency: "daily" | "weekly" | "custom";
  targetPerWeek?: number;
  archived?: boolean;
  note?: string;
}

export interface HabitCompletion extends BaseRecord {
  habitId: string;
  date: string;
}

export interface ContentPost extends BaseRecord {
  title: string;
  platform: string;
  contentType: "post" | "story" | "reel" | "video" | "article" | "newsletter";
  status: "idea" | "draft" | "scheduled" | "published";
  scheduledDate?: string;
  publishedDate?: string;
  campaign?: string;
  notes?: string;
  reach?: number;
  engagements?: number;
  metricBasis?: "reach" | "impressions" | "followers";
}

export interface ContentCampaign extends BaseRecord {
  name: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
}

/* ------------------------------ PLATFORM -------------------------------- */

export interface UserPreferences extends BaseRecord {
  currency: string;
  locale: string;
  /** UI language, separate from locale formatting and the English-only AI language. */
  uiLanguage?: "en" | "es" | "zh-CN" | "pt-BR" | "fr";
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  timeZone: string;
  businessName?: string;
  theme: "system" | "light" | "dark";
  reducedMotion: boolean;
  /** Charts the user has pinned to the home dashboard (spec #20). */
  pinnedCharts?: Array<{ id: string; tool: string; chart: string; title: string }>;
  /** Per-tool reporting period preference (spec #3). Value meaning is tool-defined. */
  periods?: Record<string, string>;
}

export interface ToolActivation {
  toolId: ToolId;
  active: boolean;
  activatedAt: string;
}

export interface LocalRecord {
  id: string;
  toolId: string;
  collection: string;
  data: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
  deleted: 0 | 1;
  version: number;
  dirty: 0 | 1;
}

export interface OutboxEntry {
  id: string;
  toolId: string;
  collection: string;
  recordId: string;
  op: "upsert" | "delete";
  payload: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}
