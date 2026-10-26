import { defineTab, type LedgerTab } from "@/components/tools/ledger-tool";
import { formatMoney, formatPercent } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type {
  Debt,
  DebtPayment,
  GoalMovement,
  Holding,
  MoneyAccount,
  MoneyBudget,
  MoneyCategory,
  MoneyTransaction,
  NetWorthItem,
  PaySchedule,
  Paycheck,
  PaycheckAllocation,
  RecurringBill,
  SavingsGoal,
  ValuationSnapshot,
} from "@/lib/types";
import { ACCOUNT_KINDS, options, rows, today, TX_TYPES, type DataMap } from "./shared";

function lookup<T extends { id: string; name?: string }>(list: T[], id?: string): string {
  return list.find((x) => x.id === id)?.name ?? "—";
}

export function budgetTabs(data: DataMap): LedgerTab[] {
  const accounts = rows<MoneyAccount>(data, "accounts");
  const categories = rows<MoneyCategory>(data, "categories");
  const expenseCats = categories.filter((c) => c.kind === "expense");

  return [
    defineTab<MoneyTransaction>({
      id: "transactions",
      label: "Transactions",
      icon: "swap",
      collection: "transactions",
      addLabel: "Add transaction",
      emptyTitle: "No transactions yet",
      emptyDescription:
        "Add income and expenses to see your income, spending, savings rate and category variance update automatically.",
      searchText: (r) => `${r.description} ${r.notes ?? ""} ${lookup(categories, r.categoryId)}`,
      defaults: { date: today(), status: "posted", type: "expense", currency: "USD" },
      fields: [
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "description", label: "Description", type: "text", required: true, placeholder: "Groceries" },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0, step: "0.01" },
        { key: "type", label: "Type", type: "select", required: true, options: TX_TYPES, defaultValue: "expense" },
        {
          key: "categoryId",
          label: "Category",
          type: "select",
          options: options(categories),
          help: "Transfers and savings movements are excluded from spending totals.",
        },
        { key: "accountId", label: "Account", type: "select", options: options(accounts) },
        {
          key: "toAccountId",
          label: "To account",
          type: "select",
          options: options(accounts),
          help: "Only for transfers.",
          visibleWhen: (v) => v.type === "transfer" || v.type === "savings",
        },
        { key: "status", label: "Status", type: "select", options: [{ value: "posted", label: "Posted" }, { value: "pending", label: "Pending" }], defaultValue: "posted" },
        { key: "notes", label: "Notes", type: "textarea", span: 2 },
      ],
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "description", header: "Description", value: (r) => r.description, render: (r) => <span className="font-medium">{r.description}</span> },
        { key: "category", header: "Category", defaultHidden: true, value: (r) => lookup(categories, r.categoryId), render: (r) => lookup(categories, r.categoryId) },
        {
          key: "type",
          header: "Type",
          value: (r) => r.type,
          render: (r) => (
            <span className="capitalize text-fg-muted">{r.type}</span>
          ),
        },
        {
          key: "amount",
          header: "Amount",
          align: "right",
          value: (r) => (r.type === "expense" ? -r.amount : r.amount),
          render: (r) => (
            <span style={{ color: r.type === "expense" ? "var(--negative)" : r.type === "income" ? "var(--positive)" : "var(--fg-muted)" }}>
              {r.type === "expense" ? "−" : r.type === "income" ? "+" : ""}
              {formatMoney(r.amount)}
            </span>
          ),
        },
        { key: "status", header: "Status", defaultHidden: true, value: (r) => r.status, render: (r) => <span className="capitalize text-fg-muted">{r.status}</span> },
      ],
    }),
    defineTab<MoneyAccount>({
      id: "accounts",
      label: "Accounts",
      icon: "bank",
      collection: "accounts",
      addLabel: "Add account",
      emptyTitle: "No accounts yet",
      emptyDescription: "Add the accounts you spend from so balances and transfers are accurate.",
      fields: [
        { key: "name", label: "Account name", type: "text", required: true },
        { key: "kind", label: "Type", type: "select", options: ACCOUNT_KINDS, required: true, defaultValue: "checking" },
        { key: "openingBalance", label: "Opening balance", type: "currency", defaultValue: 0 },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      columns: [
        { key: "name", header: "Account", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "kind", header: "Type", value: (r) => r.kind, render: (r) => <span className="capitalize text-fg-muted">{r.kind}</span> },
        { key: "openingBalance", header: "Opening", align: "right", value: (r) => r.openingBalance, render: (r) => formatMoney(r.openingBalance) },
      ],
    }),
    defineTab<MoneyCategory>({
      id: "categories",
      label: "Categories",
      icon: "tag",
      collection: "categories",
      addLabel: "Add category",
      emptyTitle: "No categories yet",
      emptyDescription: "Categories make variance reporting possible. Add the ones you actually use.",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "kind", label: "Kind", type: "select", options: [{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }], defaultValue: "expense", required: true },
        { key: "group", label: "Group", type: "text", placeholder: "Essentials, Lifestyle…" },
        { key: "monthlyBudget", label: "Monthly budget", type: "currency", defaultValue: 0 },
      ],
      columns: [
        { key: "name", header: "Category", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "kind", header: "Kind", value: (r) => r.kind, render: (r) => <span className="capitalize text-fg-muted">{r.kind}</span> },
        { key: "monthlyBudget", header: "Monthly budget", align: "right", value: (r) => r.monthlyBudget ?? 0, render: (r) => formatMoney(r.monthlyBudget ?? 0) },
      ],
    }),
    defineTab<MoneyBudget>({
      id: "budgets",
      label: "Monthly budgets",
      icon: "target",
      collection: "budgets",
      addLabel: "Set budget",
      emptyTitle: "No budgets set",
      emptyDescription: "Allocate an amount per category per month to unlock budget remaining and variance.",
      fields: [
        { key: "month", label: "Month", type: "text", required: true, placeholder: "2026-10", defaultValue: today().slice(0, 7) },
        { key: "categoryId", label: "Category", type: "select", options: options(expenseCats), required: true },
        { key: "amount", label: "Allocated", type: "currency", required: true, min: 0 },
      ],
      columns: [
        { key: "month", header: "Month", primary: true, value: (r) => r.month, render: (r) => r.month },
        { key: "categoryId", header: "Category", value: (r) => lookup(categories, r.categoryId), render: (r) => lookup(categories, r.categoryId) },
        { key: "amount", header: "Allocated", align: "right", value: (r) => r.amount, render: (r) => formatMoney(r.amount) },
      ],
    }),
    defineTab<RecurringBill>({
      id: "bills",
      label: "Recurring bills",
      icon: "repeat",
      collection: "bills",
      addLabel: "Add bill",
      emptyTitle: "No recurring bills",
      emptyDescription: "Add bills to see what is due soon on your dashboard.",
      fields: [
        { key: "name", label: "Bill", type: "text", required: true },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0 },
        { key: "dueDay", label: "Due day", type: "number", required: true, min: 1, max: 31, defaultValue: 1 },
        { key: "frequency", label: "Frequency", type: "select", options: [{ value: "monthly", label: "Monthly" }, { value: "weekly", label: "Weekly" }, { value: "annual", label: "Annual" }], defaultValue: "monthly" },
        { key: "categoryId", label: "Category", type: "select", options: options(categories) },
        { key: "active", label: "Active", type: "checkbox", defaultValue: true },
      ],
      columns: [
        { key: "name", header: "Bill", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "amount", header: "Amount", align: "right", value: (r) => r.amount, render: (r) => formatMoney(r.amount) },
        { key: "dueDay", header: "Due day", value: (r) => r.dueDay, render: (r) => `Day ${r.dueDay}` },
        { key: "active", header: "Active", value: (r) => (r.active ? 1 : 0), render: (r) => (r.active ? "Yes" : "No") },
      ],
    }),
  ];
}

export function paycheckTabs(data: DataMap): LedgerTab[] {
  const schedules = rows<PaySchedule>(data, "schedules");
  const paychecks = rows<Paycheck>(data, "paychecks");
  return [
    defineTab<PaySchedule>({
      id: "schedule",
      label: "Pay schedule",
      icon: "calendar-days",
      collection: "schedules",
      addLabel: "Add schedule",
      emptyTitle: "No pay schedule",
      emptyDescription: "Tell Gridhub when you get paid so it can count down to payday.",
      fields: [
        { key: "name", label: "Name", type: "text", required: true, placeholder: "Salary" },
        { key: "frequency", label: "Frequency", type: "select", options: [{ value: "weekly", label: "Weekly" }, { value: "biweekly", label: "Every two weeks" }, { value: "semimonthly", label: "Twice a month" }, { value: "monthly", label: "Monthly" }], required: true, defaultValue: "monthly" },
        { key: "nextPayDate", label: "Next pay date", type: "date", required: true, defaultValue: today() },
        { key: "expectedAmount", label: "Expected amount", type: "currency", required: true, min: 0 },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      columns: [
        { key: "name", header: "Schedule", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "frequency", header: "Frequency", value: (r) => r.frequency, render: (r) => r.frequency },
        { key: "nextPayDate", header: "Next pay date", value: (r) => r.nextPayDate, render: (r) => formatDate(r.nextPayDate) },
        { key: "expectedAmount", header: "Expected", align: "right", value: (r) => r.expectedAmount, render: (r) => formatMoney(r.expectedAmount) },
      ],
    }),
    defineTab<Paycheck>({
      id: "paychecks",
      label: "Paychecks",
      icon: "dollar",
      collection: "paychecks",
      addLabel: "Add paycheck",
      emptyTitle: "No paychecks recorded",
      emptyDescription: "Record a paycheck, then split it across bills, spending and savings.",
      fields: [
        { key: "date", label: "Pay date", type: "date", required: true, defaultValue: today() },
        { key: "expectedAmount", label: "Expected", type: "currency", required: true, min: 0 },
        { key: "actualAmount", label: "Actual received", type: "currency", help: "Leave blank until it lands." },
        { key: "savingsAllocation", label: "Moved to savings", type: "currency", defaultValue: 0 },
        { key: "scheduleId", label: "Schedule", type: "select", options: options(schedules) },
        { key: "notes", label: "Notes", type: "textarea", span: 2 },
      ],
      columns: [
        { key: "date", header: "Pay date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "expectedAmount", header: "Expected", align: "right", value: (r) => r.expectedAmount, render: (r) => formatMoney(r.expectedAmount) },
        { key: "actualAmount", header: "Actual", align: "right", value: (r) => r.actualAmount ?? 0, render: (r) => (r.actualAmount ? formatMoney(r.actualAmount) : "—") },
        { key: "savingsAllocation", header: "To savings", align: "right", value: (r) => r.savingsAllocation ?? 0, render: (r) => formatMoney(r.savingsAllocation ?? 0) },
      ],
    }),
    defineTab<PaycheckAllocation>({
      id: "allocations",
      label: "Allocations",
      icon: "layers",
      collection: "allocations",
      addLabel: "Assign money",
      emptyTitle: "Nothing assigned yet",
      emptyDescription: "Assign bills, planned spending and savings to a paycheck. Available balance updates live.",
      fields: [
        { key: "paycheckId", label: "Paycheck", type: "select", options: options(paychecks), required: true },
        { key: "label", label: "Label", type: "text", required: true, placeholder: "Rent" },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0 },
        { key: "kind", label: "Kind", type: "select", options: [{ value: "bill", label: "Bill" }, { value: "spending", label: "Planned spending" }, { value: "savings", label: "Savings" }], required: true, defaultValue: "bill" },
        { key: "paid", label: "Already paid", type: "checkbox" },
      ],
      columns: [
        { key: "label", header: "Label", primary: true, value: (r) => r.label, render: (r) => r.label },
        { key: "kind", header: "Kind", value: (r) => r.kind, render: (r) => <span className="capitalize text-fg-muted">{r.kind}</span> },
        { key: "amount", header: "Amount", align: "right", value: (r) => r.amount, render: (r) => formatMoney(r.amount) },
        { key: "paid", header: "Paid", value: (r) => (r.paid ? 1 : 0), render: (r) => (r.paid ? "Yes" : "No") },
      ],
    }),
  ];
}

export function debtTabs(data: DataMap): LedgerTab[] {
  const debts = rows<Debt>(data, "debts");
  return [
    defineTab<Debt>({
      id: "debts",
      label: "Debts",
      icon: "trending-down",
      collection: "debts",
      addLabel: "Add debt",
      emptyTitle: "No debts added",
      emptyDescription: "Add a balance, rate and minimum payment to project your debt-free date.",
      fields: [
        { key: "name", label: "Debt", type: "text", required: true, placeholder: "Visa card" },
        { key: "openingPrincipal", label: "Current balance", type: "currency", required: true, min: 0 },
        { key: "annualRate", label: "Annual rate %", type: "number", required: true, min: 0, step: "0.01", defaultValue: 0 },
        { key: "minimumPayment", label: "Minimum payment", type: "currency", required: true, min: 0 },
        { key: "extraPayment", label: "Extra payment", type: "currency", defaultValue: 0 },
        { key: "frequency", label: "Payment frequency", type: "select", options: [{ value: "monthly", label: "Monthly" }, { value: "biweekly", label: "Every two weeks" }], defaultValue: "monthly" },
        { key: "lender", label: "Lender", type: "text" },
        { key: "dueDay", label: "Contractual due day of month", type: "number", min: 1, max: 31, help: "Leave blank if unknown. Used only for monthly schedules." },
        { key: "nextDueDate", label: "Next contractual payment date", type: "date", help: "Required to project biweekly payment dates." },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      columns: [
        { key: "name", header: "Debt", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "openingPrincipal", header: "Balance", align: "right", value: (r) => r.openingPrincipal, render: (r) => formatMoney(r.openingPrincipal) },
        { key: "annualRate", header: "Rate", align: "right", value: (r) => r.annualRate, render: (r) => `${r.annualRate}%` },
        { key: "minimumPayment", header: "Minimum", align: "right", value: (r) => r.minimumPayment, render: (r) => formatMoney(r.minimumPayment) },
      ],
    }),
    defineTab<DebtPayment>({
      id: "payments",
      label: "Payments",
      icon: "receipt",
      collection: "payments",
      addLabel: "Record payment",
      emptyTitle: "No payments recorded",
      emptyDescription: "Log payments to keep the balance and interest history accurate.",
      fields: [
        { key: "debtId", label: "Debt", type: "select", options: options(debts), required: true },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "amount", label: "Payment", type: "currency", required: true, min: 0 },
        { key: "principal", label: "Principal portion", type: "currency" },
        { key: "interest", label: "Interest portion", type: "currency" },
        { key: "fees", label: "Fees", type: "currency", defaultValue: 0 },
        { key: "status", label: "Status", type: "select", options: [{ value: "paid", label: "Paid" }, { value: "partial", label: "Partially paid" }, { value: "planned", label: "Planned" }, { value: "skipped", label: "Skipped" }], defaultValue: "paid" },
        { key: "notes", label: "Notes", type: "textarea", span: 2 },
      ],
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "debtId", header: "Debt", value: (r) => lookup(debts, r.debtId), render: (r) => lookup(debts, r.debtId) },
        { key: "amount", header: "Amount", align: "right", value: (r) => r.amount, render: (r) => formatMoney(r.amount) },
        { key: "interest", header: "Interest", align: "right", value: (r) => r.interest ?? 0, render: (r) => formatMoney(r.interest ?? 0) },
        { key: "status", header: "Status", value: (r) => r.status ?? "paid", render: (r) => <span className="capitalize">{r.status ?? "paid"}</span> },
      ],
    }),
  ];
}

export function savingsTabs(data: DataMap): LedgerTab[] {
  const goals = rows<SavingsGoal>(data, "goals");
  return [
    defineTab<SavingsGoal>({
      id: "goals",
      label: "Goals",
      icon: "piggy-bank",
      collection: "goals",
      addLabel: "Add goal",
      emptyTitle: "No savings goals",
      emptyDescription: "Set a target and date. Gridhub calculates the monthly amount required to arrive on time.",
      fields: [
        { key: "name", label: "Goal", type: "text", required: true, placeholder: "Emergency fund" },
        { key: "targetAmount", label: "Target amount", type: "currency", required: true, min: 0 },
        { key: "targetDate", label: "Target date", type: "date" },
        { key: "openingBalance", label: "Starting balance", type: "currency", defaultValue: 0 },
        { key: "kind", label: "Type", type: "select", options: [{ value: "goal", label: "Goal" }, { value: "emergency", label: "Emergency fund" }], defaultValue: "goal" },
        { key: "monthlyEssentials", label: "Monthly essentials", type: "currency", help: "Used to show months of cover for an emergency fund." },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      columns: [
        { key: "name", header: "Goal", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "targetAmount", header: "Target", align: "right", value: (r) => r.targetAmount, render: (r) => formatMoney(r.targetAmount) },
        { key: "targetDate", header: "Target date", value: (r) => r.targetDate ?? "", render: (r) => formatDate(r.targetDate) },
        { key: "kind", header: "Type", value: (r) => r.kind, render: (r) => r.kind },
      ],
    }),
    defineTab<GoalMovement>({
      id: "movements",
      label: "Contributions",
      icon: "arrowUp",
      collection: "movements",
      addLabel: "Add movement",
      emptyTitle: "No contributions yet",
      emptyDescription: "Log contributions and withdrawals — they feed goal progress and forecasts.",
      fields: [
        { key: "goalId", label: "Goal", type: "select", options: options(goals), required: true },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0 },
        { key: "kind", label: "Direction", type: "select", options: [{ value: "contribution", label: "Contribution" }, { value: "withdrawal", label: "Withdrawal" }], required: true, defaultValue: "contribution" },
        { key: "note", label: "Note", type: "text" },
      ],
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "goalId", header: "Goal", value: (r) => lookup(goals, r.goalId), render: (r) => lookup(goals, r.goalId) },
        { key: "kind", header: "Direction", value: (r) => r.kind, render: (r) => r.kind },
        {
          key: "amount",
          header: "Amount",
          align: "right",
          value: (r) => (r.kind === "withdrawal" ? -r.amount : r.amount),
          render: (r) => (
            <span style={{ color: r.kind === "withdrawal" ? "var(--negative)" : "var(--positive)" }}>
              {r.kind === "withdrawal" ? "−" : "+"}
              {formatMoney(r.amount)}
            </span>
          ),
        },
      ],
    }),
  ];
}

export function netWorthTabs(data: DataMap): LedgerTab[] {
  return [
    defineTab<NetWorthItem>({
      id: "items",
      label: "Assets & liabilities",
      icon: "gauge",
      collection: "items",
      addLabel: "Add item",
      emptyTitle: "Nothing on the balance sheet",
      emptyDescription: "Add assets and liabilities with a valuation date to calculate net worth.",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "kind", label: "Kind", type: "select", options: [{ value: "asset", label: "Asset" }, { value: "liability", label: "Liability" }], required: true, defaultValue: "asset" },
        { key: "category", label: "Category", type: "text", placeholder: "Cash, Property, Loan…" },
        { key: "value", label: "Value", type: "currency", required: true, min: 0 },
        { key: "valuationDate", label: "Valued on", type: "date", required: true, defaultValue: today() },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      columns: [
        { key: "name", header: "Name", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "kind", header: "Kind", value: (r) => r.kind, render: (r) => <span className="capitalize text-fg-muted">{r.kind}</span> },
        { key: "category", header: "Category", value: (r) => r.category, render: (r) => r.category },
        { key: "value", header: "Value", align: "right", value: (r) => r.value, render: (r) => formatMoney(r.value, { currency: r.currency }) },
        { key: "valuationDate", header: "Valued", value: (r) => r.valuationDate, render: (r) => formatDate(r.valuationDate) },
      ],
    }),
    defineTab<Holding>({
      id: "holdings",
      label: "Holdings",
      icon: "line-chart",
      collection: "holdings",
      addLabel: "Add holding",
      emptyTitle: "No holdings",
      emptyDescription: "Track quantity, price and cost basis. Prices are manual — Gridhub never invents market data.",
      fields: [
        { key: "name", label: "Holding", type: "text", required: true },
        { key: "symbol", label: "Symbol", type: "text" },
        { key: "quantity", label: "Quantity", type: "number", required: true, min: 0, step: "0.0001" },
        { key: "unitPrice", label: "Unit price", type: "currency", required: true, min: 0 },
        { key: "costBasis", label: "Total cost basis", type: "currency", required: true, min: 0 },
        { key: "valuationDate", label: "Price date", type: "date", required: true, defaultValue: today() },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      columns: [
        { key: "name", header: "Holding", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "quantity", header: "Qty", align: "right", value: (r) => r.quantity, render: (r) => r.quantity },
        { key: "unitPrice", header: "Price", align: "right", value: (r) => r.unitPrice, render: (r) => formatMoney(r.unitPrice, { currency: r.currency }) },
        {
          key: "marketValue",
          header: "Market value",
          align: "right",
          value: (r) => r.quantity * r.unitPrice,
          render: (r) => formatMoney(r.quantity * r.unitPrice, { currency: r.currency }),
        },
        {
          key: "gain",
          header: "Gain",
          align: "right",
          value: (r) => r.quantity * r.unitPrice - r.costBasis,
          render: (r) => {
            const gain = r.quantity * r.unitPrice - r.costBasis;
            return (
              <span style={{ color: gain >= 0 ? "var(--positive)" : "var(--negative)" }}>
                {formatMoney(gain, { currency: r.currency, signed: true })}
              </span>
            );
          },
        },
      ],
    }),
    defineTab<ValuationSnapshot>({
      id: "snapshots",
      label: "Snapshots",
      icon: "camera",
      collection: "snapshots",
      addLabel: "Add snapshot",
      emptyTitle: "No snapshots",
      emptyDescription: "A dated snapshot is what makes net-worth history possible.",
      fields: [
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "totalAssets", label: "Total assets", type: "currency", required: true, min: 0 },
        { key: "totalLiabilities", label: "Total liabilities", type: "currency", required: true, min: 0 },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
        { key: "note", label: "Note", type: "text" },
      ],
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "totalAssets", header: "Assets", align: "right", value: (r) => r.totalAssets, render: (r) => formatMoney(r.totalAssets) },
        { key: "totalLiabilities", header: "Liabilities", align: "right", value: (r) => r.totalLiabilities, render: (r) => formatMoney(r.totalLiabilities) },
        {
          key: "net",
          header: "Net worth",
          align: "right",
          value: (r) => r.totalAssets - r.totalLiabilities,
          render: (r) => formatMoney(r.totalAssets - r.totalLiabilities),
        },
      ],
    }),
  ];
}

export function moneyPercent(n: number | null): string {
  return formatPercent(n);
}
