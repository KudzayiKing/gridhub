"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FREE_TOOLS } from "@/lib/free-tool-catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { FREE_TOOL_DRAFT_KEY, getFreeToolDraftSnapshot, notifyFreeToolDraftChanged, subscribeFreeToolDraft } from "@/lib/free-tool-draft";
import { useI18n } from "@/lib/i18n";
import { createRecord } from "@/lib/store";
import type { FreeDebt, InvoiceLine } from "@/lib/free-tools";
import type { Debt, Invoice, MoneyBudget, MoneyCategory, Property, SavingsGoal } from "@/lib/types";

export function FreeToolDraftNotice({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const draftRaw = React.useSyncExternalStore(subscribeFreeToolDraft, getFreeToolDraftSnapshot, () => "");
  let draft: { tool: string; destination: string; expiresAt: number } | null = null;
  try {
    const value = JSON.parse(draftRaw) as { version?: number; tool?: string; destination?: string; expiresAt?: number };
    if (value.version === 1 && value.tool && value.destination && value.expiresAt) {
      draft = { tool: value.tool, destination: value.destination, expiresAt: value.expiresAt };
    }
  } catch { /* Invalid same-tab drafts are ignored. */ }

  const tool = draft ? FREE_TOOLS.find((item) => item.id === draft.tool) : undefined;
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [message, setMessage] = React.useState("");
  let values: Record<string, unknown> = {};
  let importedAlready = false;
  try {
    const value = JSON.parse(draftRaw) as { values?: Record<string, unknown>; imported?: boolean };
    values = value.values ?? {};
    importedAlready = value.imported === true;
  } catch { /* Invalid same-tab drafts are ignored. */ }

  const importDraft = async () => {
    if (!tool) return;
    setSaving(true);
    setMessage("");
    try {
      const currency = typeof values.currency === "string" ? values.currency : "USD";
      if (tool.id === "debt-payoff-calculator") {
        const debts = Array.isArray(values.debts) ? values.debts as FreeDebt[] : [];
        for (const debt of debts) await createRecord<Debt>("debt", "debts", { name: debt.name, openingPrincipal: debt.balance, annualRate: debt.annualRate, minimumPayment: debt.minimumPayment, extraPayment: 0, frequency: "monthly", currency });
        setMessage(debts.length === 1
          ? t("1 debt added to Debt.")
          : t("{count} debts added to Debt.", { count: debts.length }));
      } else if (tool.id === "monthly-budget-calculator") {
        const expenses = Array.isArray(values.expenses) ? values.expenses as { name: string; amount: number }[] : [];
        const income = Array.isArray(values.incomes) ? (values.incomes as number[]).reduce((sum, n) => sum + (Number(n) || 0), 0) : 0;
        const month = new Date().toISOString().slice(0, 7);
        for (const item of expenses) if (item.name.trim() && item.amount > 0) {
          const category = await createRecord<MoneyCategory>("budget", "categories", { name: item.name.trim(), kind: "expense", group: t("Free calculator import"), monthlyBudget: item.amount });
          await createRecord<MoneyBudget>("budget", "budgets", { month, categoryId: category.id, amount: item.amount });
        }
        setMessage(t("Monthly expense allocations were added for {month}. The {currency} {income} planned income estimate remains in the calculator; no income or spending transactions were created.", { month, currency, income: income.toLocaleString() }));
      } else if (tool.id === "rental-property-calculator") {
        await createRecord<Property>("property", "properties", { name: t("Rental property estimate"), context: "personal", purchasePrice: Number(values.price) || 0, currency });
        setMessage(t("Property added. Rent, operating costs, and financing assumptions remain an estimate in the calculator."));
      } else if (tool.id === "savings-goal-calculator") {
        const months = Math.max(0, Number(values.months) || 0);
        const targetDate = months ? new Date(Date.now() + months * 30.4375 * 86400000).toISOString().slice(0, 10) : undefined;
        await createRecord<SavingsGoal>("savings", "goals", { name: t("Savings goal"), targetAmount: Number(values.target) || 0, openingBalance: Number(values.current) || 0, targetDate, currency, kind: "goal" });
        setMessage(t("Savings goal added. No contribution or balance movement was recorded."));
      } else if (tool.id === "invoice-total-calculator") {
        const lines = Array.isArray(values.lines) ? values.lines as InvoiceLine[] : [];
        const discountType = values.discountType === "fixed" ? "fixed" : "percent";
        const discountInput = Number(values.invoiceDiscount) || 0;
        const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * (1 - Math.max(0, Math.min(100, line.discountPct)) / 100), 0);
        const rawDiscount = discountType === "percent" ? subtotal * Math.max(0, Math.min(100, discountInput)) / 100 : Math.max(0, discountInput);
        const discount = Math.min(subtotal, rawDiscount);
        const today = new Date().toISOString().slice(0, 10);
        await createRecord<Invoice>("invoicing", "invoices", { number: `DRAFT-${Date.now().toString().slice(-6)}`, issueDate: today, dueDate: today, status: "draft", taxRate: Number(values.taxRate) || 0, discount, currency, notes: t("Imported from GridHub Free Invoice Calculator. Review before issuing."), lines: lines.map((line) => ({ id: crypto.randomUUID(), description: line.description, quantity: line.quantity, unitPrice: line.unitPrice * (1 - Math.max(0, Math.min(100, line.discountPct)) / 100) })) });
        setMessage(t("Invoice saved as a draft. It was not sent or marked paid; fees and prior payments were not imported."));
      } else {
        setMessage(t("This calculator is for analysis only. Its result is not a matching GridHub record, so nothing was imported."));
      }
      setCompleted(true);
      try {
        const raw = sessionStorage.getItem(FREE_TOOL_DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Record<string, unknown>;
          sessionStorage.setItem(FREE_TOOL_DRAFT_KEY, JSON.stringify({ ...saved, imported: true }));
          notifyFreeToolDraftChanged();
        }
      } catch { /* A storage restriction must not undo a completed app record write. */ }
    } catch {
      setMessage(t("Could not save this draft. Please open the destination tool and add the details there."));
    } finally {
      setSaving(false);
    }
  };
  const dismiss = () => {
    sessionStorage.removeItem(FREE_TOOL_DRAFT_KEY);
    notifyFreeToolDraftChanged();
  };

  return <>
    {tool && draft?.destination === pathname ? <aside className="mx-auto my-3 flex max-w-6xl flex-col gap-3 rounded-2xl border border-line bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between" aria-label={t("Calculator draft saved")}>
      <div><p className="text-sm font-semibold">{t("Your {tool} draft is saved in this tab", { tool: t(tool.title) })}</p><p className="mt-0.5 text-xs text-fg-muted">{importedAlready ? t("This draft has already been imported. You can still return to the calculator until it expires.") : t("It expires in 30 minutes. Nothing is added to your GridHub records until you confirm import.")}</p></div>
      <div className="flex shrink-0 gap-2"><Button size="sm" variant="primary" onClick={() => setReviewOpen(true)}>{t("Review & import")}</Button><Button size="sm" variant="secondary" asChild><Link href={`/free-tools/${tool.id}`}>{t("Review calculator")}</Link></Button><Button size="sm" variant="ghost" onClick={dismiss}>{t("Dismiss")}</Button></div>
    </aside> : null}
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
      <DialogContent title={t("Review {tool}", { tool: tool ? t(tool.title) : t("calculator draft") })} description={t("Check the values before adding anything to your GridHub workspace.")} wide>
        <div className="max-h-[45dvh] space-y-2 overflow-y-auto rounded-xl border border-line p-3 text-xs">
          {Object.entries(values).filter(([key]) => !["guideline"].includes(key)).map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-line/70 pb-2 last:border-0"><span className="capitalize text-fg-muted">{key.replace(/([A-Z])/g, " $1")}</span><span className="max-w-[65%] text-right font-medium">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span></div>)}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-fg-subtle">{t("Import creates editable records only after you confirm. Calculator assumptions and estimates are not recorded as payments or actual transactions.")}</p>
        {message && <p role="status" className="mt-3 rounded-xl bg-[var(--accent-soft)] p-3 text-xs">{message}</p>}
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setReviewOpen(false)}>{t("Close")}</Button><Button variant="primary" size="sm" disabled={saving || completed || importedAlready} onClick={() => void importDraft()}>{saving ? t("Saving…") : completed || importedAlready ? t("Added") : t("Confirm and add")}</Button></div>
      </DialogContent>
    </Dialog>
    {children}
  </>;
}
