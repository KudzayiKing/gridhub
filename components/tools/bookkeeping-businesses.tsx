"use client";

import * as React from "react";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { Button } from "@/components/ui/button";
import { Card, CompactMetric } from "@/components/ui/card";
import { ChartContainer, TrendChart } from "@/components/charts";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/overlay";
import { RecordForm, type FormField } from "@/components/data/record-form";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { useCollection } from "@/lib/store";
import { bookkeepingSummary } from "@/lib/calc/business";
import { rows, type DataMap } from "@/lib/tools/shared";
import type { Business, BusinessTransaction } from "@/lib/types";
import { bookkeepingTabs } from "@/lib/tools/business";
import { LedgerTool } from "./ledger-tool";

const businessFields: FormField[] = [
  { key: "name", label: "Business name", type: "text", required: true, placeholder: "e.g. Northside Studio" },
  { key: "currency", label: "Currency code", type: "text", required: true, defaultValue: "USD", placeholder: "USD" },
  { key: "fiscalYearStart", label: "Fiscal year starts (month)", type: "number", required: true, min: 1, max: 12, defaultValue: 1, help: "Enter a month number from 1 (January) to 12 (December)." },
];

export function BookkeepingBusinesses({ data, fallbackCurrency }: { data: DataMap; fallbackCurrency: string }) {
  const { t } = useI18n();
  const collection = useCollection<Business>("bookkeeping", "businesses");
  const businesses = collection.rows.filter((business) => !business.deleted);
  const allBusinesses = collection.rows;
  const archivedBusinesses = allBusinesses.filter((business) => business.deleted);
  const [selectedBusinessIdState, setSelectedBusinessId] = React.useState<string | null>(null);
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Business | null>(null);
  const [archiveId, setArchiveId] = React.useState<string | null>(null);

  const selectedBusinessId = businesses.some((business) => business.id === selectedBusinessIdState)
    ? selectedBusinessIdState
    : null;
  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId) ?? null;
  const scopedData = (() => {
    if (!selectedBusinessId) return data;
    const result: DataMap = { ...data };
    for (const collectionName of ["transactions", "accounts", "contacts"]) {
      result[collectionName] = rows(data, collectionName).filter((record) =>
        (record as typeof record & { businessId?: string }).businessId === selectedBusinessId,
      );
    }
    return result;
  })();
  const transactions = rows<BusinessTransaction>(scopedData, "transactions").filter((record) => !record.deleted);
  const tabs = bookkeepingTabs(data, businesses, selectedBusinessId);
  const exportPayload = (() => {
    const scopedRecords = (name: string) => rows(data, name).filter((record) =>
      !selectedBusinessId || (record as typeof record & { businessId?: string }).businessId === selectedBusinessId,
    );
    return {
      tool: "bookkeeping",
      exportedAt: new Date().toISOString(),
      scope: selectedBusinessId ? { businessId: selectedBusinessId, businessName: selectedBusiness?.name } : { allBusinesses: true },
      businesses: selectedBusiness ? [selectedBusiness] : allBusinesses,
      transactions: scopedRecords("transactions"),
      accounts: scopedRecords("accounts"),
      contacts: scopedRecords("contacts"),
    };
  })();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (business: Business) => {
    setManagerOpen(false);
    setEditing(business);
    setFormOpen(true);
  };
  const saveBusiness = async (values: Record<string, unknown>) => {
    const name = String(values.name ?? "").trim();
    const currency = String(values.currency ?? "").trim().toUpperCase();
    if (!name) throw new Error("Enter a business name.");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Enter a 3-letter currency code.");
    const payload = {
      name,
      currency,
      fiscalYearStart: Number(values.fiscalYearStart),
    };
    if (editing) await collection.update(editing.id, payload);
    else await collection.add(payload as Omit<Business, "id" | "createdAt" | "updatedAt">);
  };
  const archiveBusiness = async () => {
    if (!archiveId) return;
    await collection.remove(archiveId);
    if (selectedBusinessId === archiveId) setSelectedBusinessId(null);
    setArchiveId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AnimatedTabs
          value={selectedBusinessId ?? "__all_businesses__"}
          onChange={(value) => setSelectedBusinessId(value === "__all_businesses__" ? null : value)}
          ariaLabel={t("Business scope")}
          className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto pb-1"
          buttonClassName="px-3 py-2 text-[13px]"
          options={[
            { value: "__all_businesses__", label: t("All Businesses") },
            ...businesses.map((business) => ({ value: business.id, label: business.name })),
          ]}
        />
        <div className="flex shrink-0 gap-2">
          {allBusinesses.length ? <Button variant="secondary" size="sm" icon="settings" onClick={() => setManagerOpen(true)}>{t("Manage businesses")}</Button> : null}
          <Button variant="primary" size="sm" icon="plus" onClick={openCreate}>{t("Add Business")}</Button>
        </div>
      </div>

      {!allBusinesses.length ? (
        <>
          <Card className="p-4">
            <p className="text-sm font-medium text-fg">{t("Create a business to start organizing your books.")}</p>
            <p className="mt-1 text-[13px] text-fg-muted">{t("Existing transactions remain available under All Businesses until you assign them.")}</p>
          </Card>
          <PortfolioSummary businesses={allBusinesses} data={data} fallbackCurrency={fallbackCurrency} />
        </>
      ) : selectedBusiness ? (
        <>
          <BusinessSummary business={selectedBusiness} transactions={transactions} />
          <BusinessTrend transactions={transactions} currency={selectedBusiness.currency} />
        </>
      ) : (
        <PortfolioSummary businesses={allBusinesses} data={data} fallbackCurrency={fallbackCurrency} />
      )}

      <LedgerTool
        toolId="bookkeeping"
        tabs={tabs}
        description={t("Record money in and out. Owner contributions and loan proceeds are cash movements, not revenue.")}
        exportPayload={exportPayload}
      />

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent title="Manage businesses" description="Rename or archive a business. Archiving keeps its records in your history." className="max-w-xl">
          <div className="grid gap-2">
            {businesses.map((business) => (
              <div key={business.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{business.name}</p>
                  <p className="text-xs text-fg-muted">{business.currency} · {t("Fiscal year starts")}: {business.fiscalYearStart}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(business)}>{t("Edit")}</Button>
                  <Button variant="outline" size="sm" onClick={() => setArchiveId(business.id)}>{t("Archive")}</Button>
                </div>
              </div>
            ))}
            {archivedBusinesses.map((business) => (
              <div key={business.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3 opacity-75">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{business.name} · {t("Archived")}</p>
                  <p className="text-xs text-fg-muted">{business.currency} · {t("Fiscal year starts")}: {business.fiscalYearStart}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void collection.update(business.id, { deleted: false })}>{t("Restore")}</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <RecordForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}
        title={editing ? "Edit business" : "Add Business"}
        description="Each business keeps its own Bookkeeping records and currency."
        fields={businessFields}
        initial={editing ? editing as unknown as Record<string, unknown> : { currency: fallbackCurrency, fiscalYearStart: 1 }}
        onSubmit={saveBusiness}
      />

      <ConfirmDialog
        open={Boolean(archiveId)}
        onOpenChange={(open) => { if (!open) setArchiveId(null); }}
        title="Archive this business?"
        description="Its transactions and related records will be kept, but it will no longer appear in the active business list."
        confirmLabel="Archive"
        destructive={false}
        onConfirm={() => { void archiveBusiness(); }}
      />
    </div>
  );
}

function BusinessSummary({ business, transactions }: { business: Business; transactions: BusinessTransaction[] }) {
  const { t } = useI18n();
  const compatible = transactions.filter((transaction) => !transaction.currency || transaction.currency === business.currency);
  const incompatible = transactions.length - compatible.length;
  const summary = bookkeepingSummary(compatible);
  const transactionCount = transactions.length;
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-fg-muted">{business.name} · {business.currency}</p>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <CompactMetric label={t("Total revenue")} value={formatMoney(summary.cashRevenue, { currency: business.currency })} tone="positive" />
        <CompactMetric label={t("Total expenses")} value={formatMoney(summary.operatingExpenses, { currency: business.currency })} tone="negative" />
        <CompactMetric label={t("Net profit / loss")} value={formatMoney(summary.operatingSurplus, { currency: business.currency, signed: true })} tone={summary.operatingSurplus >= 0 ? "positive" : "negative"} />
        <CompactMetric label={t("Transactions")} value={String(transactionCount)} hint={t("This business only")} />
      </div>
      {incompatible ? <p className="mt-2 text-xs text-[var(--warning)]">{t("{count} transactions in another currency are excluded from these totals.", { count: incompatible })}</p> : null}
    </div>
  );
}

function PortfolioSummary({ businesses, data, fallbackCurrency }: { businesses: Business[]; data: DataMap; fallbackCurrency: string }) {
  const { t } = useI18n();
  const allTransactions = rows<BusinessTransaction>(data, "transactions").filter((row) => !row.deleted);
  const unassigned = allTransactions.filter((row) => !row.businessId);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {businesses.map((business) => {
        const transactions = allTransactions.filter((row) => row.businessId === business.id);
        const currencyGroups = transactions.reduce<Record<string, BusinessTransaction[]>>((groups, row) => {
          const code = row.currency ?? business.currency;
          (groups[code] ??= []).push(row);
          return groups;
        }, {});
        const currencies = Object.keys(currencyGroups);
        return (
          <Card key={business.id} className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="truncate text-sm font-semibold">{business.name}{business.deleted ? ` · ${t("Archived")}` : ""}</h2>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-muted">{business.currency}</span>
            </div>
            {currencies.length ? currencies.map((currency) => {
              const summary = bookkeepingSummary(currencyGroups[currency]);
              return <div key={currency} className="mb-3 last:mb-0">
                {currencies.length > 1 ? <p className="mb-2 text-[11px] text-fg-muted">{currency}</p> : null}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <PortfolioValue label="Revenue" amount={summary.cashRevenue} currency={currency} />
                  <PortfolioValue label="Expenses" amount={summary.operatingExpenses} currency={currency} />
                  <PortfolioValue label="Profit / loss" amount={summary.operatingSurplus} currency={currency} />
                  <PortfolioValue label="Transactions" amount={currencyGroups[currency].length} currency={null} />
                </div>
              </div>;
            }) : <p className="text-xs text-fg-muted">{t("No transactions for this business yet.")}</p>}
          </Card>
        );
      })}
      {unassigned.length ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">{t("Unassigned legacy records")}</h2>
          <p className="mt-1 text-[12px] text-fg-muted">{t("These records are preserved and are not included in any business total.")}</p>
          <p className="mt-3 text-sm">{t("Transactions")}: {unassigned.length}</p>
          {Object.entries(unassigned.reduce<Record<string, BusinessTransaction[]>>((groups, row) => {
            const key = row.currency ?? fallbackCurrency;
            (groups[key] ??= []).push(row);
            return groups;
          }, {})).map(([currency, records]) => (
            <p key={currency} className="mt-1 text-xs text-fg-muted">{currency}: {formatMoney(bookkeepingSummary(records as BusinessTransaction[]).cashRevenue, { currency })} {t("revenue")} · {formatMoney(bookkeepingSummary(records as BusinessTransaction[]).operatingExpenses, { currency })} {t("expenses")}</p>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function BusinessTrend({ transactions, currency }: { transactions: BusinessTransaction[]; currency: string }) {
  const { t } = useI18n();
  const grouped = new Map<string, { revenue: number; expenses: number }>();
  for (const transaction of transactions) {
    if (!transaction.date || (transaction.currency && transaction.currency !== currency)) continue;
    const month = transaction.date.slice(0, 7);
    const entry = grouped.get(month) ?? { revenue: 0, expenses: 0 };
    if (transaction.type === "revenue") entry.revenue += transaction.amount;
    if (transaction.type === "expense") entry.expenses += transaction.amount;
    grouped.set(month, entry);
  }
  const chartData = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, totals]) => ({
    label: new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
    ...totals,
  }));
  if (!chartData.length) return null;
  return (
    <ChartContainer title={t("Business income and expenses")} subtitle={t("Recorded revenue and operating expenses by month")} icon="chart-column">
      <TrendChart data={chartData} xKey="label" series={[{ key: "revenue", name: t("Revenue") }, { key: "expenses", name: t("Expenses") }]} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} type="line" height={220} />
    </ChartContainer>
  );
}

function PortfolioValue({ label, amount, currency }: { label: string; amount: number; currency: string | null }) {
  const { t } = useI18n();
  return <div><p className="text-[10px] uppercase tracking-wide text-fg-subtle">{t(label)}</p><p className="mt-0.5 text-sm font-semibold">{currency ? formatMoney(amount, { currency }) : amount}</p></div>;
}
