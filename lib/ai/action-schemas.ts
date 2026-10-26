/**
 * Gridhub AI — parameter schemas.
 *
 * Every action parameter is validated here before it can touch a record. The model never executes
 * code and never produces SQL; it only produces JSON that must satisfy one of these schemas.
 */

import { z } from "zod";

const money = z.coerce.number().positive().max(1_000_000_000);
const qty = z.coerce.number().positive().max(1_000_000);
const label = z.string().trim().min(1).max(140);
const when = z.string().trim().min(1).max(40).optional();

const empty = z.object({}).default({});

export const ACTION_SCHEMAS = {
  /* ------------------------------- Money -------------------------------- */
  "budget.create_expense": z.object({
    amount: money,
    description: label,
    category: z.string().trim().max(80).optional(),
    account: z.string().trim().max(80).optional(),
    date: when,
  }),
  "budget.create_income": z.object({
    amount: money,
    description: label,
    category: z.string().trim().max(80).optional(),
    account: z.string().trim().max(80).optional(),
    date: when,
  }),
  "budget.query_spend": z.object({ period: z.string().trim().max(40).optional() }),
  "budget.query_remaining": z.object({ month: z.string().trim().max(40).optional() }),
  "paycheck.record_paycheck": z.object({
    amount: money,
    date: when,
    schedule: z.string().trim().max(80).optional(),
  }),
  "debt.record_payment": z.object({
    amount: money,
    debt: z.string().trim().min(1).max(120),
    date: when,
  }),
  "savings.add_contribution": z.object({
    amount: money,
    goal: z.string().trim().min(1).max(120),
    date: when,
  }),
  "net-worth.add_asset": z.object({
    name: label,
    value: z.coerce.number().min(-1_000_000_000).max(1_000_000_000),
    category: z.string().trim().max(80).optional(),
    kind: z.enum(["asset", "liability"]).optional(),
  }),

  /* ------------------------------ Business ------------------------------ */
  "bookkeeping.record_income": z.object({
    amount: money,
    description: label,
    date: when,
    category: z.string().trim().max(80).optional(),
    contact: z.string().trim().max(120).optional(),
  }),
  "bookkeeping.record_expense": z.object({
    amount: money,
    description: label,
    date: when,
    category: z.string().trim().max(80).optional(),
    contact: z.string().trim().max(120).optional(),
  }),
  "inventory.receive": z.object({
    product: z.string().trim().min(1).max(120),
    quantity: qty,
    unitCost: z.coerce.number().min(0).max(1_000_000).optional(),
  }),
  "inventory.query_low_stock": empty,
  "sales.create_sale": z.object({
    description: label,
    quantity: qty,
    unitPrice: z.coerce.number().min(0).max(1_000_000_000),
    product: z.string().trim().max(120).optional(),
    customer: z.string().trim().max(120).optional(),
    date: when,
  }),
  "invoicing.prepare_invoice": z.object({
    customer: z.string().trim().min(1).max(120),
    amount: money,
    description: label.optional(),
    dueDate: when,
    taxRate: z.coerce.number().min(0).max(100).optional(),
  }),
  "invoicing.query_unpaid": empty,
  "cash-flow.query_forecast": empty,

  /* -------------------------------- Life -------------------------------- */
  "wedding.add_guest": z.object({
    name: label,
    household: z.string().trim().max(120).optional(),
    seats: z.coerce.number().int().min(1).max(20).optional(),
    rsvp: z.enum(["invited", "accepted", "declined", "tentative"]).optional(),
  }),
  "property.add_expense": z.object({
    property: z.string().trim().min(1).max(120),
    amount: money,
    category: z.string().trim().max(80).optional(),
    date: when,
  }),
  "nutrition.log_food": z.object({
    name: label,
    grams: z.coerce.number().min(0).max(10_000).optional(),
    kcal: z.coerce.number().min(0).max(20_000).optional(),
    protein: z.coerce.number().min(0).max(2_000).optional(),
    carbs: z.coerce.number().min(0).max(2_000).optional(),
    fat: z.coerce.number().min(0).max(2_000).optional(),
    meal: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
    date: when,
  }),
  "nutrition.query_summary": z.object({ date: when }),

  /* -------------------------------- Work -------------------------------- */
  "projects.create_task": z.object({
    title: label,
    project: z.string().trim().min(1).max(120).optional(),
    dueDate: when,
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
  "projects.complete_task": z.object({ task: z.string().trim().min(1).max(160) }),
  "projects.query_deadlines": empty,
  "habits.complete_habit": z.object({
    habit: z.string().trim().min(1).max(120),
    date: when,
  }),
  "content.create_draft": z.object({
    title: label,
    platform: z.string().trim().max(40).optional(),
    contentType: z
      .enum(["post", "story", "reel", "video", "article", "newsletter"])
      .optional(),
    scheduledDate: when,
  }),
  "content.schedule_post": z.object({
    title: label,
    platform: z.string().trim().min(1).max(40),
    scheduledDate: z.string().trim().min(1).max(40),
  }),
} as const;

export type ActionId = keyof typeof ACTION_SCHEMAS;

/** The structured response the model must return. Every branch is validated. */
export const AIResponseSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("action"),
    actionId: z.string(),
    parameters: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    intent: z.literal("query"),
    actionId: z.string().optional(),
    question: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    intent: z.literal("clarification"),
    question: z.string().min(1),
    options: z.array(z.string()).max(8).optional(),
  }),
  z.object({ intent: z.literal("unsupported"), reason: z.string().optional() }),
  z.object({ intent: z.literal("navigation"), path: z.string().min(1) }),
]);

export type AIResponse = z.infer<typeof AIResponseSchema>;

export function isActionId(value: string): value is ActionId {
  return Object.prototype.hasOwnProperty.call(ACTION_SCHEMAS, value);
}
