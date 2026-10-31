import type { BaseRecord, Business, BusinessTransaction, Invoice, InventoryMovement, Payment, Property, PropertyBooking, Sale } from "@/lib/types";
import { createRecord, listRecords, removeRecord, updateRecord } from "@/lib/store";
import { getWorkspaceScope } from "@/lib/workspaces/context";

export type BookkeepingSourceType = "sale" | "invoice_payment" | "inventory_purchase" | "property_income";

type SourceRecord = BaseRecord & {
  businessId?: string;
  bookkeepingTransactionId?: string;
};

type MirrorDraft = Pick<BusinessTransaction, "businessId" | "currency" | "date" | "description" | "amount" | "type" | "sourceType" | "sourceId">;

async function deterministicMirrorId(sourceType: BookkeepingSourceType, sourceId: string): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error("Secure offline storage is unavailable. Retry in a secure browser context.");
  const scope = getWorkspaceScope();
  const bytes = new Uint8Array(await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(`gridhub-bookkeeping:${scope.workspaceId}:${scope.ownerUserId ?? "local"}:${sourceType}:${sourceId}`)));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes.slice(0, 16)].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function liveBusiness(businessId?: string): Promise<Business> {
  const businesses = await listRecords<Business>("bookkeeping", "businesses");
  const business = businesses.find((row) => !row.deleted && row.id === businessId);
  if (!business) throw new Error("Choose a business record in this workspace before linking it to Bookkeeping.");
  return business;
}

async function sourceDraft(sourceType: BookkeepingSourceType, sourceId: string): Promise<{ draft: MirrorDraft; toolId: string; collection: string; source: SourceRecord }> {
  if (sourceType === "sale") {
    const sale = (await listRecords<Sale>("sales", "sales")).find((row) => row.id === sourceId && !row.deleted);
    if (!sale || sale.status !== "paid") throw new Error("Only paid sales without an invoice can be linked as Bookkeeping revenue.");
    if (sale.invoiceId) throw new Error("This sale is invoiced. Link its invoice payments to avoid counting the revenue twice.");
    const business = await liveBusiness(sale.businessId);
    const amount = Math.max(0, sale.quantity * sale.unitPrice - sale.discount - sale.returned);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("This sale has no positive net amount to record.");
    return { draft: { businessId: business.id, currency: business.currency, date: sale.date, description: sale.description, amount, type: "revenue", sourceType, sourceId }, toolId: "sales", collection: "sales", source: sale };
  }

  if (sourceType === "invoice_payment") {
    const payment = (await listRecords<Payment>("invoicing", "payments")).find((row) => row.id === sourceId && !row.deleted);
    if (!payment || payment.amount <= 0) throw new Error("Choose an active invoice payment with a positive amount.");
    const [invoice, business] = await Promise.all([
      listRecords<Invoice>("invoicing", "invoices").then((invoices) => invoices.find((row) => row.id === payment.invoiceId && !row.deleted)),
      liveBusiness(payment.businessId),
    ]);
    if (!invoice || invoice.status === "draft" || invoice.status === "void" || invoice.businessId !== business.id) throw new Error("Choose an issued invoice from the same business.");
    if ((invoice.currency || business.currency) !== business.currency) throw new Error("The invoice currency must match the business currency before linking its payment.");
    return { draft: { businessId: business.id, currency: business.currency, date: payment.date, description: invoice.number, amount: payment.amount, type: "revenue", sourceType, sourceId }, toolId: "invoicing", collection: "payments", source: payment };
  }

  if (sourceType === "property_income") {
    const booking = (await listRecords<PropertyBooking>("property", "bookings")).find((row) => row.id === sourceId && !row.deleted);
    if (!booking || !booking.paid || booking.status !== "stayed") throw new Error("Only completed, paid rental stays can be linked as Bookkeeping revenue.");
    const property = (await listRecords<Property>("property", "properties")).find((row) => row.id === booking.propertyId && !row.deleted && row.context === "business" && Boolean(row.businessId));
    if (!property) throw new Error("Choose a business property in this workspace before linking rental income.");
    const business = await liveBusiness(property.businessId);
    if (property.currency !== business.currency) throw new Error("The property currency must match the linked business currency.");
    const amount = Math.round((booking.accommodation + booking.cleaningFee - booking.platformFee) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("This rental stay has no positive net income to record.");
    return { draft: { businessId: business.id, currency: business.currency, date: booking.checkOut, description: booking.guest || property.name, amount, type: "revenue", sourceType, sourceId }, toolId: "property", collection: "bookings", source: booking };
  }

  const movement = (await listRecords<InventoryMovement>("inventory", "movements")).find((row) => row.id === sourceId && !row.deleted);
  if (!movement || movement.type !== "receipt" || movement.purchasePaid !== true || !movement.unitCost || movement.quantity <= 0) throw new Error("Only received stock paid from business funds with a recorded unit cost can be linked as a purchase expense.");
  const [products, business] = await Promise.all([
    listRecords<import("@/lib/types").BusinessProduct>("inventory", "products"),
    liveBusiness(movement.businessId),
  ]);
  const product = products.find((row) => row.id === movement.productId && !row.deleted && row.businessId === business.id);
  if (!product) throw new Error("Choose an inventory receipt and product from the same business.");
  const amount = Math.round(movement.quantity * movement.unitCost * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("This inventory receipt has no positive purchase cost.");
  return { draft: { businessId: business.id, currency: business.currency, date: movement.date, description: product.name, amount, type: "expense", sourceType, sourceId }, toolId: "inventory", collection: "movements", source: movement };
}

/**
 * Create or refresh the single Bookkeeping mirror for a source record. The source remains
 * canonical; the stable UUID and source tuple make offline retries and repeated taps idempotent.
 */
export async function syncBookkeepingMirror(sourceType: BookkeepingSourceType, sourceId: string): Promise<BusinessTransaction> {
  const { draft, toolId, collection, source } = await sourceDraft(sourceType, sourceId);
  const mirrorId = await deterministicMirrorId(sourceType, sourceId);
  const existing = (await listRecords<BusinessTransaction>("bookkeeping", "transactions"))
    .find((row) => row.sourceType === sourceType && row.sourceId === sourceId);
  const transaction = existing
    ? await updateRecord<BusinessTransaction>("bookkeeping", "transactions", existing.id, draft)
    : await createRecord<BusinessTransaction>("bookkeeping", "transactions", { id: mirrorId, ...draft });
  if (!transaction) throw new Error("The Bookkeeping entry could not be saved.");
  if (source.bookkeepingTransactionId !== transaction.id) {
    const linked = await updateRecord<SourceRecord>(toolId, collection, sourceId, { bookkeepingTransactionId: transaction.id });
    if (!linked) throw new Error("The Bookkeeping entry was saved, but its source link needs a retry.");
  }
  return transaction;
}

/** Archive the mirror and clear its source backlink; the canonical source record stays intact. */
export async function unlinkBookkeepingMirror(sourceType: BookkeepingSourceType, sourceId: string): Promise<void> {
  const { toolId, collection } = sourceType === "sale"
    ? { toolId: "sales", collection: "sales" }
    : sourceType === "invoice_payment"
      ? { toolId: "invoicing", collection: "payments" }
      : sourceType === "property_income"
        ? { toolId: "property", collection: "bookings" }
        : { toolId: "inventory", collection: "movements" };
  const source = (await listRecords<SourceRecord>(toolId, collection)).find((row) => row.id === sourceId);
  if (!source) throw new Error("The source record is not available in this workspace.");
  const transaction = (await listRecords<BusinessTransaction>("bookkeeping", "transactions"))
    .find((row) => row.sourceType === sourceType && row.sourceId === sourceId);
  if (transaction) await removeRecord("bookkeeping", "transactions", transaction.id);
  if (source.bookkeepingTransactionId) {
    const unlinked = await updateRecord<SourceRecord>(toolId, collection, sourceId, { bookkeepingTransactionId: undefined });
    if (!unlinked) throw new Error("The bookkeeping entry was archived, but the source link needs a retry.");
  }
}
