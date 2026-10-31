/**
 * Gridhub AI — action preparation and execution.
 *
 * Writes never touch the database directly: they go through `createRecord` / `updateRecord`, the
 * same repository the manual UI uses, so the existing outbox and sync engine pick them up. Every
 * write is idempotent and reversible where possible.
 */

import { createRecord, listRecords, removeRecord, updateRecord } from "@/lib/store";
import { formatMoney, round2 } from "@/lib/money";
import { uid } from "@/lib/utils";
import { budgetSummary } from "@/lib/calc/money";
import {
  forecastCashFlow,
  inventorySummary,
  invoicingSummary,
  nextInvoiceNumber,
} from "@/lib/calc/business";
import { dailyTotals } from "@/lib/calc/life";
import type {
  BaseRecord,
  Business,
  BusinessContact,
  BusinessProduct,
  CashForecastItem,
  CashScenario,
  Debt,
  Habit,
  HabitCompletion,
  InventoryMovement,
  Invoice,
  MoneyAccount,
  MoneyBudget,
  MoneyCategory,
  MoneyTransaction,
  NutritionFood,
  NutritionLog,
  Payment,
  PaySchedule,
  Project,
  Property,
  SavingsGoal,
  Task,
} from "@/lib/types";
import { ACTION_SCHEMAS, type ActionId } from "./action-schemas";
import { getAction, type RegisteredAction } from "./action-registry";
import {
  resolveByName,
  resolveDate,
  resolvePeriod,
  type ResolveResult,
} from "./entity-resolver";
import {
  canUseTool,
  permissionMessage,
  type EntitlementState,
} from "./permission-checker";

export interface ExecContext {
  entitlement: EntitlementState;
  today: string;
  timeZone: string;
  currency: string;
}

export interface SummaryLine {
  label: string;
  value: string;
}

export interface ExecResult {
  ok: boolean;
  message: string;
  toolId?: string;
  recordId?: string;
  undo?: () => Promise<void>;
}

export interface PreparedAction {
  kind: "action";
  actionId: ActionId;
  toolId: string;
  label: string;
  summary: SummaryLine[];
  requiresConfirmation: boolean;
  mutationKey: string;
  commit: () => Promise<ExecResult>;
}

export interface Clarification {
  kind: "clarification";
  question: string;
  options?: string[];
}

export interface QueryResult {
  title: string;
  lines: string[];
}

export type PrepareResult = PreparedAction | Clarification;

/* ------------------------------ idempotency ----------------------------- */

const MUTATION_LEDGER = "gridhub.ai.mutations";

function claimMutation(key: string): boolean {
  try {
    const raw = localStorage.getItem(MUTATION_LEDGER);
    const ledger = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const now = Date.now();
    for (const k of Object.keys(ledger)) {
      if (now - ledger[k] > 24 * 60 * 60 * 1000) delete ledger[k];
    }
    if (ledger[key]) {
      localStorage.setItem(MUTATION_LEDGER, JSON.stringify(ledger));
      return false;
    }
    ledger[key] = now;
    localStorage.setItem(MUTATION_LEDGER, JSON.stringify(ledger));
    return true;
  } catch {
    return true;
  }
}

function releaseMutation(key: string) {
  try {
    const raw = localStorage.getItem(MUTATION_LEDGER);
    if (!raw) return;
    const ledger = JSON.parse(raw) as Record<string, number>;
    delete ledger[key];
    localStorage.setItem(MUTATION_LEDGER, JSON.stringify(ledger));
  } catch {
    // best-effort
  }
}

/* -------------------------------- helpers ------------------------------- */

async function recs<T extends BaseRecord>(toolId: string, collection: string): Promise<T[]> {
  try {
    return await listRecords<T>(toolId, collection);
  } catch {
    return [];
  }
}

export function isClarification<T>(value: T | Clarification): value is Clarification {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "clarification"
  );
}

/**
 * Resolves a date, or asks. `resolveDate` returns null only when a value was supplied and could not
 * be understood, so a silent fall back to today can no longer happen here.
 */
function dateOrClarify(input: string | undefined, today: string): string | Clarification {
  const date = resolveDate(input, today);
  if (date) return date;
  return {
    kind: "clarification",
    question: `I couldn't read the date "${input}". Which day did you mean?`,
    options: ["today", "yesterday", "tomorrow"],
  };
}

function resolveOrClarify<T extends { id: string }>(
  records: T[],
  query: string,
  getName: (record: T) => string,
  label: string,
): T | Clarification {
  const result: ResolveResult<T> = resolveByName(records, query, getName);
  if (result.status === "match") return result.record;
  if (result.status === "ambiguous") {
    return {
      kind: "clarification",
      question: `Which ${label} did you mean by "${query}"?`,
      options: result.candidates.map(getName),
    };
  }
  return {
    kind: "clarification",
    question: `I couldn't find a ${label} called "${query}".`,
    options: records.slice(0, 8).map(getName),
  };
}

function prepared(
  meta: RegisteredAction,
  summary: SummaryLine[],
  commit: (mutationKey: string) => Promise<ExecResult>,
): PreparedAction {
  const mutationKey = uid("aimut");
  return {
    kind: "action",
    actionId: meta.id,
    toolId: meta.toolId,
    label: meta.label,
    summary,
    requiresConfirmation: meta.requiresConfirmation,
    mutationKey,
    commit: () => commit(mutationKey),
  };
}

async function commitCreate(
  toolId: string,
  collection: string,
  data: Record<string, unknown>,
  mutationKey: string,
  label: string,
): Promise<ExecResult> {
  if (!claimMutation(mutationKey)) {
    return { ok: true, message: "That change was already saved.", toolId };
  }
  try {
    const record = await createRecord<BaseRecord>(toolId, collection, data as never);
    return {
      ok: true,
      message: `${label} saved on this device. It will sync when you're online.`,
      toolId,
      recordId: record.id,
      undo: async () => {
        await removeRecord(toolId, collection, record.id);
      },
    };
  } catch (error) {
    releaseMutation(mutationKey);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save the change.",
      toolId,
    };
  }
}

async function commitUpdate<T extends BaseRecord>(
  toolId: string,
  collection: string,
  previous: T,
  patch: Partial<T>,
  mutationKey: string,
  label: string,
): Promise<ExecResult> {
  if (!claimMutation(mutationKey)) {
    return { ok: true, message: "That change was already saved.", toolId };
  }
  try {
    const next = await updateRecord<T>(toolId, collection, previous.id, patch);
    if (!next) throw new Error("That record no longer exists.");
    return {
      ok: true,
      message: `${label} updated.`,
      toolId,
      recordId: next.id,
      undo: async () => {
        await updateRecord<T>(toolId, collection, previous.id, previous);
      },
    };
  } catch (error) {
    releaseMutation(mutationKey);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update the record.",
      toolId,
    };
  }
}

/* ------------------------------- prepare -------------------------------- */

export async function prepareAction(
  actionId: string,
  parameters: Record<string, unknown>,
  ctx: ExecContext,
): Promise<PrepareResult> {
  const meta = getAction(actionId);
  if (!meta) return { kind: "clarification", question: "I couldn't match that to an action." };

  if (!canUseTool(meta.toolId, ctx.entitlement)) {
    return { kind: "clarification", question: permissionMessage(meta.toolId, ctx.entitlement) };
  }

  switch (meta.id) {
    case "budget.create_expense":
    case "budget.create_income": {
      const isExpense = meta.id === "budget.create_expense";
      const p = (isExpense ? ACTION_SCHEMAS["budget.create_expense"] : ACTION_SCHEMAS["budget.create_income"]).parse(parameters);
      const [categories, accounts] = await Promise.all([
        recs<MoneyCategory>("budget", "categories"),
        recs<MoneyAccount>("budget", "accounts"),
      ]);

      let categoryId: string | undefined;
      if (p.category) {
        const picked = resolveOrClarify(
          categories,
          p.category,
          (c) => c.name,
          "category",
        );
        if (isClarification(picked)) return picked;
        categoryId = picked.id;
      }

      let accountId: string | undefined;
      if (p.account) {
        const res = resolveByName(accounts, p.account, (a) => a.name);
        if (res.status === "match") accountId = res.record.id;
      }

      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const amount = round2(p.amount);
      const summary: SummaryLine[] = [
        { label: "Tool", value: "Annual Budget" },
        { label: "Action", value: isExpense ? "Add expense" : "Add income" },
        { label: "Description", value: p.description },
        { label: "Amount", value: formatMoney(amount, { currency: ctx.currency }) },
        { label: "Date", value: date },
      ];
      if (p.category) summary.push({ label: "Category", value: p.category });

      return prepared(meta, summary, (key) =>
        commitCreate(
          "budget",
          "transactions",
          {
            date,
            description: p.description,
            amount,
            currency: ctx.currency,
            type: isExpense ? "expense" : "income",
            categoryId,
            accountId,
            status: "posted",
          },
          key,
          isExpense ? "Expense" : "Income",
        ),
      );
    }

    case "paycheck.record_paycheck": {
      const p = ACTION_SCHEMAS["paycheck.record_paycheck"].parse(parameters);
      const schedules = await recs<PaySchedule>("paycheck", "schedules");
      let scheduleId: string | undefined;
      if (p.schedule) {
        const res = resolveByName(schedules, p.schedule, (s) => s.name);
        if (res.status === "match") scheduleId = res.record.id;
      }
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const amount = round2(p.amount);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Paycheck Planner" },
          { label: "Action", value: "Record paycheck" },
          { label: "Amount", value: formatMoney(amount, { currency: ctx.currency }) },
          { label: "Date", value: date },
        ],
        (key) =>
          commitCreate(
            "paycheck",
            "paychecks",
            { date, expectedAmount: amount, actualAmount: amount, scheduleId },
            key,
            "Paycheck",
          ),
      );
    }

    case "debt.record_payment": {
      const p = ACTION_SCHEMAS["debt.record_payment"].parse(parameters);
      const debts = await recs<Debt>("debt", "debts");
      const debt = resolveOrClarify(debts, p.debt, (d) => d.name, "debt");
      if (isClarification(debt)) return debt;
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const amount = round2(p.amount);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Debt Payoff" },
          { label: "Action", value: "Record payment" },
          { label: "Debt", value: debt.name },
          { label: "Amount", value: formatMoney(amount, { currency: ctx.currency }) },
          { label: "Date", value: date },
        ],
        (key) =>
          commitCreate("debt", "payments", { debtId: debt.id, date, amount }, key, "Payment"),
      );
    }

    case "savings.add_contribution": {
      const p = ACTION_SCHEMAS["savings.add_contribution"].parse(parameters);
      const goals = await recs<SavingsGoal>("savings", "goals");
      const goal = resolveOrClarify(goals, p.goal, (g) => g.name, "savings goal");
      if (isClarification(goal)) return goal;
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const amount = round2(p.amount);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Savings Goals" },
          { label: "Action", value: "Add contribution" },
          { label: "Goal", value: goal.name },
          { label: "Amount", value: formatMoney(amount, { currency: ctx.currency }) },
          { label: "Date", value: date },
        ],
        (key) =>
          commitCreate(
            "savings",
            "movements",
            { goalId: goal.id, date, amount, kind: "contribution" as const },
            key,
            "Contribution",
          ),
      );
    }

    case "net-worth.add_asset": {
      const p = ACTION_SCHEMAS["net-worth.add_asset"].parse(parameters);
      const kind = p.kind ?? "asset";
      const value = round2(p.value);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Net Worth" },
          { label: "Action", value: kind === "asset" ? "Add asset" : "Add liability" },
          { label: "Name", value: p.name },
          { label: "Value", value: formatMoney(value, { currency: ctx.currency }) },
        ],
        (key) =>
          commitCreate(
            "net-worth",
            "items",
            {
              name: p.name,
              kind,
              category: p.category ?? "Other",
              value,
              currency: ctx.currency,
              valuationDate: ctx.today,
            },
            key,
            "Net-worth item",
          ),
      );
    }

    case "bookkeeping.record_income":
    case "bookkeeping.record_expense": {
      const isIncome = meta.id === "bookkeeping.record_income";
      const p = (
        isIncome
          ? ACTION_SCHEMAS["bookkeeping.record_income"]
          : ACTION_SCHEMAS["bookkeeping.record_expense"]
      ).parse(parameters);
      const contacts = await recs<BusinessContact>("bookkeeping", "contacts");
      let contactId: string | undefined;
      if (p.contact) {
        const res = resolveByName(contacts, p.contact, (c) => c.name);
        if (res.status === "match") contactId = res.record.id;
      }
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const amount = round2(p.amount);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Bookkeeping" },
          { label: "Action", value: isIncome ? "Record income" : "Record expense" },
          { label: "Description", value: p.description },
          { label: "Amount", value: formatMoney(amount, { currency: ctx.currency }) },
          { label: "Date", value: date },
        ],
        (key) =>
          commitCreate(
            "bookkeeping",
            "transactions",
            {
              date,
              description: p.description,
              amount,
              type: isIncome ? "revenue" : "expense",
              contactId,
              sourceType: "manual",
            },
            key,
            isIncome ? "Income" : "Expense",
          ),
      );
    }

    case "inventory.receive": {
      const p = ACTION_SCHEMAS["inventory.receive"].parse(parameters);
      const products = await recs<BusinessProduct>("inventory", "products");
      const assignedProducts = products.filter((item) => item.businessId);
      const product = resolveOrClarify(assignedProducts, p.product, (x) => x.name, "product");
      if (isClarification(product)) return product;
      const quantity = round2(p.quantity);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Inventory" },
          { label: "Action", value: "Receive stock" },
          { label: "Product", value: product.name },
          { label: "Quantity", value: `${quantity}` },
        ],
        (key) =>
          commitCreate(
            "inventory",
            "movements",
            {
              productId: product.id,
              businessId: product.businessId,
              date: ctx.today,
              type: "receipt",
              quantity,
              unitCost: p.unitCost,
            },
            key,
            "Stock receipt",
          ),
      );
    }

    case "sales.create_sale": {
      const p = ACTION_SCHEMAS["sales.create_sale"].parse(parameters);
      const [products, contacts, businesses] = await Promise.all([
        recs<BusinessProduct>("sales", "products"),
        recs<BusinessContact>("sales", "contacts"),
        recs<Business>("bookkeeping", "businesses"),
      ]);
      const activeBusinesses = businesses.filter((business) => !business.deleted);
      let business: Business | undefined;
      if (p.business) {
        const result = resolveByName(activeBusinesses, p.business, (item) => item.name);
        if (result.status !== "match") return { kind: "clarification", question: "Which business should own this sale?", options: activeBusinesses.map((item) => item.name) };
        business = result.record;
      } else if (activeBusinesses.length === 1) business = activeBusinesses[0];
      else return { kind: "clarification", question: activeBusinesses.length ? "Which business should own this sale?" : "Create a business before recording a sale.", options: activeBusinesses.map((item) => item.name) };
      const businessProducts = products.filter((product) => product.businessId === business?.id);
      const businessContacts = contacts.filter((contact) => contact.businessId === business?.id);
      let productId: string | undefined;
      if (p.product) {
        const res = resolveByName(businessProducts, p.product, (x) => x.name);
        if (res.status === "match") productId = res.record.id;
        else return { kind: "clarification", question: `Choose a product from ${business.name}.`, options: businessProducts.map((item) => item.name) };
      }
      let customerId: string | undefined;
      if (p.customer) {
        const res = resolveByName(businessContacts, p.customer, (c) => c.name);
        if (res.status === "match") customerId = res.record.id;
        else return { kind: "clarification", question: `Choose a customer from ${business.name}.`, options: businessContacts.map((item) => item.name) };
      }
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const total = round2(p.quantity * p.unitPrice);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Sales" },
          { label: "Action", value: "Record sale" },
          { label: "Business", value: business.name },
          { label: "Description", value: p.description },
          { label: "Quantity", value: `${p.quantity}` },
          { label: "Total", value: formatMoney(total, { currency: ctx.currency }) },
        ],
        (key) =>
          commitCreate(
            "sales",
            "sales",
            {
              date,
              description: p.description,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              discount: 0,
              returned: 0,
              taxRate: 0,
              status: "order",
              currency: business.currency || ctx.currency,
              businessId: business.id,
              productId,
              customerId,
            },
            key,
            "Sale",
          ),
      );
    }

    case "invoicing.prepare_invoice": {
      const p = ACTION_SCHEMAS["invoicing.prepare_invoice"].parse(parameters);
      const [invoices, contacts, businesses] = await Promise.all([
        recs<Invoice>("invoicing", "invoices"),
        recs<BusinessContact>("invoicing", "contacts"),
        recs<Business>("bookkeeping", "businesses"),
      ]);
      const activeBusinesses = businesses.filter((business) => !business.deleted);
      let business: Business | undefined;
      if (p.business) {
        const result = resolveByName(activeBusinesses, p.business, (item) => item.name);
        if (result.status !== "match") return { kind: "clarification", question: "Which business should own this invoice?", options: activeBusinesses.map((item) => item.name) };
        business = result.record;
      } else if (activeBusinesses.length === 1) business = activeBusinesses[0];
      else return { kind: "clarification", question: activeBusinesses.length ? "Which business should own this invoice?" : "Create a business before preparing an invoice.", options: activeBusinesses.map((item) => item.name) };
      const businessInvoices = invoices.filter((invoice) => invoice.businessId === business?.id);
      const businessContacts = contacts.filter((contact) => contact.businessId === business?.id);
      const customer = resolveOrClarify(businessContacts, p.customer, (c) => c.name, "customer");
      if (isClarification(customer)) return customer;
      const amount = round2(p.amount);
      const dueDate = dateOrClarify(p.dueDate, ctx.today);
      if (isClarification(dueDate)) return dueDate;
      const number = nextInvoiceNumber(businessInvoices);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Invoicing" },
          { label: "Action", value: "Draft invoice" },
          { label: "Business", value: business.name },
          { label: "Customer", value: customer.name },
          { label: "Amount", value: formatMoney(amount, { currency: ctx.currency }) },
          { label: "Due", value: dueDate },
        ],
        (key) =>
          commitCreate(
            "invoicing",
            "invoices",
            {
              number,
              customerId: customer.id,
              issueDate: ctx.today,
              dueDate,
              status: "draft",
              taxRate: p.taxRate ?? 0,
              discount: 0,
              currency: business.currency || ctx.currency,
              businessId: business.id,
              lines: [
                {
                  id: uid("line"),
                  description: p.description ?? "Services",
                  quantity: 1,
                  unitPrice: amount,
                },
              ],
            },
            key,
            "Invoice draft",
          ),
      );
    }

    case "wedding.add_guest": {
      const p = ACTION_SCHEMAS["wedding.add_guest"].parse(parameters);
      const seats = p.seats ?? 1;
      return prepared(
        meta,
        [
          { label: "Tool", value: "Wedding" },
          { label: "Action", value: "Add guest" },
          { label: "Guest", value: p.name },
          { label: "Seats", value: `${seats}` },
        ],
        (key) =>
          commitCreate(
            "wedding",
            "guests",
            {
              name: p.name,
              household: p.household ?? p.name,
              seats,
              rsvp: p.rsvp ?? "invited",
            },
            key,
            "Guest",
          ),
      );
    }

    case "property.add_expense": {
      const p = ACTION_SCHEMAS["property.add_expense"].parse(parameters);
      const properties = await recs<Property>("property", "properties");
      const property = resolveOrClarify(properties, p.property, (x) => x.name, "property");
      if (isClarification(property)) return property;
      const amount = round2(p.amount);
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      return prepared(
        meta,
        [
          { label: "Tool", value: "Property" },
          { label: "Action", value: "Add expense" },
          { label: "Property", value: property.name },
          { label: "Amount", value: formatMoney(amount, { currency: ctx.currency }) },
          { label: "Date", value: date },
        ],
        (key) =>
          commitCreate(
            "property",
            "expenses",
            { propertyId: property.id, date, category: p.category ?? "Other", amount },
            key,
            "Property expense",
          ),
      );
    }

    case "nutrition.log_food": {
      const p = ACTION_SCHEMAS["nutrition.log_food"].parse(parameters);
      const foods = await recs<NutritionFood>("nutrition", "foods");
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const meal = p.meal ?? "breakfast";

      const found = resolveByName(foods, p.name, (f) => f.name);
      if (found.status === "ambiguous") {
        return {
          kind: "clarification",
          question: `Which food did you mean by "${p.name}"?`,
          options: found.candidates.map((f) => f.name),
        };
      }

      let log: Omit<NutritionLog, keyof BaseRecord>;
      if (found.status === "match") {
        const food = found.record;
        const grams = p.grams ?? food.servingGrams ?? 100;
        const factor = grams / 100;
        log = {
          date,
          meal,
          foodId: food.id,
          name: food.name,
          grams,
          kcal: round2(food.kcal * factor),
          protein: round2(food.protein * factor),
          carbs: round2(food.carbs * factor),
          fat: round2(food.fat * factor),
          fiber: food.fiber ? round2(food.fiber * factor) : undefined,
        };
      } else {
        if (p.kcal === undefined) {
          return {
            kind: "clarification",
            question: `I don't have nutrition data for "${p.name}". Add it to Foods first, or tell me the calories.`,
          };
        }
        const grams = p.grams ?? 100;
        log = {
          date,
          meal,
          name: p.name,
          grams,
          kcal: p.kcal,
          protein: p.protein ?? 0,
          carbs: p.carbs ?? 0,
          fat: p.fat ?? 0,
        };
      }

      return prepared(
        meta,
        [
          { label: "Tool", value: "Nutrition" },
          { label: "Action", value: "Log food" },
          { label: "Food", value: log.name },
          { label: "Meal", value: meal },
          { label: "Calories", value: `${log.kcal} kcal` },
        ],
        (key) => commitCreate("nutrition", "logs", log, key, "Food entry"),
      );
    }

    case "projects.create_task": {
      const p = ACTION_SCHEMAS["projects.create_task"].parse(parameters);
      const [projects, tasks] = await Promise.all([
        recs<Project>("projects", "projects"),
        recs<Task>("projects", "tasks"),
      ]);
      const project = p.project
        ? resolveOrClarify(projects, p.project, (x) => x.name, "project")
        : projects.length === 1
          ? projects[0]
          : {
              kind: "clarification" as const,
              question: "Which project should this task belong to?",
              options: projects.slice(0, 8).map((item) => item.name),
            };
      if (isClarification(project)) return project;
      const dueDate = p.dueDate ? dateOrClarify(p.dueDate, ctx.today) : undefined;
      if (dueDate && isClarification(dueDate)) return dueDate;
      return prepared(
        meta,
        [
          { label: "Tool", value: "Projects" },
          { label: "Action", value: "Create task" },
          { label: "Task", value: p.title },
          { label: "Project", value: project.name },
          ...(dueDate ? [{ label: "Due", value: dueDate }] : []),
        ],
        (key) =>
          commitCreate(
            "projects",
            "tasks",
            {
              projectId: project.id,
              title: p.title,
              status: "todo",
              priority: p.priority ?? "medium",
              startDate: ctx.today,
              dueDate,
              order: tasks.length,
            },
            key,
            "Task",
          ),
      );
    }

    case "projects.complete_task": {
      const p = ACTION_SCHEMAS["projects.complete_task"].parse(parameters);
      const tasks = await recs<Task>("projects", "tasks");
      const open = tasks.filter((t) => t.status !== "done");
      const task = resolveOrClarify(open, p.task, (t) => t.title, "task");
      if (isClarification(task)) return task;
      return prepared(
        meta,
        [
          { label: "Tool", value: "Projects" },
          { label: "Action", value: "Complete task" },
          { label: "Task", value: task.title },
        ],
        (key) =>
          commitUpdate<Task>(
            "projects",
            "tasks",
            task,
            { status: "done", completedAt: new Date().toISOString() },
            key,
            "Task",
          ),
      );
    }

    case "habits.complete_habit": {
      const p = ACTION_SCHEMAS["habits.complete_habit"].parse(parameters);
      const habits = await recs<Habit>("habits", "habits");
      const habit = resolveOrClarify(habits, p.habit, (h) => h.name, "habit");
      if (isClarification(habit)) return habit;
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const completions = await recs<HabitCompletion>("habits", "completions");
      const already = completions.some((c) => c.habitId === habit.id && c.date === date);
      return prepared(
        meta,
        [
          { label: "Tool", value: "Habits" },
          { label: "Action", value: "Mark complete" },
          { label: "Habit", value: habit.name },
          { label: "Date", value: date },
        ],
        (key) =>
          already
            ? Promise.resolve({ ok: true, message: "That habit is already complete for that day.", toolId: "habits" })
            : commitCreate(
                "habits",
                "completions",
                { habitId: habit.id, date },
                key,
                "Habit completion",
              ),
      );
    }

    case "content.create_draft":
    case "content.schedule_post": {
      const isSchedule = meta.id === "content.schedule_post";
      const p = (
        isSchedule
          ? ACTION_SCHEMAS["content.schedule_post"]
          : ACTION_SCHEMAS["content.create_draft"]
      ).parse(parameters);
      const scheduledDate = isSchedule
        ? dateOrClarify(p.scheduledDate, ctx.today)
        : p.scheduledDate
          ? dateOrClarify(p.scheduledDate, ctx.today)
          : undefined;
      if (scheduledDate && isClarification(scheduledDate)) return scheduledDate;
      return prepared(
        meta,
        [
          { label: "Tool", value: "Content" },
          { label: "Action", value: isSchedule ? "Schedule post" : "Create draft" },
          { label: "Title", value: p.title },
          ...(scheduledDate ? [{ label: "Scheduled", value: scheduledDate }] : []),
        ],
        (key) =>
          commitCreate(
            "content",
            "posts",
            {
              title: p.title,
              platform: p.platform ?? "instagram",
              contentType: "contentType" in p ? (p.contentType ?? "post") : "post",
              status: isSchedule ? "scheduled" : "draft",
              scheduledDate,
              metricBasis: "reach",
            },
            key,
            isSchedule ? "Scheduled post" : "Draft",
          ),
      );
    }

    default:
      return { kind: "clarification", question: "I couldn't match that to an action." };
  }
}

/* -------------------------------- queries ------------------------------- */

export async function runQuery(
  actionId: string | undefined,
  parameters: Record<string, unknown>,
  ctx: ExecContext,
): Promise<QueryResult | Clarification> {
  if (!actionId) {
    return {
      title: "Gridhub AI",
      lines: ["I can answer questions about your tools once a local model is installed."],
    };
  }

  const meta = getAction(actionId);
  if (!meta) return { title: "Gridhub AI", lines: ["I don't recognise that question."] };

  if (!canUseTool(meta.toolId, ctx.entitlement)) {
    return { title: "Not available", lines: [permissionMessage(meta.toolId, ctx.entitlement)] };
  }

  switch (meta.id) {
    case "budget.query_spend": {
      const p = ACTION_SCHEMAS["budget.query_spend"].parse(parameters);
      const period = resolvePeriod(p.period, ctx.today);
      const [transactions, categories, budgets] = await Promise.all([
        recs<MoneyTransaction>("budget", "transactions"),
        recs<MoneyCategory>("budget", "categories"),
        recs<MoneyBudget>("budget", "budgets"),
      ]);
      const summary = budgetSummary({ transactions, categories, budgets, period });
      return {
        title: `Spending · ${period}`,
        lines: [
          `Expenses: ${formatMoney(summary.expenses, { currency: ctx.currency })}`,
          `Income: ${formatMoney(summary.income, { currency: ctx.currency })}`,
          `Net cash flow: ${formatMoney(summary.netCashFlow, { currency: ctx.currency })}`,
        ],
      };
    }

    case "budget.query_remaining": {
      const p = ACTION_SCHEMAS["budget.query_remaining"].parse(parameters);
      const period = resolvePeriod(p.month, ctx.today);
      const [transactions, categories, budgets] = await Promise.all([
        recs<MoneyTransaction>("budget", "transactions"),
        recs<MoneyCategory>("budget", "categories"),
        recs<MoneyBudget>("budget", "budgets"),
      ]);
      const summary = budgetSummary({ transactions, categories, budgets, period });
      return {
        title: `Budget · ${period}`,
        lines: [
          `Allocated: ${formatMoney(summary.budgetAllocation, { currency: ctx.currency })}`,
          `Remaining: ${formatMoney(summary.budgetRemaining, { currency: ctx.currency })}`,
          `Spent so far: ${formatMoney(summary.expenses, { currency: ctx.currency })}`,
        ],
      };
    }

    case "inventory.query_low_stock": {
      const [products, movements] = await Promise.all([
        recs<BusinessProduct>("inventory", "products"),
        recs<InventoryMovement>("inventory", "movements"),
      ]);
      const summary = inventorySummary(products, movements);
      return {
        title: "Low stock",
        lines: summary.lowStock.length
          ? summary.lowStock.map(
              (v) =>
                `${v.product.name}: ${v.valuation.quantity} left (reorder at ${v.product.reorderThreshold})`,
            )
          : ["Nothing is below its reorder threshold."],
      };
    }

    case "invoicing.query_unpaid": {
      const [invoices, payments] = await Promise.all([
        recs<Invoice>("invoicing", "invoices"),
        recs<Payment>("invoicing", "payments"),
      ]);
      const summary = invoicingSummary(invoices, payments, ctx.today);
      const unpaid = summary.rows.filter(
        (r) =>
          r.invoice.status !== "draft" &&
          r.invoice.status !== "void" &&
          r.totals.balanceDue > 0,
      );
      return {
        title: "Unpaid invoices",
        lines: unpaid.length
          ? unpaid.map(
              (r) =>
                `${r.invoice.number}: ${formatMoney(r.totals.balanceDue, { currency: r.invoice.currency || ctx.currency })} due ${r.invoice.dueDate}`,
            )
          : ["No outstanding invoices."],
      };
    }

    case "cash-flow.query_forecast": {
      const [items, scenarios, businesses] = await Promise.all([
        recs<CashForecastItem>("cash-flow", "items"),
        recs<CashScenario>("cash-flow", "scenarios"),
        recs<Business>("bookkeeping", "businesses"),
      ]);
      const activeScenarios = scenarios.filter((scenario) => !scenario.deleted);
      return {
        title: "Cash forecast",
        lines: activeScenarios.length ? activeScenarios.flatMap((scenario) => {
          const currency = businesses.find((business) => business.id === scenario.businessId)?.currency ?? ctx.currency;
          const scenarioItems = items.filter((item) => item.scenarioId === scenario.id);
          const forecast = forecastCashFlow(scenarioItems, scenario, { startDate: ctx.today });
          return [
            `${scenario.name} · ${currency}: Closing cash (13 weeks): ${formatMoney(forecast.closingCash, { currency })}`,
            forecast.runwayMonths != null ? `Runway: ${forecast.runwayMonths.toFixed(1)} months` : "Runway: not enough data",
            forecast.shortfall > 0 ? `Shortfall: ${formatMoney(forecast.shortfall, { currency })}` : "No shortfall projected.",
          ];
        }) : ["No forecast scenarios have been set up yet."],
      };
    }

    case "projects.query_deadlines": {
      const tasks = await recs<Task>("projects", "tasks");
      const upcoming = tasks
        .filter((t) => t.status !== "done" && t.dueDate && t.dueDate >= ctx.today)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .slice(0, 10);
      return {
        title: "Upcoming deadlines",
        lines: upcoming.length
          ? upcoming.map((t) => `${t.title} — ${t.dueDate}`)
          : ["Nothing is due."],
      };
    }

    case "nutrition.query_summary": {
      const p = ACTION_SCHEMAS["nutrition.query_summary"].parse(parameters);
      const date = dateOrClarify(p.date, ctx.today);
      if (isClarification(date)) return date;
      const logs = await recs<NutritionLog>("nutrition", "logs");
      const totals = dailyTotals(logs, date);
      return {
        title: `Nutrition · ${date}`,
        lines: [
          `Calories: ${Math.round(totals.kcal)} kcal`,
          `Protein: ${totals.protein.toFixed(1)} g`,
          `Carbs: ${totals.carbs.toFixed(1)} g`,
          `Fat: ${totals.fat.toFixed(1)} g`,
        ],
      };
    }

    default:
      return { title: "Gridhub AI", lines: ["I can't answer that one yet."] };
  }
}
