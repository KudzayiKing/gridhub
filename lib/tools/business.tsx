import { defineTab, type LedgerTab } from "@/components/tools/ledger-tool";
import type { FormField } from "@/components/data/record-form";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type {
  BusinessAccount,
  BusinessContact,
  BusinessProduct,
  BusinessTransaction,
  Business,
  BaseRecord,
  CashForecastItem,
  CashScenario,
  Invoice,
  InvoiceLine,
  InventoryMovement,
  Payment,
  Sale,
  SalesTarget,
} from "@/lib/types";
import { invoiceTotals, nextInvoiceNumber } from "@/lib/calc/business";
import { options, rows, today, type DataMap } from "./shared";
import { BookkeepingIntegrationPanel } from "@/components/tools/bookkeeping-integration-panel";
import { useI18n } from "@/lib/i18n";

const BIZ_TX_TYPES = [
  { value: "revenue", label: "Revenue received" },
  { value: "expense", label: "Operating expense" },
  { value: "owner_contribution", label: "Owner contribution" },
  { value: "owner_draw", label: "Owner draw" },
  { value: "loan_proceeds", label: "Loan received" },
  { value: "loan_repayment", label: "Loan repayment" },
  { value: "transfer", label: "Internal transfer" },
];

const MOVEMENT_TYPES = [
  { value: "receipt", label: "Stock received" },
  { value: "dispatch", label: "Stock dispatched" },
  { value: "return", label: "Customer return" },
  { value: "adjustment_positive", label: "Positive adjustment" },
  { value: "adjustment_negative", label: "Negative adjustment" },
  { value: "writeoff", label: "Write-off" },
];

export function bookkeepingTabs(data: DataMap, businesses: Business[] = [], selectedBusinessId: string | null = null): LedgerTab[] {
  const liveBusinesses = businesses.filter((business) => !business.deleted);
  const businessOptions = [
    { value: "__unassigned__", label: "Unassigned legacy record", raw: true, disabled: true },
    ...options(selectedBusinessId ? liveBusinesses.filter((business) => business.id === selectedBusinessId) : liveBusinesses),
  ];
  const scoped = <T extends { businessId?: string; deleted?: boolean }>(items: T[]) =>
    selectedBusinessId ? items.filter((item) => item.businessId === selectedBusinessId) : items;
  const allAccounts = rows<BusinessAccount>(data, "accounts");
  const allContacts = rows<BusinessContact>(data, "contacts");
  const accounts = scoped(allAccounts);
  const contacts = scoped(allContacts);
  const scopeFilter = (row: BaseRecord) => !selectedBusinessId || (row as BaseRecord & { businessId?: string }).businessId === selectedBusinessId;
  const businessIdField: FormField = {
    key: "businessId",
    label: "Business",
    type: "select",
    required: true,
    options: businessOptions,
    defaultValue: selectedBusinessId ?? "",
    help: "Choose which business owns this record.",
  };
  const resolveBusiness = (values: Record<string, unknown>) => liveBusinesses.find((business) => business.id === values.businessId);
  return [
    defineTab<BusinessTransaction>({
      id: "transactions",
      label: "Transactions",
      icon: "swap",
      collection: "transactions",
      addLabel: "Add entry",
      emptyTitle: "Your books are empty",
      emptyDescription:
        "Record money in and out. Owner contributions and loan proceeds are cash movements, not revenue.",
      searchText: (r) => `${r.description} ${r.notes ?? ""}`,
      defaults: { date: today(), type: "revenue", accountId: accounts[0]?.id, businessId: selectedBusinessId ?? "" },
      fields: [
        businessIdField,
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "description", label: "Description", type: "text", required: true },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0 },
        { key: "type", label: "Classification", type: "select", required: true, options: BIZ_TX_TYPES, defaultValue: "revenue" },
        { key: "categoryId", label: "Category", type: "text", placeholder: "Sales, Rent, Payroll…" },
        { key: "accountId", label: "Account", type: "select", options: options(accounts) },
        { key: "contactId", label: "Contact", type: "select", options: options(contacts) },
        { key: "notes", label: "Notes", type: "textarea", span: 2 },
      ],
      filter: scopeFilter,
      legacyScopeField: "businessId",
      prepareValues: (values, editing) => {
        if ((editing as BusinessTransaction | undefined)?.sourceType && (editing as BusinessTransaction).sourceType !== "manual") throw new Error("Linked Bookkeeping entries are managed from their source tool.");
        const businessId = values.businessId === "__unassigned__" ? undefined : String(values.businessId ?? "");
        const business = resolveBusiness({ ...values, businessId });
        const account = allAccounts.find((item) => item.id === values.accountId);
        const contact = allContacts.find((item) => item.id === values.contactId);
        if (account && account.businessId !== businessId) throw new Error("Choose an account from the selected business.");
        if (contact && contact.businessId !== businessId) throw new Error("Choose a contact from the selected business.");
        return { ...values, businessId, currency: business?.currency ?? values.currency };
      },
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "description", header: "Description", value: (r) => r.description, render: (r) => <span className="font-medium">{r.description}</span> },
        { key: "sourceId", header: "Source", value: (r) => r.sourceType ? `${r.sourceType}:${r.sourceId ?? ""}` : "manual", render: (r) => <BookkeepingSourceLabel row={r} /> },
        { key: "type", header: "Type", value: (r) => r.type, render: (r) => <span className="capitalize text-fg-muted">{r.type.replace(/_/g, " ")}</span> },
        {
          key: "amount",
          header: "Amount",
          align: "right",
          value: (r) => r.amount,
          render: (r) => (
            <span style={{ color: r.type === "expense" || r.type === "owner_draw" ? "var(--negative)" : "var(--fg)" }}>
              {formatMoney(r.amount)}
            </span>
          ),
        },
      ],
      canEdit: (row) => {
        const transaction = row as BusinessTransaction;
        return !transaction.sourceType || transaction.sourceType === "manual";
      },
      canDelete: (row) => {
        const transaction = row as BusinessTransaction;
        return !transaction.sourceType || transaction.sourceType === "manual";
      },
    }),
    defineTab<BusinessAccount>({
      id: "accounts",
      label: "Accounts",
      icon: "bank",
      collection: "accounts",
      addLabel: "Add account",
      emptyTitle: "No business accounts",
      emptyDescription: "Add the bank or cash accounts your business uses.",
      defaults: { businessId: selectedBusinessId ?? "", kind: "bank", openingBalance: 0 },
      fields: [
        businessIdField,
        { key: "name", label: "Account", type: "text", required: true },
        { key: "kind", label: "Type", type: "select", options: [{ value: "bank", label: "Bank" }, { value: "cash", label: "Cash" }, { value: "card", label: "Card" }], defaultValue: "bank" },
        { key: "openingBalance", label: "Opening balance", type: "currency", defaultValue: 0 },
      ],
      filter: scopeFilter,
      legacyScopeField: "businessId",
      prepareValues: (values) => ({ ...values, businessId: values.businessId === "__unassigned__" ? undefined : values.businessId }),
      columns: [
        { key: "name", header: "Account", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "kind", header: "Type", value: (r) => r.kind, render: (r) => r.kind },
        { key: "openingBalance", header: "Opening", align: "right", value: (r) => r.openingBalance, render: (r) => formatMoney(r.openingBalance) },
      ],
    }),
    defineTab<BusinessContact>({
      id: "contacts",
      label: "Contacts",
      icon: "users",
      collection: "contacts",
      addLabel: "Add contact",
      emptyTitle: "No contacts",
      emptyDescription: "Customers and suppliers are shared with invoicing, sales and inventory.",
      defaults: { businessId: selectedBusinessId ?? "", kind: "customer" },
      fields: [
        businessIdField,
        { key: "name", label: "Name", type: "text", required: true },
        { key: "kind", label: "Kind", type: "select", options: [{ value: "customer", label: "Customer" }, { value: "supplier", label: "Supplier" }, { value: "both", label: "Both" }], defaultValue: "customer" },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone", type: "text" },
        { key: "notes", label: "Notes", type: "textarea", span: 2 },
      ],
      filter: scopeFilter,
      legacyScopeField: "businessId",
      prepareValues: (values) => ({ ...values, businessId: values.businessId === "__unassigned__" ? undefined : values.businessId }),
      columns: [
        { key: "name", header: "Name", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "kind", header: "Kind", value: (r) => r.kind, render: (r) => r.kind },
        { key: "email", header: "Email", value: (r) => r.email ?? "", render: (r) => r.email ?? "—" },
        { key: "phone", header: "Phone", value: (r) => r.phone ?? "", render: (r) => r.phone ?? "—" },
      ],
    }),
  ];
}

function BookkeepingSourceLabel({ row }: { row: BusinessTransaction }) {
  const { t } = useI18n();
  if (!row.sourceType || row.sourceType === "manual") return <>{t("Manual")}</>;
  const label = row.sourceType === "sale" ? t("Sale") : row.sourceType === "invoice_payment" ? t("Invoice payment") : row.sourceType === "property_income" ? t("Rental income") : t("Inventory purchase");
  return <>{label}{row.sourceId ? ` · ${row.sourceId.slice(-6)}` : ""}</>;
}

export function inventoryTabs(data: DataMap, businesses: Business[] = [], selectedBusinessId: string | null = null): LedgerTab[] {
  const products = rows<BusinessProduct>(data, "products");
  const suppliers = rows<BusinessContact>(data, "contacts").filter((c) => c.kind !== "customer");
  return [
    defineTab<BusinessProduct>({
      id: "products",
      label: "Products",
      icon: "package",
      collection: "products",
      addLabel: "Add product",
      emptyTitle: "No products",
      emptyDescription: "Add products with a cost, price and reorder threshold to start tracking stock.",
      fields: [
        { key: "name", label: "Product", type: "text", required: true },
        { key: "sku", label: "SKU", type: "text", required: true },
        { key: "unit", label: "Unit", type: "text", defaultValue: "unit" },
        { key: "unitCost", label: "Unit cost", type: "currency", required: true, min: 0 },
        { key: "salePrice", label: "Sale price", type: "currency", required: true, min: 0 },
        { key: "reorderThreshold", label: "Reorder threshold", type: "number", min: 0, defaultValue: 0 },
        { key: "supplierId", label: "Supplier", type: "select", options: options(suppliers) },
        { key: "quantity", label: "Opening stock", type: "number", min: 0, defaultValue: 0 },
      ],
      columns: [
        { key: "name", header: "Product", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "sku", header: "SKU", value: (r) => r.sku, render: (r) => <span className="text-fg-muted">{r.sku}</span> },
        { key: "unitCost", header: "Cost", align: "right", value: (r) => r.unitCost, render: (r) => formatMoney(r.unitCost) },
        { key: "salePrice", header: "Price", align: "right", value: (r) => r.salePrice, render: (r) => formatMoney(r.salePrice) },
        { key: "reorderThreshold", header: "Reorder at", align: "right", value: (r) => r.reorderThreshold, render: (r) => r.reorderThreshold },
      ],
    }),
    defineTab<InventoryMovement>({
      id: "movements",
      label: "Stock movements",
      icon: "boxes",
      collection: "movements",
      addLabel: "Record movement",
      emptyTitle: "No stock movements",
      emptyDescription: "Receipts, dispatches and adjustments build quantity on hand and weighted-average cost.",
      fields: [
        { key: "productId", label: "Product", type: "select", options: options(products), required: true },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "type", label: "Movement", type: "select", options: MOVEMENT_TYPES, required: true, defaultValue: "receipt" },
        { key: "quantity", label: "Quantity", type: "number", required: true, min: 0, step: "0.01" },
        { key: "unitCost", label: "Unit cost", type: "currency", help: "Required for receipts — drives the weighted-average cost." },
        { key: "purchasePaid", label: "Paid from business funds", type: "checkbox", placeholder: "Yes", help: "Only paid receipts can be linked as Bookkeeping expenses.", visibleWhen: (values) => values.type === "receipt" },
        { key: "reference", label: "Reference", type: "text" },
        { key: "note", label: "Note", type: "textarea", span: 2 },
      ],
      renderExtra: (items) => <BookkeepingIntegrationPanel sourceType="inventory_purchase" records={items as InventoryMovement[]} businesses={businesses} products={products} selectedBusinessId={selectedBusinessId} />,
      canEdit: (row) => !(row as InventoryMovement).bookkeepingTransactionId,
      canDelete: (row) => !(row as InventoryMovement).bookkeepingTransactionId,
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "productId", header: "Product", value: (r) => products.find((p) => p.id === r.productId)?.name ?? "—", render: (r) => products.find((p) => p.id === r.productId)?.name ?? "—" },
        { key: "type", header: "Movement", value: (r) => r.type, render: (r) => <span className="capitalize text-fg-muted">{r.type.replace(/_/g, " ")}</span> },
        { key: "quantity", header: "Qty", align: "right", value: (r) => r.quantity, render: (r) => r.quantity },
        { key: "unitCost", header: "Unit cost", align: "right", value: (r) => r.unitCost ?? 0, render: (r) => (r.unitCost ? formatMoney(r.unitCost) : "—") },
      ],
    }),
  ];
}

export function salesTabs(data: DataMap, businesses: Business[] = [], selectedBusinessId: string | null = null): LedgerTab[] {
  const products = rows<BusinessProduct>(data, "products");
  const contacts = rows<BusinessContact>(data, "contacts").filter((c) => c.kind !== "supplier");
  return [
    defineTab<Sale>({
      id: "sales",
      label: "Sales",
      icon: "shopping-cart",
      collection: "sales",
      addLabel: "Add sale",
      emptyTitle: "No sales recorded",
      emptyDescription: "Log orders and services. Invoiced and collected revenue are tracked separately.",
      searchText: (r) => `${r.description}`,
      defaults: { date: today(), quantity: 1, discount: 0, returned: 0, taxRate: 0, status: "paid", currency: "USD" },
      fields: [
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "description", label: "Description", type: "text", required: true },
        { key: "productId", label: "Product", type: "select", options: options(products) },
        { key: "customerId", label: "Customer", type: "select", options: options(contacts) },
        { key: "quantity", label: "Quantity", type: "number", required: true, min: 0, defaultValue: 1 },
        { key: "unitPrice", label: "Unit price", type: "currency", required: true, min: 0 },
        { key: "discount", label: "Discount", type: "currency", defaultValue: 0 },
        { key: "returned", label: "Returns", type: "currency", defaultValue: 0 },
        { key: "taxRate", label: "Tax rate %", type: "number", defaultValue: 0, min: 0 },
        { key: "status", label: "Status", type: "select", options: [{ value: "order", label: "Order" }, { value: "invoiced", label: "Invoiced" }, { value: "paid", label: "Paid" }], defaultValue: "paid" },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      renderExtra: (items) => <BookkeepingIntegrationPanel sourceType="sale" records={items as Sale[]} businesses={businesses} invoices={rows<Invoice>(data, "invoices")} products={products} selectedBusinessId={selectedBusinessId} />,
      canEdit: (row) => !(row as Sale).bookkeepingTransactionId,
      canDelete: (row) => !(row as Sale).bookkeepingTransactionId,
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "description", header: "Description", value: (r) => r.description, render: (r) => r.description },
        { key: "quantity", header: "Qty", align: "right", value: (r) => r.quantity, render: (r) => r.quantity },
        {
          key: "net",
          header: "Net",
          align: "right",
          value: (r) => r.quantity * r.unitPrice - r.discount - r.returned,
          render: (r) => formatMoney(r.quantity * r.unitPrice - r.discount - r.returned),
        },
        { key: "status", header: "Status", value: (r) => r.status, render: (r) => <span className="capitalize text-fg-muted">{r.status}</span> },
      ],
    }),
    defineTab<SalesTarget>({
      id: "targets",
      label: "Targets",
      icon: "target",
      collection: "targets",
      addLabel: "Add target",
      emptyTitle: "No sales targets",
      emptyDescription: "Set a target for a month to see progress on the dashboard.",
      fields: [
        { key: "period", label: "Period", type: "text", required: true, placeholder: "2026-10", defaultValue: today().slice(0, 7) },
        { key: "target", label: "Target", type: "currency", required: true, min: 0 },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      columns: [
        { key: "period", header: "Period", primary: true, value: (r) => r.period, render: (r) => r.period },
        { key: "target", header: "Target", align: "right", value: (r) => r.target, render: (r) => formatMoney(r.target) },
      ],
    }),
  ];
}

export function invoicingTabs(data: DataMap, businesses: Business[] = [], selectedBusinessId: string | null = null): LedgerTab[] {
  const contacts = rows<BusinessContact>(data, "contacts");
  const payments = rows<Payment>(data, "payments");
  return [
    defineTab<Invoice>({
      id: "invoices",
      label: "Invoices",
      icon: "file-text",
      collection: "invoices",
      addLabel: "Create invoice",
      emptyTitle: "No invoices yet",
      emptyDescription: "Create a business invoice, then record one or more payments against it.",
      defaults: { number: nextInvoiceNumber(rows<Invoice>(data, "invoices")), customerId: "", issueDate: today(), dueDate: today(), status: "draft", taxRate: 0, discount: 0, currency: "USD", lineDescription: "", lineQuantity: 1, lineUnitPrice: 0 },
      fields: [
        { key: "number", label: "Invoice number", type: "text", required: true },
        { key: "customerId", label: "Customer", type: "select", options: options(contacts.filter((contact) => contact.kind !== "supplier")), required: true },
        { key: "issueDate", label: "Issue date", type: "date", required: true, defaultValue: today() },
        { key: "dueDate", label: "Due date", type: "date", required: true, defaultValue: today() },
        { key: "status", label: "Status", type: "select", options: [{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }, { value: "partial", label: "Partial" }, { value: "paid", label: "Paid" }, { value: "void", label: "Void" }], defaultValue: "draft" },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
        { key: "taxRate", label: "Tax rate %", type: "number", min: 0, defaultValue: 0 },
        { key: "discount", label: "Discount", type: "currency", min: 0, defaultValue: 0 },
        { key: "lineDescription", label: "First line item", type: "text", required: true, span: 2 },
        { key: "lineQuantity", label: "Quantity", type: "number", required: true, min: 0.01, defaultValue: 1 },
        { key: "lineUnitPrice", label: "Unit price", type: "currency", required: true, min: 0 },
        { key: "notes", label: "Notes", type: "textarea", span: 2 },
      ],
      prepareInitial: (record) => {
        const invoice = record as Invoice;
        const firstLine = invoice.lines?.[0];
        return { lineDescription: firstLine?.description ?? "", lineQuantity: firstLine?.quantity ?? 1, lineUnitPrice: firstLine?.unitPrice ?? 0 };
      },
      prepareValues: (values, editing) => {
        const businessId = String(values.businessId ?? "");
        const number = String(values.number ?? "").trim();
        const duplicate = rows<Invoice>(data, "invoices").some((invoice) => !invoice.deleted && invoice.id !== editing?.id && invoice.businessId === businessId && invoice.number.toLowerCase() === number.toLowerCase());
        if (duplicate) throw new Error("Invoice number already exists for this business.");
        const previousLines = (editing as Invoice | undefined)?.lines ?? [];
        const line: InvoiceLine = { id: previousLines[0]?.id ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, description: String(values.lineDescription ?? "").trim(), quantity: Number(values.lineQuantity), unitPrice: Number(values.lineUnitPrice) };
        const lines = previousLines.length ? [line, ...previousLines.slice(1)] : [line];
        const invoice = { ...values };
        delete invoice.lineDescription;
        delete invoice.lineQuantity;
        delete invoice.lineUnitPrice;
        return { ...invoice, number, lines };
      },
      columns: [
        { key: "number", header: "Invoice", primary: true, value: (invoice) => invoice.number, render: (invoice) => <span className="font-medium">{invoice.number}</span> },
        { key: "issueDate", header: "Issued", value: (invoice) => invoice.issueDate, render: (invoice) => formatDate(invoice.issueDate) },
        { key: "customerId", header: "Customer", value: (invoice) => invoice.customerId ?? "", render: (invoice) => contacts.find((contact) => contact.id === invoice.customerId)?.name ?? "—" },
        { key: "balance", header: "Total", align: "right", value: (invoice) => invoiceTotals(invoice, [], today()).total, render: (invoice) => formatMoney(invoiceTotals(invoice, [], today()).total, { currency: invoice.currency || "USD" }) },
        { key: "balanceDue", header: "Balance due", align: "right", value: (invoice) => invoiceTotals(invoice, payments.filter((payment) => payment.invoiceId === invoice.id), today()).balanceDue, render: (invoice) => formatMoney(invoiceTotals(invoice, payments.filter((payment) => payment.invoiceId === invoice.id), today()).balanceDue, { currency: invoice.currency || "USD" }) },
        { key: "status", header: "Status", value: (invoice) => invoiceTotals(invoice, payments.filter((payment) => payment.invoiceId === invoice.id), today()).status, render: (invoice) => <span className="capitalize text-fg-muted">{invoiceTotals(invoice, payments.filter((payment) => payment.invoiceId === invoice.id), today()).status}</span> },
      ],
      canEdit: (invoice) => !payments.some((payment) => payment.invoiceId === invoice.id && payment.bookkeepingTransactionId),
      canDelete: (invoice) => !payments.some((payment) => payment.invoiceId === invoice.id && payment.bookkeepingTransactionId),
    }),
    defineTab<BusinessContact>({
      id: "customers",
      label: "Customers",
      icon: "users",
      collection: "contacts",
      addLabel: "Add customer",
      emptyTitle: "No customers",
      emptyDescription: "Invoices reference shared customer records so you only enter them once.",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "kind", label: "Kind", type: "select", options: [{ value: "customer", label: "Customer" }, { value: "both", label: "Customer & supplier" }], defaultValue: "customer" },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone", type: "text" },
      ],
      columns: [
        { key: "name", header: "Customer", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "email", header: "Email", value: (r) => r.email ?? "", render: (r) => r.email ?? "—" },
        { key: "phone", header: "Phone", value: (r) => r.phone ?? "", render: (r) => r.phone ?? "—" },
      ],
    }),
    defineTab<Payment>({
      id: "payments",
      label: "Payments",
      icon: "receipt",
      collection: "payments",
      addLabel: "Record payment",
      emptyTitle: "No payments yet",
      emptyDescription: "Allocate payments against invoices — partial payments are supported.",
      fields: [
        { key: "invoiceId", label: "Invoice", type: "select", options: options(rows<Invoice>(data, "invoices")), required: true },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0 },
        { key: "method", label: "Method", type: "select", options: [{ value: "bank", label: "Bank transfer" }, { value: "card", label: "Card" }, { value: "cash", label: "Cash" }, { value: "other", label: "Other" }], defaultValue: "bank" },
        { key: "reference", label: "Reference", type: "text" },
      ],
      renderExtra: (items) => <BookkeepingIntegrationPanel sourceType="invoice_payment" records={items as Payment[]} businesses={businesses} invoices={rows<Invoice>(data, "invoices")} products={rows<BusinessProduct>(data, "products")} selectedBusinessId={selectedBusinessId} />,
      canEdit: (row) => !(row as Payment).bookkeepingTransactionId,
      canDelete: (row) => !(row as Payment).bookkeepingTransactionId,
      prepareValues: (values, editing) => {
        const invoice = rows<Invoice>(data, "invoices").find((record) => record.id === values.invoiceId);
        const unchangedExistingReference = editing && (editing as Payment).invoiceId === invoice?.id;
        if (!invoice || invoice.status === "draft" || invoice.status === "void") {
          if (!unchangedExistingReference) throw new Error("Choose an issued invoice for this payment.");
        }
        return values;
      },
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "invoiceId", header: "Invoice", value: (r) => r.invoiceId, render: (r) => <span className="text-fg-muted">{r.invoiceId.slice(-6)}</span> },
        { key: "amount", header: "Amount", align: "right", value: (r) => r.amount, render: (r) => formatMoney(r.amount) },
        { key: "method", header: "Method", value: (r) => r.method, render: (r) => r.method },
      ],
    }),
  ];
}

export function cashFlowTabs(data: DataMap): LedgerTab[] {
  return [
    defineTab<CashForecastItem>({
      id: "items",
      label: "Forecast items",
      icon: "waves",
      collection: "items",
      addLabel: "Add forecast item",
      emptyTitle: "No forecast items",
      emptyDescription: "Add expected inflows and outflows by week to project closing cash.",
      fields: [
        { key: "scenarioId", label: "Forecast scenario", type: "select", options: options(rows<CashScenario>(data, "scenarios")), required: true },
        { key: "label", label: "Label", type: "text", required: true },
        { key: "kind", label: "Direction", type: "select", options: [{ value: "inflow", label: "Inflow" }, { value: "outflow", label: "Outflow" }], required: true, defaultValue: "inflow" },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0 },
        { key: "week", label: "Week number", type: "number", required: true, min: 0, max: 51, defaultValue: 0, help: "0 = this week" },
        { key: "certainty", label: "Certainty", type: "select", options: [{ value: "committed", label: "Committed" }, { value: "likely", label: "Likely" }, { value: "possible", label: "Possible" }], defaultValue: "likely" },
        { key: "category", label: "Category", type: "text" },
      ],
      columns: [
        { key: "label", header: "Item", primary: true, value: (r) => r.label, render: (r) => r.label },
        { key: "kind", header: "Direction", value: (r) => r.kind, render: (r) => r.kind },
        { key: "week", header: "Week", value: (r) => r.week, render: (r) => `W${r.week}` },
        { key: "amount", header: "Amount", align: "right", value: (r) => r.amount, render: (r) => formatMoney(r.amount) },
        { key: "certainty", header: "Certainty", value: (r) => r.certainty, render: (r) => r.certainty },
      ],
    }),
    defineTab<CashScenario>({
      id: "scenarios",
      label: "Scenario",
      icon: "gauge",
      collection: "scenarios",
      addLabel: "Set scenario",
      emptyTitle: "No opening cash set",
      emptyDescription: "Set opening cash and a minimum cash buffer to project runway and shortfall.",
      fields: [
        { key: "name", label: "Name", type: "text", defaultValue: "Base" },
        { key: "openingCash", label: "Opening cash", type: "currency", required: true, min: 0 },
        { key: "minimumCash", label: "Minimum cash buffer", type: "currency", defaultValue: 0 },
        { key: "optimisticFactor", label: "Optimistic factor", type: "number", defaultValue: 1 },
        { key: "conservativeFactor", label: "Conservative factor", type: "number", defaultValue: 0.6 },
      ],
      columns: [
        { key: "name", header: "Scenario", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "openingCash", header: "Opening cash", align: "right", value: (r) => r.openingCash, render: (r) => formatMoney(r.openingCash) },
        { key: "minimumCash", header: "Buffer", align: "right", value: (r) => r.minimumCash, render: (r) => formatMoney(r.minimumCash) },
      ],
    }),
  ];
}
