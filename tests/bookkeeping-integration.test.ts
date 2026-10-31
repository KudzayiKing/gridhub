import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseRecord, Business, BusinessProduct, Invoice, InventoryMovement, Payment, Property, PropertyBooking, Sale } from "@/lib/types";

const { records, createRecordMock, updateRecordMock, removeRecordMock } = vi.hoisted(() => ({
  records: new Map<string, BaseRecord[]>(),
  createRecordMock: vi.fn(),
  updateRecordMock: vi.fn(),
  removeRecordMock: vi.fn(),
}));

vi.mock("@/lib/store", () => ({
  listRecords: vi.fn(async (toolId: string, collection: string) => records.get(`${toolId}:${collection}`) ?? []),
  createRecord: createRecordMock,
  updateRecord: updateRecordMock,
  removeRecord: removeRecordMock,
}));

import { syncBookkeepingMirror } from "@/lib/integrations/bookkeeping";

const business: Business = { id: "biz-1", name: "Studio", currency: "USD", fiscalYearStart: 1 } as Business;

function setRecords(toolId: string, collection: string, rows: BaseRecord[]) {
  records.set(`${toolId}:${collection}`, rows);
}

describe("Bookkeeping source mirrors", () => {
  beforeEach(() => {
    records.clear();
    createRecordMock.mockReset();
    updateRecordMock.mockReset();
    removeRecordMock.mockReset();
    setRecords("bookkeeping", "businesses", [business]);
    createRecordMock.mockImplementation(async (_toolId: string, _collection: string, data: BaseRecord) => {
      const row = { ...data, createdAt: "now", updatedAt: "now", version: 1 } as BaseRecord;
      return row;
    });
    updateRecordMock.mockImplementation(async (toolId: string, collection: string, id: string, patch: Partial<BaseRecord>) => {
      const rows = records.get(`${toolId}:${collection}`) ?? [];
      const row = rows.find((item) => item.id === id);
      if (!row) return null;
      const updated = { ...row, ...patch, id };
      records.set(`${toolId}:${collection}`, rows.map((item) => item.id === id ? updated : item));
      return updated;
    });
  });

  it("creates one deterministic mirror and updates it on retries", async () => {
    const sale: Sale = { id: "sale-1", businessId: business.id, status: "paid", date: "2026-10-01", description: "Consulting", quantity: 1, unitPrice: 250, discount: 0, returned: 0 } as Sale;
    setRecords("sales", "sales", [sale]);

    const first = await syncBookkeepingMirror("sale", sale.id);
    setRecords("bookkeeping", "transactions", [first]);
    const second = await syncBookkeepingMirror("sale", sale.id);

    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.id).toBe(first.id);
    expect(createRecordMock).toHaveBeenCalledTimes(1);
    expect(updateRecordMock).toHaveBeenCalledWith("bookkeeping", "transactions", first.id, expect.objectContaining({ type: "revenue", amount: 250 }));
  });

  it("rejects an invoiced sale so revenue cannot be counted twice", async () => {
    setRecords("sales", "sales", [{ id: "sale-2", businessId: business.id, status: "paid", invoiceId: "invoice-1", quantity: 1, unitPrice: 100, discount: 0, returned: 0 } as Sale]);
    await expect(syncBookkeepingMirror("sale", "sale-2")).rejects.toThrow("This sale is invoiced");
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it("rejects invoice payments when invoice and business currencies differ", async () => {
    const payment: Payment = { id: "payment-1", businessId: business.id, invoiceId: "invoice-1", amount: 80, date: "2026-10-02" } as Payment;
    const invoice: Invoice = { id: "invoice-1", businessId: business.id, number: "INV-1", currency: "EUR", status: "sent" } as Invoice;
    setRecords("invoicing", "payments", [payment]);
    setRecords("invoicing", "invoices", [invoice]);
    await expect(syncBookkeepingMirror("invoice_payment", payment.id)).rejects.toThrow("currency must match");
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it("requires an explicit paid marker before mirroring a stock receipt", async () => {
    const movement: InventoryMovement = { id: "move-1", businessId: business.id, productId: "product-1", type: "receipt", quantity: 2, unitCost: 30, date: "2026-10-03" } as InventoryMovement;
    setRecords("inventory", "movements", [movement]);
    setRecords("inventory", "products", [{ id: "product-1", businessId: business.id, name: "Beans" } as BusinessProduct]);
    await expect(syncBookkeepingMirror("inventory_purchase", movement.id)).rejects.toThrow("Only received stock paid from business funds");

    setRecords("inventory", "movements", [{ ...movement, purchasePaid: true } as InventoryMovement]);
    const transaction = await syncBookkeepingMirror("inventory_purchase", movement.id);
    expect(transaction).toMatchObject({ type: "expense", amount: 60, businessId: business.id });
  });

  it("links paid completed business-property stays as net rental income", async () => {
    const booking: PropertyBooking = { id: "booking-1", createdAt: "now", updatedAt: "now", propertyId: "property-1", unitId: "unit-1", guest: "Guest", checkIn: "2026-10-01", checkOut: "2026-10-03", nights: 2, accommodation: 300, platformFee: 30, cleaningFee: 20, status: "stayed", paid: true, channel: "airbnb" };
    const property: Property = { id: "property-1", createdAt: "now", updatedAt: "now", name: "Flat", context: "business", businessId: business.id, currency: business.currency };
    setRecords("property", "bookings", [booking]);
    setRecords("property", "properties", [property]);

    const transaction = await syncBookkeepingMirror("property_income", booking.id);
    expect(transaction).toMatchObject({ type: "revenue", amount: 290, date: "2026-10-03", businessId: business.id });
  });
});
