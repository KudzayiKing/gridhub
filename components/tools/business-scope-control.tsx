"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { RecordForm, type FormField } from "@/components/data/record-form";
import { useI18n } from "@/lib/i18n";
import { useCollection } from "@/lib/store";
import type { Business, CashScenario } from "@/lib/types";
import { cn } from "@/lib/utils";

const businessFields: FormField[] = [
  { key: "name", label: "Business name", type: "text", required: true },
  { key: "currency", label: "Currency code", type: "text", required: true, defaultValue: "USD", placeholder: "USD" },
  { key: "fiscalYearStart", label: "Fiscal year starts (month)", type: "number", required: true, min: 1, max: 12, defaultValue: 1 },
];

export function BusinessScopeControl({
  selectedBusinessId,
  onBusinessChange,
  selectedScenarioId,
  onScenarioChange,
  scenarios = [],
  showScenario = false,
  className,
}: {
  selectedBusinessId: string | null;
  onBusinessChange: (businessId: string | null) => void;
  selectedScenarioId?: string | null;
  onScenarioChange?: (scenarioId: string | null) => void;
  scenarios?: CashScenario[];
  showScenario?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const collection = useCollection<Business>("bookkeeping", "businesses");
  const businesses = collection.rows.filter((business) => !business.deleted);
  const [formOpen, setFormOpen] = React.useState(false);

  const createBusiness = async (values: Record<string, unknown>) => {
    const name = String(values.name ?? "").trim();
    const currency = String(values.currency ?? "").trim().toUpperCase();
    if (!name) throw new Error("Enter a business name.");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Enter a 3-letter currency code.");
    const business = await collection.add({
      name,
      currency,
      fiscalYearStart: Number(values.fiscalYearStart),
    } as Omit<Business, "id" | "createdAt" | "updatedAt">);
    onBusinessChange(business.id);
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-[var(--surface)]/70 px-3 py-2", className)}>
      <div>
        <p className="text-[12px] font-medium">{t("Business scope")}</p>
        <p className="text-[10.5px] text-fg-subtle">{t("Apply one business selection to the dashboard and records")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={t("Filter by business")} value={selectedBusinessId ?? ""} onChange={(event) => onBusinessChange(event.target.value || null)} className="h-9 w-auto min-w-36 max-w-full">
          <option value="">{t("All Businesses")}</option>
          {businesses.map((business) => <option key={business.id} value={business.id} data-raw="">{business.name}</option>)}
        </Select>
        <Button variant="secondary" size="sm" icon="plus" onClick={() => setFormOpen(true)}>{t("Add Business")}</Button>
        {showScenario ? (
          <Select aria-label={t("Filter by forecast")} value={selectedScenarioId ?? ""} onChange={(event) => onScenarioChange?.(event.target.value || null)} className="h-9 w-auto min-w-36 max-w-full">
            <option value="">{t("All Forecasts")}</option>
            {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id} data-raw="">{scenario.name}</option>)}
          </Select>
        ) : null}
      </div>
      <RecordForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add Business"
        description="Each business keeps its own records and currency."
        fields={businessFields}
        onSubmit={createBusiness}
      />
    </div>
  );
}
