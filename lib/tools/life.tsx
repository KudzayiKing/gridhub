import { defineTab, type LedgerTab } from "@/components/tools/ledger-tool";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type {
  GroceryItem,
  Business,
  NutritionFood,
  NutritionLog,
  Property,
  PropertyBooking,
  PropertyExpense,
  PropertyMaintenance,
  PropertyUnit,
  WeddingExpense,
  WeddingGuest,
  WeddingPayment,
  WeddingTable,
  WeddingTask,
  WeddingVendor,
  Wedding,
} from "@/lib/types";
import { options, rows, today, type DataMap } from "./shared";
import { BookkeepingIntegrationPanel } from "@/components/tools/bookkeeping-integration-panel";

export function weddingTabs(data: DataMap, selectedWeddingId: string | null = null): LedgerTab[] {
  const weddings = rows<Wedding>(data, "wedding").filter((wedding) => !wedding.deleted);
  const vendors = rows<WeddingVendor>(data, "vendors");
  const tables = rows<WeddingTable>(data, "tables");
  const prepareWeddingValues = (values: Record<string, unknown>, reference?: { collection: "vendors" | "tables"; field: string }) => {
    const weddingId = selectedWeddingId ?? String(values.weddingId ?? "");
    if (!weddings.some((wedding) => wedding.id === weddingId)) throw new Error("Choose a valid wedding for this record.");
    const referenceId = reference ? String(values[reference.field] ?? "") : "";
    if (reference && referenceId) {
      const linked = (reference.collection === "vendors" ? vendors : tables).find((row) => row.id === referenceId);
      if (!linked || linked.weddingId !== weddingId) throw new Error(`Choose a ${reference.collection === "vendors" ? "vendor" : "table"} from the same wedding.`);
    }
    return { ...values, weddingId };
  };
  return [
    defineTab<Wedding>({
      id: "wedding",
      label: "Weddings",
      icon: "heart",
      collection: "wedding",
      addLabel: "New wedding",
      emptyTitle: "No weddings yet",
      emptyDescription: "Create an event to organize guests, vendors, costs, and tasks.",
      fields: [
        { key: "couple", label: "Wedding or couple name", type: "text", required: true },
        { key: "eventDate", label: "Event date", type: "date", required: true, defaultValue: today() },
        { key: "totalBudget", label: "Total budget", type: "currency", required: true, min: 0, defaultValue: 0 },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD", required: true },
        { key: "venue", label: "Venue", type: "text" },
      ],
      columns: [
        { key: "couple", header: "Wedding", primary: true, value: (r) => r.couple, render: (r) => r.couple },
        { key: "eventDate", header: "Event date", value: (r) => r.eventDate, render: (r) => formatDate(r.eventDate) },
        { key: "venue", header: "Venue", value: (r) => r.venue ?? "", render: (r) => r.venue ?? "—" },
        { key: "totalBudget", header: "Total budget", align: "right", value: (r) => r.totalBudget, render: (r) => formatMoney(r.totalBudget, { currency: r.currency || "USD" }) },
      ],
    }),
    defineTab<WeddingGuest>({
      id: "guests",
      label: "Guests",
      icon: "users",
      collection: "guests",
      addLabel: "Add guest",
      emptyTitle: "No guests yet",
      emptyDescription: "Add guests with their household seat count to track RSVPs and seating.",
      defaults: { rsvp: "invited", seats: 1 },
      fields: [
        { key: "weddingId", label: "Wedding", type: "select", options: options(weddings), required: true, defaultValue: selectedWeddingId ?? undefined, visibleWhen: () => !selectedWeddingId },
        { key: "name", label: "Guest", type: "text", required: true },
        { key: "household", label: "Household", type: "text", placeholder: "The Adeyemis" },
        { key: "seats", label: "Seats", type: "number", required: true, min: 1, defaultValue: 1 },
        { key: "rsvp", label: "RSVP", type: "select", options: [{ value: "invited", label: "Invited" }, { value: "accepted", label: "Accepted" }, { value: "declined", label: "Declined" }, { value: "tentative", label: "Tentative" }], defaultValue: "invited" },
        { key: "tableId", label: "Table", type: "select", options: options(tables) },
        { key: "email", label: "Email", type: "email" },
        { key: "dietary", label: "Dietary notes", type: "text" },
      ],
      prepareValues: (values) => prepareWeddingValues(values, { collection: "tables", field: "tableId" }),
      columns: [
        { key: "name", header: "Guest", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "weddingId", header: "Wedding", value: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "", render: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "—" },
        { key: "household", header: "Household", value: (r) => r.household ?? "", render: (r) => r.household ?? "—" },
        { key: "seats", header: "Seats", align: "right", value: (r) => r.seats, render: (r) => r.seats },
        { key: "rsvp", header: "RSVP", value: (r) => r.rsvp, render: (r) => <span className="capitalize">{r.rsvp}</span> },
        { key: "tableId", header: "Table", value: (r) => tables.find((t) => t.id === r.tableId)?.name ?? "", render: (r) => tables.find((t) => t.id === r.tableId)?.name ?? "—" },
      ],
    }),
    defineTab<WeddingVendor>({
      id: "vendors",
      label: "Vendors",
      icon: "briefcase",
      collection: "vendors",
      addLabel: "Add vendor",
      emptyTitle: "No vendors",
      emptyDescription: "Track contracted amounts and payments per vendor.",
      fields: [
        { key: "weddingId", label: "Wedding", type: "select", options: options(weddings), required: true, defaultValue: selectedWeddingId ?? undefined, visibleWhen: () => !selectedWeddingId },
        { key: "name", label: "Vendor", type: "text", required: true },
        { key: "category", label: "Category", type: "text", placeholder: "Venue, Catering…" },
        { key: "contractedAmount", label: "Contracted amount", type: "currency", required: true, min: 0 },
        { key: "phone", label: "Phone", type: "text" },
        { key: "notes", label: "Notes", type: "textarea", span: 2 },
      ],
      prepareValues: (values) => prepareWeddingValues(values),
      columns: [
        { key: "name", header: "Vendor", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "weddingId", header: "Wedding", value: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "", render: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "—" },
        { key: "category", header: "Category", value: (r) => r.category, render: (r) => r.category },
        { key: "contractedAmount", header: "Contracted", align: "right", value: (r) => r.contractedAmount, render: (r) => formatMoney(r.contractedAmount) },
      ],
    }),
    defineTab<WeddingExpense>({
      id: "expenses",
      label: "Budget",
      icon: "wallet",
      collection: "expenses",
      addLabel: "Add budget line",
      emptyTitle: "No budget lines",
      emptyDescription: "Separate committed costs from money actually spent and paid.",
      fields: [
        { key: "weddingId", label: "Wedding", type: "select", options: options(weddings), required: true, defaultValue: selectedWeddingId ?? undefined, visibleWhen: () => !selectedWeddingId },
        { key: "category", label: "Category", type: "text", required: true },
        { key: "label", label: "Line item", type: "text", required: true },
        { key: "committed", label: "Committed", type: "currency", defaultValue: 0 },
        { key: "actual", label: "Actual", type: "currency", defaultValue: 0 },
        { key: "paid", label: "Paid", type: "currency", defaultValue: 0 },
      ],
      prepareValues: (values) => prepareWeddingValues(values),
      columns: [
        { key: "label", header: "Line", primary: true, value: (r) => r.label, render: (r) => r.label },
        { key: "weddingId", header: "Wedding", value: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "", render: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "—" },
        { key: "category", header: "Category", value: (r) => r.category, render: (r) => r.category },
        { key: "committed", header: "Committed", align: "right", value: (r) => r.committed, render: (r) => formatMoney(r.committed) },
        { key: "actual", header: "Actual", align: "right", value: (r) => r.actual, render: (r) => formatMoney(r.actual) },
        { key: "paid", header: "Paid", align: "right", value: (r) => r.paid, render: (r) => formatMoney(r.paid) },
      ],
    }),
    defineTab<WeddingPayment>({
      id: "payments",
      label: "Vendor payments",
      icon: "receipt",
      collection: "payments",
      addLabel: "Record payment",
      emptyTitle: "No vendor payments",
      emptyDescription: "Record payments against vendors to see outstanding balances.",
      fields: [
        { key: "weddingId", label: "Wedding", type: "select", options: options(weddings), required: true, defaultValue: selectedWeddingId ?? undefined, visibleWhen: () => !selectedWeddingId },
        { key: "vendorId", label: "Vendor", type: "select", options: options(vendors), required: true },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0 },
        { key: "note", label: "Note", type: "text" },
      ],
      prepareValues: (values) => prepareWeddingValues(values, { collection: "vendors", field: "vendorId" }),
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "weddingId", header: "Wedding", value: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "", render: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "—" },
        { key: "vendorId", header: "Vendor", value: (r) => vendors.find((v) => v.id === r.vendorId)?.name ?? "—", render: (r) => vendors.find((v) => v.id === r.vendorId)?.name ?? "—" },
        { key: "amount", header: "Amount", align: "right", value: (r) => r.amount, render: (r) => formatMoney(r.amount) },
      ],
    }),
    defineTab<WeddingTable>({
      id: "tables",
      label: "Seating",
      icon: "grid",
      collection: "tables",
      addLabel: "Add table",
      emptyTitle: "No tables",
      emptyDescription: "Create tables with capacities. Gridhub warns before you exceed them.",
      fields: [
        { key: "weddingId", label: "Wedding", type: "select", options: options(weddings), required: true, defaultValue: selectedWeddingId ?? undefined, visibleWhen: () => !selectedWeddingId },
        { key: "name", label: "Table", type: "text", required: true },
        { key: "capacity", label: "Capacity", type: "number", required: true, min: 1, defaultValue: 8 },
      ],
      prepareValues: (values) => prepareWeddingValues(values),
      columns: [
        { key: "name", header: "Table", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "weddingId", header: "Wedding", value: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "", render: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "—" },
        { key: "capacity", header: "Capacity", align: "right", value: (r) => r.capacity, render: (r) => r.capacity },
      ],
    }),
    defineTab<WeddingTask>({
      id: "tasks",
      label: "Checklist",
      icon: "circle-check",
      collection: "tasks",
      addLabel: "Add task",
      emptyTitle: "No checklist items",
      emptyDescription: "Add planning tasks with due dates so nothing is missed.",
      fields: [
        { key: "weddingId", label: "Wedding", type: "select", options: options(weddings), required: true, defaultValue: selectedWeddingId ?? undefined, visibleWhen: () => !selectedWeddingId },
        { key: "title", label: "Task", type: "text", required: true },
        { key: "dueDate", label: "Due date", type: "date" },
        { key: "owner", label: "Owner", type: "text" },
        { key: "done", label: "Done", type: "checkbox" },
      ],
      prepareValues: (values) => prepareWeddingValues(values),
      columns: [
        { key: "title", header: "Task", primary: true, value: (r) => r.title, render: (r) => <span className={r.done ? "text-fg-subtle line-through" : ""}>{r.title}</span> },
        { key: "weddingId", header: "Wedding", value: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "", render: (r) => weddings.find((wedding) => wedding.id === r.weddingId)?.couple ?? "—" },
        { key: "dueDate", header: "Due", value: (r) => r.dueDate ?? "", render: (r) => formatDate(r.dueDate) },
        { key: "owner", header: "Owner", value: (r) => r.owner ?? "", render: (r) => r.owner ?? "—" },
        { key: "done", header: "Done", value: (r) => (r.done ? 1 : 0), render: (r) => (r.done ? "Yes" : "No") },
      ],
    }),
  ];
}

export function propertyTabs(data: DataMap, businesses: Business[] = []): LedgerTab[] {
  const properties = rows<Property>(data, "properties");
  const units = rows<PropertyUnit>(data, "units");
  return [
    defineTab<Property>({
      id: "properties",
      label: "Properties",
      icon: "home",
      collection: "properties",
      addLabel: "Add property",
      deleteConfirmation: { title: "Archive this property?", description: "The property and its bookings, expenses, and maintenance history will be preserved. You can restore it from the property selector.", confirmLabel: "Archive" },
      prepareValues: (values) => ({
        ...values,
        businessId: values.context === "business" && businesses.some((business) => business.id === values.businessId)
          ? values.businessId
          : undefined,
      }),
      emptyTitle: "No properties",
      emptyDescription: "Add a property, then its units, bookings and expenses.",
      fields: [
        { key: "name", label: "Property", type: "text", required: true },
        { key: "address", label: "Address", type: "text" },
        { key: "context", label: "Context", type: "select", options: [{ value: "personal", label: "Personal" }, { value: "business", label: "Business" }], defaultValue: "personal" },
        ...(businesses.length ? [{ key: "businessId", label: "Business (optional)", type: "select" as const, options: options(businesses) }] : []),
        { key: "purchasePrice", label: "Purchase price", type: "currency" },
        { key: "currency", label: "Currency", type: "text", defaultValue: "USD" },
      ],
      columns: [
        { key: "name", header: "Property", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "address", header: "Address", value: (r) => r.address ?? "", render: (r) => r.address ?? "—" },
        { key: "context", header: "Context", value: (r) => r.context, render: (r) => <span className="capitalize">{r.context}</span> },
        { key: "businessId", header: "Business", value: (r) => businesses.find((business) => business.id === r.businessId)?.name ?? "—", render: (r) => businesses.find((business) => business.id === r.businessId)?.name ?? "—" },
      ],
    }),
    defineTab<PropertyUnit>({
      id: "units",
      label: "Units",
      icon: "layers",
      collection: "units",
      addLabel: "Add unit",
      emptyTitle: "No units",
      emptyDescription: "Units let you track occupancy and rates separately within one property.",
      fields: [
        { key: "propertyId", label: "Property", type: "select", options: options(properties), required: true },
        { key: "name", label: "Unit", type: "text", required: true, placeholder: "Main flat" },
        { key: "nightlyRate", label: "Nightly rate", type: "currency", defaultValue: 0 },
        { key: "cleaningFee", label: "Cleaning fee", type: "currency", defaultValue: 0 },
      ],
      columns: [
        { key: "name", header: "Unit", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "propertyId", header: "Property", value: (r) => properties.find((p) => p.id === r.propertyId)?.name ?? "—", render: (r) => properties.find((p) => p.id === r.propertyId)?.name ?? "—" },
        { key: "nightlyRate", header: "Rate", align: "right", value: (r) => r.nightlyRate, render: (r) => formatMoney(r.nightlyRate) },
      ],
    }),
    defineTab<PropertyBooking>({
      id: "bookings",
      label: "Bookings",
      icon: "calendar-range",
      collection: "bookings",
      addLabel: "Add booking",
      emptyTitle: "No bookings",
      emptyDescription: "Add stays manually. Overlapping dates in the same unit are flagged.",
      defaults: { status: "booked", channel: "direct", paid: false },
      renderExtra: (items) => <BookkeepingIntegrationPanel sourceType="property_income" records={items as PropertyBooking[]} businesses={businesses} properties={properties} selectedBusinessId={null} />,
      canEdit: (row) => !(row as PropertyBooking).bookkeepingTransactionId,
      canDelete: (row) => !(row as PropertyBooking).bookkeepingTransactionId,
      fields: [
        { key: "propertyId", label: "Property", type: "select", options: options(properties), required: true },
        { key: "unitId", label: "Unit", type: "select", options: options(units), required: true },
        { key: "guest", label: "Guest", type: "text", required: true },
        { key: "checkIn", label: "Check in", type: "date", required: true, defaultValue: today() },
        { key: "checkOut", label: "Check out", type: "date", required: true },
        { key: "accommodation", label: "Accommodation", type: "currency", required: true, min: 0 },
        { key: "platformFee", label: "Platform fee", type: "currency", defaultValue: 0 },
        { key: "cleaningFee", label: "Cleaning fee", type: "currency", defaultValue: 0 },
        { key: "channel", label: "Channel", type: "select", options: [{ value: "direct", label: "Direct" }, { value: "airbnb", label: "Airbnb" }, { value: "booking", label: "Booking.com" }, { value: "other", label: "Other" }], defaultValue: "direct" },
        { key: "status", label: "Status", type: "select", options: [{ value: "booked", label: "Booked" }, { value: "stayed", label: "Stayed" }, { value: "cancelled", label: "Canceled" }], defaultValue: "booked" },
        { key: "paid", label: "Paid", type: "checkbox" },
      ],
      columns: [
        { key: "checkIn", header: "Check in", primary: true, value: (r) => r.checkIn, render: (r) => formatDate(r.checkIn) },
        { key: "guest", header: "Guest", value: (r) => r.guest, render: (r) => r.guest },
        { key: "nights", header: "Nights", align: "right", value: (r) => r.nights, render: (r) => r.nights },
        { key: "accommodation", header: "Accommodation", align: "right", value: (r) => r.accommodation, render: (r) => formatMoney(r.accommodation) },
        { key: "status", header: "Status", value: (r) => r.status, render: (r) => <span className="capitalize">{r.status}</span> },
      ],
    }),
    defineTab<PropertyExpense>({
      id: "expenses",
      label: "Expenses",
      icon: "receipt",
      collection: "expenses",
      addLabel: "Add expense",
      emptyTitle: "No property expenses",
      emptyDescription: "Cleaning, utilities and fees reduce net operating income.",
      fields: [
        { key: "propertyId", label: "Property", type: "select", options: options(properties), required: true },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "category", label: "Category", type: "text", required: true },
        { key: "amount", label: "Amount", type: "currency", required: true, min: 0 },
        { key: "note", label: "Note", type: "text" },
      ],
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "category", header: "Category", value: (r) => r.category, render: (r) => r.category },
        { key: "amount", header: "Amount", align: "right", value: (r) => r.amount, render: (r) => formatMoney(r.amount) },
      ],
    }),
    defineTab<PropertyMaintenance>({
      id: "maintenance",
      label: "Maintenance",
      icon: "wrench",
      collection: "maintenance",
      addLabel: "Add maintenance",
      emptyTitle: "No maintenance items",
      emptyDescription: "Track repairs and their cost against the property.",
      fields: [
        { key: "propertyId", label: "Property", type: "select", options: options(properties), required: true },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "title", label: "Item", type: "text", required: true },
        { key: "cost", label: "Cost", type: "currency", defaultValue: 0 },
        { key: "done", label: "Done", type: "checkbox" },
      ],
      columns: [
        { key: "title", header: "Item", primary: true, value: (r) => r.title, render: (r) => r.title },
        { key: "date", header: "Date", value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "cost", header: "Cost", align: "right", value: (r) => r.cost, render: (r) => formatMoney(r.cost) },
        { key: "done", header: "Done", value: (r) => (r.done ? 1 : 0), render: (r) => (r.done ? "Yes" : "No") },
      ],
    }),
  ];
}

export function nutritionTabs(data: DataMap): LedgerTab[] {
  const foods = rows<NutritionFood>(data, "foods");
  return [
    defineTab<NutritionFood>({
      id: "foods",
      label: "Foods",
      icon: "coffee",
      collection: "foods",
      addLabel: "Add food",
      emptyTitle: "No saved foods",
      emptyDescription:
        "Add foods with per-100g values. Nothing is invented — you control every number.",
      fields: [
        { key: "name", label: "Food", type: "text", required: true },
        { key: "brand", label: "Brand", type: "text" },
        { key: "kcal", label: "Calories /100g", type: "number", required: true, min: 0 },
        { key: "protein", label: "Protein /100g", type: "number", required: true, min: 0, step: "0.1" },
        { key: "carbs", label: "Carbs /100g", type: "number", required: true, min: 0, step: "0.1" },
        { key: "fat", label: "Fat /100g", type: "number", required: true, min: 0, step: "0.1" },
        { key: "fiber", label: "Fibre /100g", type: "number", min: 0, step: "0.1" },
        { key: "servingGrams", label: "Typical serving (g)", type: "number", min: 0, defaultValue: 100 },
      ],
      columns: [
        { key: "name", header: "Food", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "kcal", header: "kcal/100g", align: "right", value: (r) => r.kcal, render: (r) => r.kcal },
        { key: "protein", header: "Protein", align: "right", value: (r) => r.protein, render: (r) => `${r.protein} g` },
        { key: "carbs", header: "Carbs", align: "right", value: (r) => r.carbs, render: (r) => `${r.carbs} g` },
        { key: "fat", header: "Fat", align: "right", value: (r) => r.fat, render: (r) => `${r.fat} g` },
      ],
    }),
    defineTab<NutritionLog>({
      id: "logs",
      label: "Diary",
      icon: "utensils",
      collection: "logs",
      addLabel: "Log food",
      emptyTitle: "Nothing logged",
      emptyDescription: "Log what you ate. Use the diary above to add foods with automatic macros.",
      defaults: { date: today(), meal: "breakfast" },
      fields: [
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
        { key: "meal", label: "Meal", type: "select", options: [{ value: "breakfast", label: "Breakfast" }, { value: "lunch", label: "Lunch" }, { value: "dinner", label: "Dinner" }, { value: "snack", label: "Snack" }], required: true, defaultValue: "breakfast" },
        { key: "name", label: "Food", type: "text", required: true },
        { key: "grams", label: "Grams", type: "number", required: true, min: 0 },
        { key: "kcal", label: "Calories", type: "number", required: true, min: 0 },
        { key: "protein", label: "Protein", type: "number", min: 0, step: "0.1" },
        { key: "carbs", label: "Carbs", type: "number", min: 0, step: "0.1" },
        { key: "fat", label: "Fat", type: "number", min: 0, step: "0.1" },
      ],
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "meal", header: "Meal", value: (r) => r.meal, render: (r) => <span className="capitalize">{r.meal}</span> },
        { key: "name", header: "Food", value: (r) => r.name, render: (r) => r.name },
        { key: "grams", header: "g", align: "right", value: (r) => r.grams, render: (r) => r.grams },
        { key: "kcal", header: "kcal", align: "right", value: (r) => r.kcal, render: (r) => r.kcal },
      ],
    }),
    defineTab<GroceryItem>({
      id: "grocery",
      label: "Grocery list",
      icon: "cart",
      collection: "grocery",
      addLabel: "Add item",
      emptyTitle: "Grocery list is empty",
      emptyDescription: "Add what you need to buy this week.",
      fields: [
        { key: "name", label: "Item", type: "text", required: true },
        { key: "quantity", label: "Quantity", type: "text", placeholder: "2 kg" },
        { key: "done", label: "Bought", type: "checkbox" },
      ],
      columns: [
        { key: "name", header: "Item", primary: true, value: (r) => r.name, render: (r) => <span className={r.done ? "text-fg-subtle line-through" : ""}>{r.name}</span> },
        { key: "quantity", header: "Quantity", value: (r) => r.quantity, render: (r) => r.quantity },
        { key: "done", header: "Bought", value: (r) => (r.done ? 1 : 0), render: (r) => (r.done ? "Yes" : "No") },
      ],
    }),
  ];
}
