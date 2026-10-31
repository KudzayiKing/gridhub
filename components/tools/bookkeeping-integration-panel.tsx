"use client";

import * as React from "react";
import { toast } from "sonner";
import { useCollection } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { formatMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n";
import { syncBookkeepingMirror, unlinkBookkeepingMirror, type BookkeepingSourceType } from "@/lib/integrations/bookkeeping";
import type { Business, BusinessProduct, BusinessTransaction, Invoice, InventoryMovement, Payment, Property, PropertyBooking, Sale } from "@/lib/types";

type MirrorRecord = Sale | Payment | InventoryMovement | PropertyBooking;

export function BookkeepingIntegrationPanel({
  sourceType,
  records,
  businesses,
  invoices = [],
  products = [],
  properties = [],
  selectedBusinessId = null,
}: {
  sourceType: BookkeepingSourceType;
  records: MirrorRecord[];
  businesses: Business[];
  invoices?: Invoice[];
  products?: BusinessProduct[];
  properties?: Property[];
  selectedBusinessId?: string | null;
}) {
  const { t } = useI18n();
  const transactions = useCollection<BusinessTransaction>("bookkeeping", "transactions");
  const activeBusinesses = businesses.filter((business) => !business.deleted);
  const linked = new Map(transactions.rows.filter((row) => row.sourceType && row.sourceId).map((row) => [`${row.sourceType}:${row.sourceId}`, row]));
  const linkedBusinessId = (record: MirrorRecord) => sourceType === "property_income"
    ? properties.find((property) => property.id === (record as PropertyBooking).propertyId)?.businessId
    : (record as Sale | Payment | InventoryMovement).businessId;
  const eligibleCandidates = records.filter((record) => !record.deleted && Boolean(linkedBusinessId(record)) && (!selectedBusinessId || linkedBusinessId(record) === selectedBusinessId) && (
    sourceType === "sale"
      ? (record as Sale).status === "paid" && (record as Sale).quantity * (record as Sale).unitPrice - (record as Sale).discount - (record as Sale).returned > 0
      : sourceType === "invoice_payment"
        ? (record as Payment).amount > 0 && invoices.some((invoice) => invoice.id === (record as Payment).invoiceId && !invoice.deleted && invoice.status !== "draft" && invoice.status !== "void" && invoice.businessId === linkedBusinessId(record))
        : sourceType === "property_income"
          ? (record as PropertyBooking).status === "stayed" && (record as PropertyBooking).paid && (record as PropertyBooking).accommodation + (record as PropertyBooking).cleaningFee - (record as PropertyBooking).platformFee > 0 && properties.some((property) => property.id === (record as PropertyBooking).propertyId && !property.deleted && property.context === "business" && property.businessId && activeBusinesses.some((business) => business.id === property.businessId && business.currency === property.currency))
          : (record as InventoryMovement).type === "receipt" && (record as InventoryMovement).purchasePaid === true && Boolean((record as InventoryMovement).unitCost) && (record as InventoryMovement).quantity > 0 && products.some((product) => product.id === (record as InventoryMovement).productId && !product.deleted && product.businessId === linkedBusinessId(record))
  )).sort((a, b) => (sourceType === "property_income" ? (b as PropertyBooking).checkOut : (b as Sale | Payment | InventoryMovement).date).localeCompare(sourceType === "property_income" ? (a as PropertyBooking).checkOut : (a as Sale | Payment | InventoryMovement).date));
  const eligible = [
    ...eligibleCandidates.filter((record) => linked.has(`${sourceType}:${record.id}`)),
    ...eligibleCandidates.filter((record) => !linked.has(`${sourceType}:${record.id}`)).slice(0, 8),
  ];

  const detail = (record: MirrorRecord) => {
    if (sourceType === "sale") {
      const sale = record as Sale;
      return { label: sale.description, amount: Math.max(0, sale.quantity * sale.unitPrice - sale.discount - sale.returned), date: sale.date, currency: sale.currency || "USD", blocked: Boolean(sale.invoiceId) };
    }
    if (sourceType === "invoice_payment") {
      const payment = record as Payment;
      const invoice = invoices.find((item) => item.id === payment.invoiceId);
      return { label: invoice ? t("Invoice {number}", { number: invoice.number }) : t("Invoice payment"), amount: payment.amount, date: payment.date, currency: invoice?.currency || activeBusinesses.find((item) => item.id === payment.businessId)?.currency || "USD", blocked: false };
    }
    if (sourceType === "property_income") {
      const booking = record as PropertyBooking;
      return { label: `${t("Rental stay")} · ${booking.guest}`, amount: Math.max(0, booking.accommodation + booking.cleaningFee - booking.platformFee), date: booking.checkOut, currency: properties.find((property) => property.id === booking.propertyId)?.currency || "USD", blocked: false };
    }
    const movement = record as InventoryMovement;
    const product = products.find((item) => item.id === movement.productId);
    return { label: product?.name ?? t("Inventory receipt"), amount: (movement.unitCost ?? 0) * movement.quantity, date: movement.date, currency: activeBusinesses.find((item) => item.id === movement.businessId)?.currency || "USD", blocked: false };
  };

  const title = sourceType === "sale" ? t("Bookkeeping links · paid sales") : sourceType === "invoice_payment" ? t("Bookkeeping links · invoice payments") : sourceType === "property_income" ? t("Bookkeeping links · rental income") : t("Bookkeeping links · inventory purchases");
  const description = sourceType === "sale"
    ? t("Link paid sales that are not invoiced. Invoice payments are the cash source for invoiced sales.")
    : sourceType === "invoice_payment"
      ? t("Link issued invoice payments as revenue received. Each payment stays the canonical invoice record.")
      : sourceType === "property_income"
        ? t("Link completed rental stays only after payment is confirmed. The property must be explicitly linked to a business.")
        : t("Link a received stock cost as an expense only when it represents money actually paid.");
  if (!eligible.length) return null;

  return <Card className="grid gap-2 border-line/80 bg-[var(--surface)]/60 p-3">
    <div><h3 className="text-xs font-semibold">{title}</h3><p className="mt-0.5 text-[10px] text-fg-muted">{description}</p></div>
    <div className="grid gap-1.5 sm:grid-cols-2">
      {eligible.map((record) => {
        const row = detail(record);
        const transaction = linked.get(`${sourceType}:${record.id}`);
        const businessName = activeBusinesses.find((business) => business.id === linkedBusinessId(record))?.name ?? t("Business unavailable");
        const savingKey = `${sourceType}:${record.id}`;
        return <IntegrationRow key={savingKey} sourceType={sourceType} sourceId={record.id} label={row.label} date={row.date} amount={row.amount} currency={row.currency} businessName={businessName} disabled={row.blocked} linked={Boolean(transaction)} />;
      })}
    </div>
  </Card>;
}

function IntegrationRow({ sourceType, sourceId, label, date, amount, currency, businessName, disabled, linked }: {
  sourceType: BookkeepingSourceType;
  sourceId: string;
  label: string;
  date: string;
  amount: number;
  currency: string;
  businessName: string;
  disabled: boolean;
  linked: boolean;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = React.useState(false);
  const [unlinkOpen, setUnlinkOpen] = React.useState(false);
  const action = async () => {
    if (saving || disabled) return;
    setSaving(true);
    try {
      await syncBookkeepingMirror(sourceType, sourceId);
      toast.success(t("Bookkeeping entry linked."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not link this record to Bookkeeping.";
      toast.error(t(message));
    } finally { setSaving(false); }
  };
  const unlink = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await unlinkBookkeepingMirror(sourceType, sourceId);
      toast.success(t("Bookkeeping link removed."));
      setUnlinkOpen(false);
    } catch (error) {
      toast.error(t(error instanceof Error ? error.message : "Could not remove this Bookkeeping link."));
    } finally { setSaving(false); }
  };
  return <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-line/70 bg-[var(--bg-subtle)]/30 px-2.5 py-2">
    <div className="min-w-0"><p className="truncate text-[11px] font-medium">{label}</p><p className="truncate text-[9.5px] text-fg-subtle">{businessName} · {date} · {formatMoney(amount, { currency })}</p>{disabled ? <p className="text-[9px] text-[var(--warning)]">{t("Link the invoice payment instead to avoid duplicate revenue.")}</p> : null}</div>
    <div className="flex shrink-0 gap-1"><Button size="sm" variant={linked ? "secondary" : "primary"} disabled={saving || disabled} onClick={() => void action()}>{saving ? t("Saving…") : linked ? t("Update link") : t("Link to Bookkeeping")}</Button>{linked ? <Button size="sm" variant="ghost" disabled={saving} onClick={() => setUnlinkOpen(true)}>{t("Unlink")}</Button> : null}</div>
    <Dialog open={unlinkOpen} onOpenChange={(open) => { if (!saving) setUnlinkOpen(open); }}><DialogContent title={t("Remove this Bookkeeping link?")} description={t("The mirrored Bookkeeping entry will be archived. The original source record will remain unchanged.")}><div className="flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setUnlinkOpen(false)}>{t("Cancel")}</Button><Button variant="primary" disabled={saving} onClick={() => void unlink()}>{saving ? t("Saving…") : t("Remove link")}</Button></div></DialogContent></Dialog>
  </div>;
}
