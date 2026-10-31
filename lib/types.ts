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
  lender?: string;
  /** Contractual day of month, when known. Never inferred from payment history. */
  dueDay?: number;
  /** Anchor date for biweekly payment schedules. */
  nextDueDate?: string;
  /** User-selected in-app reminder lead times in days. */
  reminderDaysBefore?: number[];
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
  /** Missing status on legacy rows means an actual recorded payment. */
  status?: "planned" | "paid" | "partial" | "skipped";
  paycheckId?: string;
  notes?: string;
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
  /** Optional plan inputs; absent values are never inferred. */
  monthlyContribution?: number;
  startDate?: string;
  contributionFrequency?: "monthly" | "biweekly" | "weekly";
  coverageTargetMonths?: 3 | 6 | 12;
  annualInterestRate?: number;
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
  notes?: string;
  linkedDebtId?: string;
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
  assetClass?: string;
  accountName?: string;
  /** Parent asset record already represents this brokerage account's full balance. */
  parentAssetId?: string;
  notes?: string;
}

export type InvestmentTransactionKind = "contribution" | "withdrawal" | "dividend" | "interest" | "fee";

/** Dated cash movement used for money-weighted investment return calculations. */
export interface InvestmentTransaction extends BaseRecord {
  date: string;
  kind: InvestmentTransactionKind;
  /** Positive amount; direction is determined by kind. */
  amount: number;
  currency: string;
  holdingId?: string;
  /** Reinvested distributions remain in portfolio value and are not an investor cash flow. */
  reinvested?: boolean;
  /** If true, the fee is already reflected in portfolio valuations. */
  paidFromPortfolio?: boolean;
  notes?: string;
}

export interface ValuationSnapshot extends BaseRecord {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  currency: string;
  note?: string;
  investmentValue?: number;
  assetsByCategory?: Record<string, number>;
  liabilitiesByCategory?: Record<string, number>;
}

export interface NetWorthAllocationTarget extends BaseRecord {
  assetClass: string;
  targetPercent: number;
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
  businessId?: string;
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
  /** Currency is normally inherited from the linked business; retained for safe historical reporting. */
  currency?: string;
  type: BusinessTxType;
  businessId?: string;
  categoryId?: string;
  accountId?: string;
  contactId?: string;
  notes?: string;
  /** Source record id when this entry mirrors an invoice payment or sale. */
  sourceType?: "invoice_payment" | "sale" | "inventory_purchase" | "property_income" | "manual";
  sourceId?: string;
}

export interface BusinessContact extends BaseRecord {
  name: string;
  kind: "customer" | "supplier" | "both";
  businessId?: string;
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
  /** Opening stock on hand before the recorded movement history begins. */
  quantity: number;
  businessId?: string;
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
  businessId?: string;
  /** Optional Bookkeeping mirror ID. The inventory movement remains canonical. */
  bookkeepingTransactionId?: string;
  /** Explicit confirmation that a receipt cost was paid from business funds. */
  purchasePaid?: boolean;
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
  businessId?: string;
  /** Optional Bookkeeping mirror ID. Invoice-linked sales use their payments as cash revenue. */
  bookkeepingTransactionId?: string;
}

export interface SalesTarget extends BaseRecord {
  period: string;
  target: number;
  currency: string;
  businessId?: string;
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
  businessId?: string;
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
  businessId?: string;
  /** Optional Bookkeeping mirror ID. The invoice payment remains canonical. */
  bookkeepingTransactionId?: string;
}

export interface CashForecastItem extends BaseRecord {
  label: string;
  kind: "inflow" | "outflow";
  amount: number;
  /** Week index from the forecast start (0-based). */
  week: number;
  certainty: "committed" | "likely" | "possible";
  category?: string;
  businessId?: string;
  scenarioId?: string;
}

export interface CashScenario extends BaseRecord {
  name: string;
  openingCash: number;
  /** Multiplier applied to "possible" items. */
  optimisticFactor: number;
  conservativeFactor: number;
  minimumCash: number;
  businessId?: string;
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
  weddingId?: string;
  name: string;
  household: string;
  seats: number;
  rsvp: "invited" | "accepted" | "declined" | "tentative";
  tableId?: string;
  email?: string;
  dietary?: string;
}

export interface WeddingVendor extends BaseRecord {
  weddingId?: string;
  name: string;
  category: string;
  contractedAmount: number;
  notes?: string;
  phone?: string;
}

export interface WeddingPayment extends BaseRecord {
  weddingId?: string;
  vendorId: string;
  date: string;
  amount: number;
  note?: string;
}

export interface WeddingExpense extends BaseRecord {
  weddingId?: string;
  category: string;
  label: string;
  committed: number;
  actual: number;
  paid: number;
}

export interface WeddingTable extends BaseRecord {
  weddingId?: string;
  name: string;
  capacity: number;
}

export interface WeddingTask extends BaseRecord {
  weddingId?: string;
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
  /** Optional link for business-owned rentals; personal properties stay unassigned. */
  businessId?: string;
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
  /** Optional Bookkeeping mirror ID; the paid booking remains canonical. */
  bookkeepingTransactionId?: string;
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
  /** Explicit content calendar. Missing only on legacy, unassigned content. */
  planId?: string;
  category?: string;
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

/** Workspace-level identity used to group plans and owned channel accounts. */
export interface ContentBrand extends BaseRecord {
  name: string;
  description?: string;
  website?: string;
}

/** A named strategy/calendar. It is distinct from a campaign and channel account. */
export interface ContentPlan extends BaseRecord {
  name: string;
  brandId?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  archived?: boolean;
}

/** A particular account, not merely a platform such as YouTube or Instagram. */
export interface ChannelAccount extends BaseRecord {
  name: string;
  platform: string;
  handle?: string;
  brandId?: string;
  active: boolean;
}

/** One destination for a shared content item. Status and metrics belong to this destination. */
export interface ContentPublication extends BaseRecord {
  contentId: string;
  channelAccountId: string;
  status: "draft" | "scheduled" | "published";
  scheduledDate?: string;
  publishedDate?: string;
  url?: string;
  notes?: string;
  reach?: number;
  engagements?: number;
  metricBasis?: "reach" | "impressions" | "followers";
}

/* ------------------------------ PLATFORM -------------------------------- */

export interface UserPreferences extends BaseRecord {
  currency: string;
  locale: string;
  /** UI language, separate from locale formatting and the English-only AI language. */
  uiLanguage?: "en" | "es" | "zh-CN" | "pt-BR" | "fr" | "ar" | "ru";
  uiLanguageManuallySet?: boolean;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  timeZone: string;
  businessName?: string;
  theme: "system" | "light" | "dark";
  reducedMotion: boolean;
  /** Charts the user has pinned to the home dashboard (spec #20). */
  pinnedCharts?: Array<{ id: string; tool: string; chart: string; title: string }>;
  /** Per-widget dashboard width preference. Chart widgets support half or full width. */
  pinnedChartSizes?: Record<string, "half" | "full">;
  /** Ordered KPI IDs shown on the Overview, limited to four. */
  dashboardKpis?: string[];
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
  /** Workspace envelope. Missing only on pre-workspace legacy rows. */
  workspaceId?: string;
  /** Authenticated owner for cloud workspaces; null for device-only workspaces. */
  ownerUserId?: string | null;
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
  /** Workspace and owner are copied into the mutation so retries stay in scope. */
  workspaceId?: string;
  ownerUserId?: string | null;
  toolId: string;
  collection: string;
  recordId: string;
  op: "upsert" | "delete";
  payload: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
}
