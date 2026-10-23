/**
 * Gridhub tool catalog — the single source of truth for the 16 applications.
 * Routes, navigation, onboarding, entitlement checks and the dashboard all read from here.
 */

export type CollectionId = "money" | "business" | "life" | "work";

export type ToolId =
  | "budget"
  | "paycheck"
  | "debt"
  | "savings"
  | "net-worth"
  | "bookkeeping"
  | "inventory"
  | "sales"
  | "invoicing"
  | "cash-flow"
  | "wedding"
  | "property"
  | "nutrition"
  | "projects"
  | "habits"
  | "content";

export interface CollectionDef {
  id: CollectionId;
  name: string;
  label: string;
  blurb: string;
  /** Tailwind-friendly accent tokens (used inline, not in tailwind config). */
  accent: string;
  accentSoft: string;
  accentDark: string;
  order: number;
}

export interface ToolDef {
  id: ToolId;
  slug: string;
  name: string;
  shortName: string;
  collection: CollectionId;
  tagline: string;
  description: string;
  /** Key into the animated icon registry. */
  icon: string;
  benefits: string[];
  features: string[];
  route: string;
  /** Free-tier access (only the budget planner). */
  freeTier?: boolean;
  order: number;
  /** Search keywords for the public catalog + SEO. */
  keywords: string[];
}

export const COLLECTIONS: CollectionDef[] = [
  {
    id: "money",
    name: "Money",
    label: "Gridhub Money",
    blurb: "Budgets, paychecks, debt, savings and net worth — one accurate picture of your finances.",
    accent: "#3f5c46",
    accentSoft: "#e3ecdf",
    accentDark: "#2c4433",
    order: 1,
  },
  {
    id: "business",
    name: "Business",
    label: "Gridhub Business",
    blurb: "Bookkeeping, stock, sales, invoices and cash flow that share the same records.",
    accent: "#8a6f4a",
    accentSoft: "#f0e8db",
    accentDark: "#6a5334",
    order: 2,
  },
  {
    id: "life",
    name: "Life",
    label: "Gridhub Life",
    blurb: "Plan a wedding, run a rental, and keep nutrition simple — without a spreadsheet.",
    accent: "#8c5f63",
    accentSoft: "#f2e4e5",
    accentDark: "#6c464a",
    order: 3,
  },
  {
    id: "work",
    name: "Work",
    label: "Gridhub Work",
    blurb: "Projects, habits and content calendars that keep the week moving.",
    accent: "#5a6478",
    accentSoft: "#e5e8ef",
    accentDark: "#424b5c",
    order: 4,
  },
];

export const TOOLS: ToolDef[] = [
  {
    id: "budget",
    slug: "annual-budget-planner",
    name: "Ultimate Annual Budget Planner",
    shortName: "Annual Budget",
    collection: "money",
    tagline: "Twelve months, one clear plan.",
    description:
      "A full-year budgeting workspace: accounts, income, expenses, category budgets, recurring bills and an annual summary you can actually read.",
    icon: "wallet",
    benefits: ["Year-at-a-glance totals", "Category variance", "Recurring bill reminders"],
    features: [
      "Accounts, income, expenses and transfers",
      "Monthly category budgets with variance",
      "Savings rate and average spend",
      "Annual trend reporting",
    ],
    route: "/app/money/budget",
    freeTier: true,
    order: 1,
    keywords: ["online budget planner", "annual budget", "expense tracker", "monthly budget"],
  },
  {
    id: "paycheck",
    slug: "paycheck-budget-planner",
    name: "Monthly & Paycheck Budget Planner",
    shortName: "Paycheck Planner",
    collection: "money",
    tagline: "Budget the money you actually have.",
    description:
      "Split each paycheck across bills, spending and savings, then see exactly what is left until payday.",
    icon: "calendar-days",
    benefits: ["Per-paycheck allocation", "Daily spending allowance", "Bills due before payday"],
    features: [
      "Pay schedule with expected and actual income",
      "Bill assignment per paycheck",
      "Remaining discretionary allowance",
      "Payday countdown",
    ],
    route: "/app/money/paycheck",
    order: 2,
    keywords: ["paycheck budget planner", "biweekly budget", "payday budget"],
  },
  {
    id: "debt",
    slug: "debt-payoff-tracker",
    name: "Debt Snowball & Avalanche Tracker",
    shortName: "Debt Payoff",
    collection: "money",
    tagline: "See the finish line.",
    description:
      "Compare snowball and avalanche side by side with a real amortisation schedule, projected payoff date and total interest.",
    icon: "trending-down",
    benefits: ["Snowball vs avalanche", "Amortisation schedule", "Projected debt-free date"],
    features: [
      "Multiple debts with rates and minimums",
      "Extra payment simulation",
      "Interest saved comparison",
      "Payment history",
    ],
    route: "/app/money/debt",
    order: 3,
    keywords: ["debt payoff calculator", "debt snowball", "debt avalanche"],
  },
  {
    id: "savings",
    slug: "savings-goals",
    name: "Savings Goals & Emergency Fund",
    shortName: "Savings Goals",
    collection: "money",
    tagline: "Every contribution counts.",
    description:
      "Set targets, log contributions and withdrawals, and know the monthly amount required to arrive on time.",
    icon: "piggy-bank",
    benefits: ["Goal progress", "Required monthly amount", "Emergency fund cover"],
    features: [
      "Multiple goals with target dates",
      "Contribution and withdrawal ledger",
      "On-track / behind indicators",
      "Emergency fund months of cover",
    ],
    route: "/app/money/savings",
    order: 4,
    keywords: ["savings tracker", "emergency fund tracker", "savings goal calculator"],
  },
  {
    id: "net-worth",
    slug: "net-worth-tracker",
    name: "Net Worth & Investment Tracker",
    shortName: "Net Worth",
    collection: "money",
    tagline: "Your whole balance sheet.",
    description:
      "Track assets, liabilities and holdings, then watch net worth move over time with dated valuation snapshots.",
    icon: "line-chart",
    benefits: ["Assets vs liabilities", "Holding gains", "Net worth history"],
    features: [
      "Asset and liability register",
      "Holdings with cost basis",
      "Dated valuation snapshots",
      "Change and change % reporting",
    ],
    route: "/app/money/net-worth",
    order: 5,
    keywords: ["net worth tracker", "investment tracker", "portfolio tracker"],
  },
  {
    id: "bookkeeping",
    slug: "small-business-bookkeeping",
    name: "Small Business Bookkeeping",
    shortName: "Bookkeeping",
    collection: "business",
    tagline: "Clean books, cash basis.",
    description:
      "Record business money in and out, separate owner movements from real revenue, and read a cash-basis profit and loss.",
    icon: "book-open",
    benefits: ["Cash-basis P&L", "Expense ratio", "Owner movements kept separate"],
    features: [
      "Business accounts and categories",
      "Contacts for customers and suppliers",
      "Cash-basis P&L by period",
      "Explicit revenue vs contribution classification",
    ],
    route: "/app/business/bookkeeping",
    order: 6,
    keywords: ["small business bookkeeping", "cash basis accounting", "profit and loss"],
  },
  {
    id: "inventory",
    slug: "inventory-management",
    name: "Inventory Management",
    shortName: "Inventory",
    collection: "business",
    tagline: "Know what is on the shelf.",
    description:
      "Products, suppliers and immutable stock movements with moving weighted-average cost and reorder alerts.",
    icon: "package",
    benefits: ["Low stock alerts", "Weighted-average cost", "Movement history"],
    features: [
      "Products with SKU, cost and price",
      "Receipts, dispatches, returns, adjustments",
      "Moving weighted-average valuation",
      "Immutable posted movements",
    ],
    route: "/app/business/inventory",
    order: 7,
    keywords: ["inventory management", "stock tracker", "low stock alerts"],
  },
  {
    id: "sales",
    slug: "sales-revenue-tracker",
    name: "Sales & Revenue Tracker",
    shortName: "Sales",
    collection: "business",
    tagline: "Revenue you can trust.",
    description:
      "Log orders and services, track targets, and separate orders, invoiced revenue and collected cash.",
    icon: "shopping-cart",
    benefits: ["Target progress", "Average order value", "Top products"],
    features: [
      "Sales records with discounts and returns",
      "Products and customers reused across tools",
      "Revenue trend and growth",
      "Source references to avoid double counting",
    ],
    route: "/app/business/sales",
    order: 8,
    keywords: ["sales tracker", "revenue tracker", "sales dashboard"],
  },
  {
    id: "invoicing",
    slug: "invoice-manager",
    name: "Invoice & Payment Manager",
    shortName: "Invoicing",
    collection: "business",
    tagline: "Send it. Track it. Get paid.",
    description:
      "Draft and issue invoices with line items and tax, allocate partial payments, and print a clean PDF.",
    icon: "file-text",
    benefits: ["Partial payments", "Overdue tracking", "Printable invoices"],
    features: [
      "Invoice lines with decimal-safe totals",
      "Tax configuration and rounding",
      "Payment allocation and balance due",
      "Overdue reporting and PDF output",
    ],
    route: "/app/business/invoicing",
    order: 9,
    keywords: ["invoice manager", "invoice generator", "payment tracker"],
  },
  {
    id: "cash-flow",
    slug: "cash-flow-forecast",
    name: "Cash Flow Forecast",
    shortName: "Cash Flow",
    collection: "business",
    tagline: "Look before you leap.",
    description:
      "Project closing cash across base, optimistic and conservative scenarios, with runway and shortfall warnings.",
    icon: "waves",
    benefits: ["13-week projection", "Runway months", "Scenario comparison"],
    features: [
      "Opening cash and recurring items",
      "Receivables and payables",
      "Three scenarios",
      "Shortfall detection",
    ],
    route: "/app/business/cash-flow",
    order: 10,
    keywords: ["cash flow forecast", "cash runway", "13 week cash flow"],
  },
  {
    id: "wedding",
    slug: "wedding-planner",
    name: "Ultimate Wedding Planner",
    shortName: "Wedding",
    collection: "life",
    tagline: "The whole day, in hand.",
    description:
      "Budget, guests, RSVPs, vendors, payments, seating and a checklist — all counting down to one date.",
    icon: "heart",
    benefits: ["Budget vs committed", "RSVP tracking", "Seating capacity checks"],
    features: [
      "Guest list with household counts",
      "Vendor contracts and payment schedule",
      "Table assignments with capacity limits",
      "Checklist and countdown",
    ],
    route: "/app/life/wedding",
    order: 11,
    keywords: ["online wedding planner", "wedding budget", "guest list and RSVP"],
  },
  {
    id: "property",
    slug: "rental-property-manager",
    name: "Rental Property & Airbnb Manager",
    shortName: "Property",
    collection: "life",
    tagline: "Every night accounted for.",
    description:
      "Track properties and units, bookings, income and expenses, with occupancy, ADR and RevPAN.",
    icon: "home",
    benefits: ["Occupancy and ADR", "Net operating income", "Double-booking guard"],
    features: [
      "Portfolio of properties and units",
      "Booking calendar with overlap prevention",
      "Income and expense ledger",
      "Property and portfolio reporting",
    ],
    route: "/app/life/property",
    order: 12,
    keywords: ["rental property manager", "airbnb income tracker", "occupancy rate"],
  },
  {
    id: "nutrition",
    slug: "calorie-tracker",
    name: "Gridhub Nutrition",
    shortName: "Nutrition",
    collection: "life",
    tagline: "Eat well. Track simply.",
    description:
      "A private food diary with per-100g maths, saved foods, recipes and a grocery list. No medical prescriptions.",
    icon: "utensils",
    benefits: ["Per-100g accuracy", "Recipe macros", "Fully private"],
    features: [
      "Food diary by meal",
      "Custom foods and saved portions",
      "Recipes with per-serving macros",
      "Daily and weekly trends",
    ],
    route: "/app/life/nutrition",
    order: 13,
    keywords: ["calorie tracker", "food diary", "macro tracker"],
  },
  {
    id: "projects",
    slug: "project-management",
    name: "Project Management Dashboard",
    shortName: "Projects",
    collection: "work",
    tagline: "Ship the thing.",
    description:
      "Projects, tasks, milestones and dependencies with table, board and timeline views that stay in sync.",
    icon: "kanban",
    benefits: ["Kanban and table", "Dependency checks", "Overdue detection"],
    features: [
      "Projects with tasks and milestones",
      "Drag-and-drop board plus keyboard moves",
      "Circular dependency prevention",
      "Completion and deadline reporting",
    ],
    route: "/app/work/projects",
    order: 14,
    keywords: ["project management dashboard", "kanban board", "task tracker"],
  },
  {
    id: "habits",
    slug: "habit-tracker",
    name: "Habit & Productivity Tracker",
    shortName: "Habits",
    collection: "work",
    tagline: "Small things, kept.",
    description:
      "Schedule habits by the days they actually run, keep honest streaks, and review completion without the guilt.",
    icon: "circle-check",
    benefits: ["Schedule-aware streaks", "Completion rate", "Weekly planner"],
    features: [
      "Habits with weekday schedules",
      "Streaks that respect the schedule",
      "Completion history and rates",
      "Gentle, non-punitive language",
    ],
    route: "/app/work/habits",
    order: 15,
    keywords: ["habit tracker", "streak tracker", "weekly planner"],
  },
  {
    id: "content",
    slug: "social-media-content-planner",
    name: "Social Media Content Planner",
    shortName: "Content",
    collection: "work",
    tagline: "Plan the week, not the panic.",
    description:
      "An idea bank, drafts, a content calendar and campaign tags — with publishing marked only when you confirm it.",
    icon: "calendar-range",
    benefits: ["Calendar and pipeline", "Campaign tags", "Honest publishing status"],
    features: [
      "Ideas, drafts and scheduled posts",
      "Calendar and kanban pipeline",
      "Platform and campaign filters",
      "Manual metrics and engagement rate",
    ],
    route: "/app/work/content",
    order: 16,
    keywords: ["social media content planner", "content calendar", "editorial calendar"],
  },
];

export const TOOL_MAP: Record<ToolId, ToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t]),
) as Record<ToolId, ToolDef>;

export const COLLECTION_MAP: Record<CollectionId, CollectionDef> = Object.fromEntries(
  COLLECTIONS.map((c) => [c.id, c]),
) as Record<CollectionId, CollectionDef>;

export const ALL_TOOL_IDS: ToolId[] = TOOLS.map((t) => t.id);

export function toolsByCollection(id: CollectionId): ToolDef[] {
  return TOOLS.filter((t) => t.collection === id).sort((a, b) => a.order - b.order);
}

export function toolBySlug(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function isToolId(v: string): v is ToolId {
  return (ALL_TOOL_IDS as string[]).includes(v);
}
