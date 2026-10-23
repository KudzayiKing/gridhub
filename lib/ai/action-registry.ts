/**
 * Gridhub AI — the strict action allowlist.
 *
 * The model may only name an action that exists here. Anything else is rejected before it can
 * reach a domain service. `kind: "query"` actions are read-only and need no confirmation; every
 * write requires the user to confirm.
 */

import type { ToolId } from "@/lib/catalog";
import { ACTION_SCHEMAS, type ActionId } from "./action-schemas";

export type ActionKind = "create" | "update" | "query";

export interface RegisteredAction {
  id: ActionId;
  toolId: ToolId;
  kind: ActionKind;
  /** Short label shown in the confirmation card. */
  label: string;
  /** Prompt-facing description; kept terse so the context stays small. */
  description: string;
  requiresConfirmation: boolean;
  examples: string[];
}

export const REGISTERED_ACTIONS: RegisteredAction[] = [
  /* ------------------------------- Money -------------------------------- */
  {
    id: "budget.create_expense",
    toolId: "budget",
    kind: "create",
    label: "Add expense",
    description: "Record a spending transaction.",
    requiresConfirmation: true,
    examples: ["Add $45 for groceries today", "Spent 12.50 on coffee"],
  },
  {
    id: "budget.create_income",
    toolId: "budget",
    kind: "create",
    label: "Add income",
    description: "Record an income transaction.",
    requiresConfirmation: true,
    examples: ["Add $2,000 salary", "Received $150 freelance"],
  },
  {
    id: "budget.query_spend",
    toolId: "budget",
    kind: "query",
    label: "Spending summary",
    description: "Total spending for a period.",
    requiresConfirmation: false,
    examples: ["How much did I spend last month?"],
  },
  {
    id: "budget.query_remaining",
    toolId: "budget",
    kind: "query",
    label: "Budget remaining",
    description: "How much budget is left this month.",
    requiresConfirmation: false,
    examples: ["How much budget do I have left?"],
  },
  {
    id: "paycheck.record_paycheck",
    toolId: "paycheck",
    kind: "create",
    label: "Record paycheck",
    description: "Record money received on a pay schedule.",
    requiresConfirmation: true,
    examples: ["I got paid $2,400 today"],
  },
  {
    id: "debt.record_payment",
    toolId: "debt",
    kind: "create",
    label: "Record debt payment",
    description: "Record a payment against a debt.",
    requiresConfirmation: true,
    examples: ["Paid $200 towards my credit card"],
  },
  {
    id: "savings.add_contribution",
    toolId: "savings",
    kind: "create",
    label: "Add savings contribution",
    description: "Add money to a savings goal.",
    requiresConfirmation: true,
    examples: ["Add $50 to my holiday fund"],
  },
  {
    id: "net-worth.add_asset",
    toolId: "net-worth",
    kind: "create",
    label: "Add net-worth item",
    description: "Add an asset or liability.",
    requiresConfirmation: true,
    examples: ["Add my car as an asset worth $12,000"],
  },

  /* ------------------------------ Business ------------------------------ */
  {
    id: "bookkeeping.record_income",
    toolId: "bookkeeping",
    kind: "create",
    label: "Record business income",
    description: "Record cash-basis revenue.",
    requiresConfirmation: true,
    examples: ["Record $800 client payment"],
  },
  {
    id: "bookkeeping.record_expense",
    toolId: "bookkeeping",
    kind: "create",
    label: "Record business expense",
    description: "Record a business expense.",
    requiresConfirmation: true,
    examples: ["Record $60 for printer ink"],
  },
  {
    id: "inventory.receive",
    toolId: "inventory",
    kind: "create",
    label: "Receive stock",
    description: "Add stock for a product.",
    requiresConfirmation: true,
    examples: ["Add 20 units of coffee"],
  },
  {
    id: "inventory.query_low_stock",
    toolId: "inventory",
    kind: "query",
    label: "Low stock",
    description: "Products at or below their reorder threshold.",
    requiresConfirmation: false,
    examples: ["Which products are running low?"],
  },
  {
    id: "sales.create_sale",
    toolId: "sales",
    kind: "create",
    label: "Record sale",
    description: "Record a sale.",
    requiresConfirmation: true,
    examples: ["Sold 3 candles at $18 each"],
  },
  {
    id: "invoicing.prepare_invoice",
    toolId: "invoicing",
    kind: "create",
    label: "Prepare invoice",
    description: "Draft an invoice for a customer.",
    requiresConfirmation: true,
    examples: ["Prepare an invoice for John Smith for $450"],
  },
  {
    id: "invoicing.query_unpaid",
    toolId: "invoicing",
    kind: "query",
    label: "Unpaid invoices",
    description: "Invoices with a balance outstanding.",
    requiresConfirmation: false,
    examples: ["Show my unpaid invoices"],
  },
  {
    id: "cash-flow.query_forecast",
    toolId: "cash-flow",
    kind: "query",
    label: "Cash forecast",
    description: "Projected closing cash and runway.",
    requiresConfirmation: false,
    examples: ["What is my cash forecast?"],
  },

  /* -------------------------------- Life -------------------------------- */
  {
    id: "wedding.add_guest",
    toolId: "wedding",
    kind: "create",
    label: "Add wedding guest",
    description: "Add a guest to the list.",
    requiresConfirmation: true,
    examples: ["Add Sarah and her partner to the guest list"],
  },
  {
    id: "property.add_expense",
    toolId: "property",
    kind: "create",
    label: "Add property expense",
    description: "Record a property expense.",
    requiresConfirmation: true,
    examples: ["Add $120 plumbing cost to the flat"],
  },
  {
    id: "nutrition.log_food",
    toolId: "nutrition",
    kind: "create",
    label: "Log food",
    description: "Log a food entry with its macros.",
    requiresConfirmation: true,
    examples: ["I had two boiled eggs for breakfast"],
  },
  {
    id: "nutrition.query_summary",
    toolId: "nutrition",
    kind: "query",
    label: "Nutrition summary",
    description: "Calories and macros for a day.",
    requiresConfirmation: false,
    examples: ["How many calories have I had today?"],
  },

  /* -------------------------------- Work -------------------------------- */
  {
    id: "projects.create_task",
    toolId: "projects",
    kind: "create",
    label: "Create task",
    description: "Add a task to a project.",
    requiresConfirmation: true,
    examples: ["Add a task to redesign the homepage"],
  },
  {
    id: "projects.complete_task",
    toolId: "projects",
    kind: "update",
    label: "Complete task",
    description: "Mark a task as done.",
    requiresConfirmation: true,
    examples: ["Mark the website redesign task as complete"],
  },
  {
    id: "projects.query_deadlines",
    toolId: "projects",
    kind: "query",
    label: "Upcoming deadlines",
    description: "Tasks due soon.",
    requiresConfirmation: false,
    examples: ["What is due this week?"],
  },
  {
    id: "habits.complete_habit",
    toolId: "habits",
    kind: "create",
    label: "Complete habit",
    description: "Mark a habit done for a day.",
    requiresConfirmation: true,
    examples: ["Mark my run as done"],
  },
  {
    id: "content.create_draft",
    toolId: "content",
    kind: "create",
    label: "Create content draft",
    description: "Add an idea or draft post.",
    requiresConfirmation: true,
    examples: ["Draft a post about our launch"],
  },
  {
    id: "content.schedule_post",
    toolId: "content",
    kind: "create",
    label: "Schedule post",
    description: "Schedule a post for a date.",
    requiresConfirmation: true,
    examples: ["Schedule a social media post for Friday"],
  },
];

export const ACTION_MAP: Record<string, RegisteredAction> = Object.fromEntries(
  REGISTERED_ACTIONS.map((a) => [a.id, a]),
);

export function getAction(id: string): RegisteredAction | undefined {
  return ACTION_MAP[id];
}

export function actionsForTool(toolId: ToolId): RegisteredAction[] {
  return REGISTERED_ACTIONS.filter((a) => a.toolId === toolId);
}

export function actionsForTools(toolIds: ToolId[]): RegisteredAction[] {
  const allowed = new Set(toolIds);
  return REGISTERED_ACTIONS.filter((a) => allowed.has(a.toolId));
}

/** Guard: schema and registry must never drift apart. */
export function registryMatchesSchemas(): boolean {
  const registryIds = new Set(REGISTERED_ACTIONS.map((a) => a.id));
  const schemaIds = Object.keys(ACTION_SCHEMAS);
  return registryIds.size === schemaIds.length && schemaIds.every((id) => registryIds.has(id as ActionId));
}
