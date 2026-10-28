"use client";

import * as React from "react";
import { Select } from "@/components/ui/field";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefs } from "@/components/providers";
import { ChartContainer, ChartEmptyState, CategoryBreakdownChart, ChartLegend, ProgressChart, TrendChart } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Badge, CompactMetric, InlineAlert } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { useCollection } from "@/lib/store";
import { debtDueOccurrences, debtPaymentHistory, estimatedDebtProgress, localISODate, paymentSplitIsValid, reminderMatches, type DebtPayStrategy, type DebtDueOccurrence } from "@/lib/reporting/debt-tracker";
import { debtTotals, simulateDebt } from "@/lib/calc/money";
import { formatMoney, formatPercent, round2 } from "@/lib/money";
import type { Debt, DebtPayment, Paycheck } from "@/lib/types";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

type Section = "overview" | "calendar" | "strategies" | "insights";
type CalendarMode = "month" | "week" | "agenda";
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => new Date(date + "T00:00:00").toLocaleDateString(undefined, options);
const monthKey = (date: string) => date.slice(0, 7);
const monthStart = (date: string) => monthKey(date) + "-01";
const plusDays = (iso: string, amount: number) => {
  const date = new Date(iso + "T00:00:00");
  date.setDate(date.getDate() + amount);
  return localISODate(date);
};
const monday = (iso: string) => {
  const date = new Date(iso + "T00:00:00");
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localISODate(date);
};
const statusTone = (status: string): "positive" | "warning" | "negative" | "neutral" =>
  status === "paid" ? "positive" : status === "overdue" ? "negative" : status === "due-soon" || status === "partial" ? "warning" : "neutral";

export function DebtDashboard({ currency }: { currency: string }) {
  const { prefs, setPrefs } = usePrefs();
  const { t } = useI18n();
  const debtState = useCollection<Debt>("debt", "debts");
  const paymentState = useCollection<DebtPayment>("debt", "payments");
  const paycheckState = useCollection<Paycheck>("paycheck", "paychecks");
  const debts = debtState.rows.filter((debt) => !debt.deleted && (!debt.currency || debt.currency === currency));
  const debtIds = new Set(debts.map((debt) => debt.id));
  const payments = paymentState.rows.filter((payment) => !payment.deleted && debtIds.has(payment.debtId));
  const paychecks = paycheckState.rows.filter((paycheck) => !paycheck.deleted).sort((a, b) => a.date.localeCompare(b.date));
  const now = localISODate(new Date());
  const [section, setSection] = React.useState<Section>("overview");
  const [calendarMode, setCalendarMode] = React.useState<CalendarMode>("agenda");
  const [calendarDate, setCalendarDate] = React.useState(now);
  const [historyRange, setHistoryRange] = React.useState(12);
  const [extraAmount, setExtraAmount] = React.useState(0);
  const [targetDebt, setTargetDebt] = React.useState("");
  const [paymentTarget, setPaymentTarget] = React.useState<DebtDueOccurrence | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentPrincipal, setPaymentPrincipal] = React.useState("");
  const [paymentInterest, setPaymentInterest] = React.useState("");
  const [paymentFees, setPaymentFees] = React.useState("0");
  const [paymentDate, setPaymentDate] = React.useState(now);
  const [paymentPaycheck, setPaymentPaycheck] = React.useState("");
  const [paymentNote, setPaymentNote] = React.useState("");
  const [paymentError, setPaymentError] = React.useState("");
  const [savingPayment, setSavingPayment] = React.useState(false);
  const [paymentSuccess, setPaymentSuccess] = React.useState("");
  const [reminderError, setReminderError] = React.useState("");
  const [pendingStrategy, setPendingStrategy] = React.useState<DebtPayStrategy | null>(null);
  const [isSavingStrategy, setIsSavingStrategy] = React.useState(false);
  const strategyOriginRef = React.useRef<HTMLButtonElement | null>(null);

  const strategy: DebtPayStrategy = prefs.periods?.["debt-strategy"] === "avalanche" ? "avalanche" : "snowball";
  const totals = debtTotals(debts);
  const extraFromRecords = round2(debts.reduce((sum, debt) => sum + Math.max(0, debt.extraPayment ?? 0), 0));
  const simulationInput = debts.map((debt) => ({ id: debt.id, name: debt.name, balance: Math.max(0, debt.openingPrincipal), annualRate: Math.max(0, debt.annualRate), minimumPayment: Math.max(0, debt.minimumPayment) * (debt.frequency === "biweekly" ? 26 / 12 : 1) }));
  const baseSimulation = simulateDebt(simulationInput, extraFromRecords, strategy);
  const snowball = simulateDebt(simulationInput, extraFromRecords, "snowball");
  const avalanche = simulateDebt(simulationInput, extraFromRecords, "avalanche");
  const simulatorInput = targetDebt
    ? simulationInput.map((debt) => ({ ...debt, minimumPayment: debt.id === targetDebt ? debt.minimumPayment + extraAmount : debt.minimumPayment }))
    : simulationInput;
  const proposedSimulation = simulateDebt(simulatorInput, targetDebt ? extraFromRecords : extraFromRecords + extraAmount, strategy);
  const selectedStrategy = strategy === "snowball" ? snowball : avalanche;
  const dateExtent = calendarMode === "month"
    ? { from: monthStart(calendarDate), to: localISODate(new Date(Number(calendarDate.slice(0, 4)), Number(calendarDate.slice(5, 7)), 0)) }
    : calendarMode === "week"
      ? { from: monday(calendarDate), to: plusDays(monday(calendarDate), 6) }
      : { from: now, to: plusDays(now, 30) };
  const dueEvents = debtDueOccurrences(debts, payments, dateExtent.from, dateExtent.to, now);
  const plannedEvents: DebtDueOccurrence[] = payments
    .filter((payment) => payment.status === "planned" && payment.date >= dateExtent.from && payment.date <= dateExtent.to && !dueEvents.some((event) => event.debtId === payment.debtId && event.date === payment.date))
    .map((payment) => ({ id: payment.id, debtId: payment.debtId, debtName: debts.find((debt) => debt.id === payment.debtId)?.name ?? "Debt", date: payment.date, amount: payment.amount, paidAmount: 0, status: "planned", paycheckId: payment.paycheckId }));
  const calendarEvents = [...dueEvents, ...plannedEvents].sort((a, b) => a.date.localeCompare(b.date) || a.debtName.localeCompare(b.debtName));
  const todayEvents = debtDueOccurrences(debts, payments, now, plusDays(now, 31), now);
  const nextEvents = todayEvents.filter((event) => event.status !== "paid" && event.status !== "skipped").sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = nextEvents[0];
  const monthPayments = payments.filter((payment) => monthKey(payment.date) === monthKey(now) && payment.status !== "planned" && payment.status !== "skipped");
  const plannedThisMonth = round2(debts.reduce((sum, debt) => sum + Math.max(0, debt.minimumPayment) * (debt.frequency === "biweekly" ? 26 / 12 : 1) + Math.max(0, debt.extraPayment ?? 0), 0));
  const recordedPaid = payments.filter((payment) => payment.status !== "planned" && payment.status !== "skipped");
  const paidOffCount = debts.filter((debt) => debt.openingPrincipal <= 0).length;
  const debtSlices = debts.filter((debt) => debt.openingPrincipal > 0).map((debt) => ({ id: debt.id, name: debt.name, value: debt.openingPrincipal }));
  const progress = debts.map((debt) => ({ debt, ...estimatedDebtProgress(debt, payments) }));
  const originalTracked = round2(progress.reduce((sum, row) => sum + row.estimatedOriginal, 0));
  const principalPaid = round2(progress.reduce((sum, row) => sum + row.principalPaid, 0));
  const overallProgress = originalTracked > 0 ? Math.min(100, principalPaid / originalTracked * 100) : 0;
  const months = debtPaymentHistory(payments, historyRange, monthKey(now));
  const payoffSeries = selectedStrategy.rows.length
    ? [{ month: 0, balance: totals.balance }, ...selectedStrategy.monthlyBalances.map((point) => ({ month: point.month, balance: point.total }))]
    : [{ month: 0, balance: totals.balance }];
  const nextMonth = () => {
    if (calendarMode === "week") {
      setCalendarDate(plusDays(calendarDate, 7));
      return;
    }
    const date = new Date(monthStart(calendarDate) + "T00:00:00");
    date.setMonth(date.getMonth() + 1);
    setCalendarDate(localISODate(date));
  };
  const previousMonth = () => {
    if (calendarMode === "week") {
      setCalendarDate(plusDays(calendarDate, -7));
      return;
    }
    const date = new Date(monthStart(calendarDate) + "T00:00:00");
    date.setMonth(date.getMonth() - 1);
    setCalendarDate(localISODate(date));
  };
  const changeStrategy = (next: DebtPayStrategy, event: React.MouseEvent<HTMLButtonElement>) => {
    if (strategy === next) return;
    strategyOriginRef.current = event.currentTarget;
    setPendingStrategy(next);
  };
  const closeStrategyDialog = () => {
    if (isSavingStrategy) return;
    setPendingStrategy(null);
    requestAnimationFrame(() => strategyOriginRef.current?.focus());
  };
  const confirmStrategy = async () => {
    if (!pendingStrategy || isSavingStrategy) return;
    const next = pendingStrategy;
    const nextName = t(next === "snowball" ? "Snowball" : "Avalanche");
    setIsSavingStrategy(true);
    try {
      await setPrefs({ periods: { ...(prefs.periods ?? {}), "debt-strategy": next } });
      setPendingStrategy(null);
      requestAnimationFrame(() => strategyOriginRef.current?.focus());
      toast.success(t("{strategy} is now your active strategy.", { strategy: nextName }));
    } catch {
      toast.error(t("Could not save your strategy. Your previous strategy is still active."));
    } finally {
      setIsSavingStrategy(false);
    }
  };
  const openPayment = (event: DebtDueOccurrence) => {
    setPaymentTarget(event);
    setTargetDebt(event.debtId);
    setPaymentAmount(String(event.amount));
    setPaymentDate(event.date);
    setPaymentPrincipal("");
    setPaymentInterest("");
    setPaymentFees("0");
    setPaymentPaycheck(event.paycheckId ?? "");
    setPaymentNote("");
    setPaymentError("");
  };
  const savePayment = async () => {
    if (!paymentTarget) return;
    const total = Number(paymentAmount);
    const principal = paymentPrincipal.trim() ? Number(paymentPrincipal) : undefined;
    const interest = paymentInterest.trim() ? Number(paymentInterest) : undefined;
    const fees = Number(paymentFees || 0);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(fees) || fees < 0) {
      setPaymentError("Enter a payment greater than zero and nonnegative fees.");
      return;
    }
    if (!paymentSplitIsValid(total, principal, interest, fees)) {
      setPaymentError("Principal, interest, and fees must add up to the total payment.");
      return;
    }
    const debt = debts.find((item) => item.id === paymentTarget.debtId);
    if (!debt) return;
    setSavingPayment(true);
    setPaymentError("");
    try {
      const existingPlan = payments.find((payment) => payment.status === "planned" && payment.debtId === debt.id && payment.date === paymentDate);
      const actual = {
        debtId: debt.id,
        date: paymentDate,
        amount: round2(total),
        principal: principal == null ? undefined : round2(principal),
        interest: interest == null ? undefined : round2(interest),
        fees: round2(fees),
        status: "paid" as const,
        paycheckId: paymentPaycheck || undefined,
        notes: paymentNote.trim() || undefined,
      };
      if (existingPlan) await paymentState.update(existingPlan.id, actual);
      else await paymentState.add(actual);
      setPaymentSuccess(debt.name + " payment recorded. Refresh the tracked balance from your lender statement; recording this entry does not subtract it twice.");
      setPaymentTarget(null);
    } catch {
      setPaymentError("Payment was not saved. Your local record remains unchanged.");
    } finally {
      setSavingPayment(false);
    }
  };
  const createPlan = async (event: DebtDueOccurrence) => {
    const existing = payments.find((payment) => payment.debtId === event.debtId && payment.date === event.date && payment.status === "planned");
    if (!event.paycheckId) {
      if (existing) await paymentState.update(existing.id, { paycheckId: undefined });
      return;
    }
    if (existing) {
      await paymentState.update(existing.id, { paycheckId: event.paycheckId, amount: event.amount });
      return;
    }
    await paymentState.add({ debtId: event.debtId, date: event.date, amount: event.amount, status: "planned", paycheckId: event.paycheckId, fees: 0 });
  };
  const toggleReminder = async (debt: Debt, days: number) => {
    const configured = debt.reminderDaysBefore ?? [];
    const reminderDaysBefore = configured.includes(days) ? configured.filter((day) => day !== days) : [...configured, days].sort((a, b) => b - a);
    try {
      await debtState.update(debt.id, { reminderDaysBefore });
      setReminderError("");
    } catch {
      setReminderError("Reminder preference could not be saved.");
    }
  };
  const reminders = todayEvents.filter((event) => {
    const debt = debts.find((item) => item.id === event.debtId);
    return debt && event.status !== "paid" && event.status !== "skipped" && reminderMatches(event.date, now, debt.reminderDaysBefore);
  });
  const saveCustomPlan = async () => {
    if (!targetDebt || !paymentDate || Number(paymentAmount) <= 0) return;
    const debt = debts.find((item) => item.id === targetDebt);
    if (!debt) return;
    const existingPlan = payments.find((payment) => payment.debtId === debt.id && payment.date === paymentDate && payment.status === "planned");
    const plan = { debtId: debt.id, date: paymentDate, amount: round2(Number(paymentAmount)), status: "planned" as const, paycheckId: paymentPaycheck || undefined, notes: paymentNote || undefined };
    if (existingPlan) await paymentState.update(existingPlan.id, plan);
    else await paymentState.add(plan);
    setPaymentSuccess("Planned payment saved. It is not marked as paid.");
    setPaymentTarget(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <AnimatedTabs
        value={section}
        onChange={setSection}
        ariaLabel="Debt payoff sections"
        className="no-scrollbar flex gap-1 overflow-x-auto"
        buttonClassName="px-3 py-1.5 text-[12px]"
        options={([
          ["overview", "Overview", "chart-column"],
          ["calendar", "Payment Calendar", "calendar-days"],
          ["strategies", "Strategies", "target"],
          ["insights", "Insights", "chart-no-axes-combined"],
        ] as const).map(([value, label]) => ({ value, label }))}
      />
      {paymentSuccess ? <p role="status" className="rounded-xl border border-[var(--positive)]/30 bg-[var(--positive)]/10 px-3 py-2 text-[11px] text-[var(--positive)]">{paymentSuccess}<button className="ml-2 underline" onClick={() => setPaymentSuccess("")}>Dismiss</button></p> : null}
      {section === "overview" ? <>
        <div className="grid items-stretch gap-3 xl:grid-cols-2">
          <ChartContainer title="Outstanding debt" subtitle="Current tracked balance by account" icon="tag">
            {debtSlices.length ? <CategoryBreakdownChart data={debtSlices} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} centerLabel="Total debt" centerValue={formatMoney(totals.balance, { currency })} onSliceClick={(id) => setTargetDebt(id)} height={280} /> : <ChartEmptyState label="Add a positive debt balance to see the breakdown" />}
            {targetDebt ? <p className="mt-1 text-[10px] text-fg-muted">Selected: {debts.find((debt) => debt.id === targetDebt)?.name ?? "Debt"}<button className="ml-2 underline" onClick={() => setTargetDebt("")}>Clear</button></p> : null}
          </ChartContainer>
          <section className="rounded-2xl border border-line bg-[var(--surface)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[12px] font-semibold">Debt summary</h3><span className="text-[11px] text-fg-subtle capitalize">{strategy} strategy</span></div>
            <div className="grid auto-rows-fr grid-cols-2 gap-2">
              <div className="h-full min-h-[112px] [&>div]:h-full"><CompactMetric label="Total debt remaining" value={formatMoney(totals.balance, { currency })} hint={totals.count + " active debts"} tone="negative" /></div>
              <div className="h-full min-h-[112px] [&>div]:h-full"><CompactMetric label="Monthly payment plan" value={formatMoney(plannedThisMonth, { currency })} hint="Minimums + saved extra amounts" /></div>
              <div className="h-full min-h-[112px] [&>div]:h-full"><CompactMetric label="Estimated debt-free date" value={!totals.balance ? "Debt free" : selectedStrategy.nonAmortizing ? "Payment too low" : selectedStrategy.payoffDate.slice(0, 7)} hint={!totals.balance ? "No outstanding balance" : selectedStrategy.nonAmortizing ? "Does not cover estimated interest" : selectedStrategy.months + " months · " + strategy} /></div>
              <div className="h-full min-h-[112px] [&>div]:h-full"><CompactMetric label="Projected interest" value={formatMoney(selectedStrategy.totalInterest, { currency })} hint="Projection · monthly APR/12" /></div>
              <div className="h-full min-h-[112px] [&>div]:h-full"><CompactMetric label="Next payment" value={nextEvent ? formatMoney(nextEvent.amount, { currency }) : "Date not set"} hint={nextEvent ? nextEvent.debtName + " · " + dateLabel(nextEvent.date) : "Add contractual due date"} tone={nextEvent?.status === "overdue" ? "negative" : nextEvent?.status === "due-soon" ? "negative" : "neutral"} /></div>
              <div className="h-full min-h-[112px] [&>div]:h-full"><CompactMetric label="Debts paid off" value={paidOffCount + " / " + debts.length} hint={debts.length ? formatPercent(paidOffCount / debts.length * 100, 0) + " of tracked accounts" : "No debts tracked"} tone={paidOffCount > 0 ? "positive" : "neutral"} /></div>
            </div>
          </section>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartContainer title="Projected debt balance" subtitle={strategy + " · estimated monthly APR/12 interest"} icon="trending-down">
            {selectedStrategy.nonAmortizing ? <InlineAlert tone="negative" title="This plan does not amortise">Increase the payment plan; minimums and extras do not reduce estimated interest.</InlineAlert> : debts.length ? <TrendChart data={payoffSeries.map((point) => ({ label: point.month === 0 ? "Now" : "M" + point.month, value: point.balance }))} xKey="label" series={[{ key: "value", name: "Projected balance" }]} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} type="line" height={220} /> : <ChartEmptyState label="Add debt balances to project payoff" />}
          </ChartContainer>
          <ChartContainer title="Debt-free progress" subtitle="Estimated from explicitly recorded principal portions" icon="gauge">
            <ProgressChart items={[{ id: "overall", label: "Overall principal repaid", value: principalPaid, target: originalTracked, formatValue: (value) => formatMoney(Number(value ?? 0), { currency }), caption: principalPaid > 0 ? "Estimate assumes no new borrowing or balance corrections" : "Record principal portions to build tracked progress" }]} />
            <p className="mt-1 text-center text-[11px] text-fg-muted">{formatPercent(overallProgress, 0)} tracked progress · {formatMoney(totals.balance, { currency })} remaining</p>
          </ChartContainer>
        </div>
        <ChartContainer title="Upcoming payments" subtitle="Only user-entered contractual dates are scheduled" icon="calendar-days" action={<Button size="sm" variant="secondary" onClick={() => setSection("calendar")}>Open calendar</Button>}>
          {nextEvents.length ? <div className="flex flex-col gap-1.5">{nextEvents.slice(0, 5).map((event) => <div key={event.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{event.debtName}</p><p className="text-[10px] text-fg-subtle">{dateLabel(event.date)} · {event.status}</p></div><span className="tnum text-[12px]">{formatMoney(event.amount, { currency })}</span><Button size="sm" variant="ghost" onClick={() => openPayment(event)}>Record</Button></div>)}</div> : <ChartEmptyState label="Set a due day or next payment date on a debt to create an upcoming payment" />}
        </ChartContainer>
      </> : null}

      {section === "calendar" ? <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-[var(--surface)] p-3">
          <div className="flex items-center gap-2"><Button size="sm" variant="ghost" icon="arrowLeft" onClick={previousMonth} aria-label="Previous period" /><label className="sr-only" htmlFor="debt-calendar-date">Calendar date</label><input id="debt-calendar-date" type="date" value={calendarDate} onChange={(event) => setCalendarDate(event.target.value)} className="h-9 rounded-lg border border-line bg-[var(--surface)] px-2 text-xs"/><Button size="sm" variant="ghost" icon="arrowRight" onClick={nextMonth} aria-label="Next period" /></div>
          <div className="flex rounded-full border border-line p-0.5" role="group" aria-label="Calendar view">
            {(["month", "week", "agenda"] as const).map((mode) => <button key={mode} type="button" onClick={() => setCalendarMode(mode)} aria-pressed={calendarMode === mode} className={"rounded-full px-2.5 py-1 text-[11px] capitalize " + (calendarMode === mode ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-fg-muted")}>{mode}</button>)}
          </div>
        </div>
        {calendarMode === "month" ? <div className="grid grid-cols-7 gap-1 rounded-2xl border border-line bg-[var(--surface)] p-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-1 text-center text-[10px] font-medium text-fg-subtle">{day}</div>)}
          {(() => {
            const start = new Date(monthStart(calendarDate) + "T00:00:00");
            const firstOffset = (start.getDay() + 6) % 7;
            const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
            return Array.from({ length: Math.ceil((firstOffset + daysInMonth) / 7) * 7 }, (_, index) => {
              const dayNumber = index - firstOffset + 1;
              const date = dayNumber > 0 && dayNumber <= daysInMonth ? start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, "0") + "-" + String(dayNumber).padStart(2, "0") : "";
              const dayEvents = calendarEvents.filter((event) => event.date === date);
              return <div key={index} className={"min-h-16 rounded-lg border p-1 " + (date ? "border-line bg-[var(--bg-subtle)]/30" : "border-transparent")}>
                {date ? <><p className="text-[10px] text-fg-subtle">{dayNumber}</p>{dayEvents.slice(0, 2).map((event) => <button key={event.id} onClick={() => openPayment(event)} className="mt-1 block w-full truncate rounded-md bg-[var(--accent-soft)] px-1 py-0.5 text-left text-[9px] text-fg">{event.debtName} · {formatMoney(event.amount, { currency, maximumFractionDigits: 0 })}</button>)}</> : null}
              </div>;
            });
          })()}
        </div> : null}
        {reminders.length ? <InlineAlert tone="info" title="In-app payment reminders">{reminders.map((event) => event.debtName + " is due " + (event.date === now ? "today" : "on " + dateLabel(event.date))).join(" · ")}</InlineAlert> : null}
        {reminderError ? <p role="alert" className="text-[11px] text-[var(--negative)]">{reminderError}</p> : null}
        <div className="rounded-2xl border border-line bg-[var(--surface)] p-3">
          <h3 className="mb-2 text-[13px] font-semibold">{calendarMode === "month" ? dateLabel(monthStart(calendarDate), { month: "long", year: "numeric" }) : calendarMode === "week" ? dateLabel(dateExtent.from) + " – " + dateLabel(dateExtent.to) : "Next 30 days"} · payments</h3>
          <p className="mb-2 text-[10.5px] text-fg-subtle">Monthly and biweekly minimums appear only when a contractual due day or next due date is entered. Planned extra payments use their own selected date.</p>
          {calendarEvents.length ? <div className="flex flex-col gap-2">{calendarEvents.map((event) => {
            const debt = debts.find((item) => item.id === event.debtId)!;
            const dueReminder = event.status !== "paid" && event.status !== "skipped" && reminderMatches(event.date, now, debt.reminderDaysBefore);
            return <article key={event.id} className="rounded-xl border border-line bg-[var(--bg-subtle)]/30 p-3">
              <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{event.debtName}</p><p className="text-[10.5px] text-fg-subtle">{dateLabel(event.date)} · {debt.frequency === "monthly" ? "Minimum payment" : "Biweekly minimum"}{event.paycheckId ? " · paycheck assigned" : ""}</p></div><span className="tnum text-[12px]">{formatMoney(event.amount, { currency })}</span><Badge tone={statusTone(event.status)}>{event.status}</Badge>{dueReminder ? <Badge tone="warning">Reminder due</Badge> : null}<Button size="sm" variant="secondary" onClick={() => openPayment(event)}>{event.status === "paid" ? "View / add" : "Record payment"}</Button></div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] text-fg-subtle">Remind in app:</span>
                {[7, 3, 1, 0].map((days) => <button key={days} type="button" aria-pressed={debt.reminderDaysBefore?.includes(days) ?? false} onClick={() => void toggleReminder(debt, days)} className={"rounded-full border px-2 py-1 text-[9.5px] " + (debt.reminderDaysBefore?.includes(days) ? "border-[var(--accent)] bg-[var(--accent-soft)] text-fg" : "border-line text-fg-subtle")}>{days === 0 ? "Due day" : days + " days"}</button>)}
              </div>
              {paychecks.filter((paycheck) => paycheck.date >= now && event.status !== "paid").length ? <label className="mt-2 flex max-w-sm items-center gap-2 text-[10.5px] text-fg-muted">Funding paycheck<Select value={event.paycheckId ?? ""} onChange={(input) => void createPlan({ ...event, paycheckId: input.target.value || undefined })} className="h-8 min-w-0 flex-1"><option value="">Not assigned</option>{paychecks.filter((paycheck) => paycheck.date >= now).map((paycheck) => <option key={paycheck.id} value={paycheck.id}>{dateLabel(paycheck.date)} · {formatMoney(paycheck.actualAmount ?? paycheck.expectedAmount, { currency })} {paycheck.actualAmount == null ? "expected" : "received"}</option>)}</Select></label> : <p className="mt-2 text-[10px] text-fg-subtle">Add a future paycheck in the Paycheck Planner to assign funding.</p>}
            </article>;
          })}</div> : <ChartEmptyState label="No known debt payment dates in this view. Enter due dates on debt records to populate the calendar." />}
        </div>
        {paymentTarget ? <section className="rounded-2xl border border-line bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[13px] font-semibold">Record payment · {paymentTarget.debtName}</h3><button onClick={() => setPaymentTarget(null)} className="text-[11px] text-fg-muted underline">Close</button></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[10.5px] text-fg-muted">Payment date<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="mt-1 h-9 w-full"/></label>
            <label className="text-[10.5px] text-fg-muted">Total payment<input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="mt-1 h-9 w-full"/></label>
            <label className="text-[10.5px] text-fg-muted">Fees<input type="number" min="0" step="0.01" value={paymentFees} onChange={(event) => setPaymentFees(event.target.value)} className="mt-1 h-9 w-full"/></label>
            <label className="text-[10.5px] text-fg-muted">Principal portion (optional)<input type="number" min="0" step="0.01" value={paymentPrincipal} onChange={(event) => setPaymentPrincipal(event.target.value)} className="mt-1 h-9 w-full"/></label>
            <label className="text-[10.5px] text-fg-muted">Interest portion (optional)<input type="number" min="0" step="0.01" value={paymentInterest} onChange={(event) => setPaymentInterest(event.target.value)} className="mt-1 h-9 w-full"/></label>
            <label className="text-[10.5px] text-fg-muted">Funding paycheck (optional)<Select value={paymentPaycheck} onChange={(event) => setPaymentPaycheck(event.target.value)} className="mt-1 h-9 w-full"><option value="">None</option>{paychecks.map((paycheck) => <option key={paycheck.id} value={paycheck.id}>{dateLabel(paycheck.date)} · {formatMoney(paycheck.actualAmount ?? paycheck.expectedAmount, { currency })}</option>)}</Select></label>
            <label className="text-[10.5px] text-fg-muted sm:col-span-2 lg:col-span-3">Notes<input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} className="mt-1 h-9 w-full"/></label>
          </div>
          {paymentPrincipal === "" || paymentInterest === "" ? <p className="mt-2 text-[10px] text-fg-subtle">Split not provided. Estimated monthly interest is {formatMoney(round2((debts.find((debt) => debt.id === paymentTarget.debtId)?.openingPrincipal ?? 0) * (debts.find((debt) => debt.id === paymentTarget.debtId)?.annualRate ?? 0) / 1200), { currency })}; this estimate is not saved as lender-confirmed data.</p> : null}
          {paymentError ? <p role="alert" className="mt-2 text-[11px] text-[var(--negative)]">{paymentError}</p> : null}
          <div className="mt-3 flex flex-wrap justify-end gap-2"><Button size="sm" variant="ghost" disabled={savingPayment} onClick={saveCustomPlan}>Save as planned</Button><Button size="sm" variant="primary" disabled={savingPayment} onClick={() => void savePayment()}>{savingPayment ? "Saving…" : "Record actual payment"}</Button></div>
        </section> : null}
        <section className="rounded-2xl border border-line bg-[var(--surface)] p-3">
          <h3 className="mb-2 text-[13px] font-semibold">Reminder settings</h3>
          <p className="text-[10.5px] text-fg-subtle">These are in-app reminders shown when you open this tool. Push and email delivery are not configured; no browser permission is requested.</p>
          {reminderError ? <p role="alert" className="mt-1 text-[10px] text-[var(--negative)]">{reminderError}</p> : null}
        </section>
      </div> : null}

      {section === "strategies" ? <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-[var(--surface)] p-3">
          <div><h3 className="text-[13px] font-semibold">Active projection strategy</h3><p className="text-[10.5px] text-fg-muted">Changing this preference changes estimates only; confirm before switching.</p></div>
          <div className="flex gap-2">{(["snowball", "avalanche"] as const).map((item) => <Button key={item} size="sm" variant={strategy === item ? "primary" : "secondary"} onClick={(event) => changeStrategy(item, event)}>{t(item === "snowball" ? "Snowball · smallest balance" : "Avalanche · highest APR")}</Button>)}</div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {([snowball, avalanche] as const).map((result) => <section key={result.strategy} className="rounded-2xl border border-line bg-[var(--surface)] p-3"><h3 className="text-[13px] font-semibold capitalize">{result.strategy} comparison</h3><div className="mt-2 grid grid-cols-2 gap-2"><CompactMetric label="Debt-free date" value={result.nonAmortizing ? "Payment too low" : result.payoffDate.slice(0, 7)} hint={result.months + " months"} /><CompactMetric label="Projected interest" value={formatMoney(result.totalInterest, { currency })} /><CompactMetric label="Total repayment" value={formatMoney(result.totalPaid, { currency })} /><CompactMetric label="First payoff" value={result.perDebt.filter((item) => item.payoffMonth > 0).sort((a, b) => a.payoffMonth - b.payoffMonth)[0]?.name ?? "No milestone"} hint={result.perDebt.filter((item) => item.payoffMonth > 0).sort((a, b) => a.payoffMonth - b.payoffMonth)[0]?.payoffDate ?? "Insufficient payments"} /></div></section>)}
        </div>
        <ChartContainer title="Extra payment impact simulator" subtitle="Preview only · saved debt payment schedules are unchanged" icon="target">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-3"><label className="block text-[11px] text-fg-muted">Additional monthly amount<input type="number" min="0" step="10" value={extraAmount} onChange={(event) => setExtraAmount(Math.max(0, Number(event.target.value) || 0))} className="mt-1 h-10 w-full rounded-lg border border-line bg-[var(--surface)] px-3 text-sm"/></label><input aria-label="Extra monthly payment slider" type="range" min="0" max={Math.max(1000, extraFromRecords * 3, totals.minimums * 2)} step="10" value={Math.min(extraAmount, Math.max(1000, extraFromRecords * 3, totals.minimums * 2))} onChange={(event) => setExtraAmount(Number(event.target.value))} className="w-full accent-[var(--accent)]"/><label className="block text-[11px] text-fg-muted">Apply extra to<Select value={targetDebt} onChange={(event) => setTargetDebt(event.target.value)} className="mt-1 h-10 w-full"><option value="">Selected strategy target</option>{debts.map((debt) => <option key={debt.id} value={debt.id}>{debt.name}</option>)}</Select></label><p className="text-[10px] text-fg-subtle">Each debt accrues estimated monthly interest at APR ÷ 12. The simulation caps each final payment at the remaining balance and does not create a payment record.</p></div>
            <div className="grid grid-cols-2 gap-2"><CompactMetric label="Current payoff" value={baseSimulation.nonAmortizing ? "Insufficient" : baseSimulation.months + " mo"} hint={formatMoney(baseSimulation.totalInterest, { currency }) + " interest"} /><CompactMetric label="Proposed payoff" value={proposedSimulation.nonAmortizing ? "Insufficient" : proposedSimulation.months + " mo"} hint={formatMoney(proposedSimulation.totalInterest, { currency }) + " interest"} tone="positive" /><CompactMetric label="Months saved" value={baseSimulation.nonAmortizing ? "—" : Math.max(0, baseSimulation.months - proposedSimulation.months) + " mo"} /><CompactMetric label="Interest saved" value={formatMoney(Math.max(0, baseSimulation.totalInterest - proposedSimulation.totalInterest), { currency })} tone="positive" /></div>
          </div>
        </ChartContainer>
        <ChartContainer title="Projected payoff milestones" subtitle={"Calculated by the " + strategy + " amortization simulation"} icon="calendar-range">
          {selectedStrategy.perDebt.length ? <div className="flex flex-col gap-2">{[...selectedStrategy.perDebt].sort((a, b) => a.payoffMonth - b.payoffMonth).map((milestone) => <div key={milestone.debtId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-line p-2.5"><div className="min-w-0"><p className="truncate text-[12px] font-medium">{milestone.name}</p><p className="text-[10px] text-fg-subtle">{milestone.payoffMonth ? dateLabel(milestone.payoffDate, { month: "long", year: "numeric" }) : "No payoff month projected"}</p></div><div className="w-24"><div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]"><div className="h-full bg-[var(--accent)]" style={{ width: selectedStrategy.months ? Math.min(100, milestone.payoffMonth / selectedStrategy.months * 100) + "%" : "0%" }} /></div></div></div>)}</div> : <ChartEmptyState label="Add debts to calculate payoff milestones" />}
        </ChartContainer>
      </div> : null}

      {section === "insights" ? <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title="Actual monthly payments" subtitle="Recorded amounts only · planned entries are excluded" icon="chart-column" action={<div className="flex gap-1">{[3, 6, 12].map((range) => <button key={range} type="button" aria-pressed={historyRange === range} onClick={() => setHistoryRange(range)} className={"rounded-full px-2 py-1 text-[10px] " + (historyRange === range ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-fg-muted")}>{range}M</button>)}</div>}>
          <div className="relative h-[230px] min-w-0 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" tick={{ fill: "var(--fg-subtle)", fontSize: 9 }}/><YAxis width={60} tick={{ fill: "var(--fg-subtle)", fontSize: 9 }} tickFormatter={(value) => formatMoney(Number(value), { currency, maximumFractionDigits: 0 })}/><Tooltip formatter={(value) => formatMoney(Number(value), { currency })}/><Bar dataKey="actual" name="Actual payments" fill="var(--accent)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <ChartLegend items={[{ label: "Recorded actual payments", color: "var(--accent)" }]} />
          {!recordedPaid.length ? <p className="text-center text-[10px] text-fg-subtle">No actual payments recorded yet.</p> : null}
        </ChartContainer>
        <ChartContainer title="Principal vs interest and fees" subtitle="Only user-entered payment splits; no estimated amounts are mixed in" icon="chart-column">
          {monthPayments.some((payment) => payment.principal != null || payment.interest != null || (payment.fees ?? 0) > 0) ? <div className="relative h-[230px] min-w-0 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" tick={{ fill: "var(--fg-subtle)", fontSize: 9 }}/><YAxis width={60} tick={{ fill: "var(--fg-subtle)", fontSize: 9 }}/><Tooltip formatter={(value) => formatMoney(Number(value), { currency })}/><Bar dataKey="principal" name="Principal" stackId="payment" fill="var(--positive)" /><Bar dataKey="interest" name="Interest" stackId="payment" fill="var(--warning)" /><Bar dataKey="fees" name="Fees" stackId="payment" fill="var(--negative)" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div> : <ChartEmptyState label="Record principal, interest, or fees from lender statements to see this breakdown" />}
          <ChartLegend items={[{ label: "Principal", color: "var(--positive)" }, { label: "Interest", color: "var(--warning)" }, { label: "Fees", color: "var(--negative)" }]} />
        </ChartContainer>
        <ChartContainer title="Tracked progress by debt" subtitle="Estimated original = current tracked balance + recorded principal paid" icon="gauge">
          {progress.length ? <div className="flex flex-col gap-2">{progress.map((row) => <div key={row.debt.id} className="rounded-xl border border-line p-2.5"><div className="mb-1 flex items-center justify-between gap-2"><span className="truncate text-[11px] font-medium">{row.debt.name}</span><span className="text-[10px] text-fg-muted">{formatPercent(row.progressPercent, 0)}{row.estimate ? " · est." : " · no principal history"}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]"><div className="h-full bg-[var(--accent)]" style={{ width: row.progressPercent + "%" }} /></div><p className="mt-1 text-[10px] text-fg-subtle">{formatMoney(row.principalPaid, { currency })} principal recorded · {formatMoney(row.current, { currency })} current tracked</p></div>)}</div> : <ChartEmptyState label="Add debts to track principal progress" />}
        </ChartContainer>
        <ChartContainer title="Payment activity" subtitle="Recorded actuals with optional principal / interest history" icon="receipt">
          {payments.length ? <div className="max-h-64 overflow-y-auto">{[...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0"><div className="min-w-0"><p className="truncate text-[11px]">{debts.find((debt) => debt.id === payment.debtId)?.name ?? "Debt"} · {dateLabel(payment.date)}</p><p className="text-[9.5px] text-fg-subtle capitalize">{payment.status ?? "paid"}{payment.transactionId ? " · linked transaction" : ""}</p></div><span className="tnum text-[11px]">{formatMoney(payment.amount, { currency })}</span></div>)}</div> : <ChartEmptyState label="Payment history will appear here when you record lender payments" />}
        </ChartContainer>
      </div> : null}

      <Dialog
        open={pendingStrategy !== null}
        onOpenChange={(open) => {
          if (!open) closeStrategyDialog();
        }}
      >
        {pendingStrategy ? (() => {
          const currentName = strategy === "snowball" ? "Snowball" : "Avalanche";
          const nextName = pendingStrategy === "snowball" ? "Snowball" : "Avalanche";
          return (
            <DialogContent
              title="Change Debt Payoff Strategy?"
              description={
                <>
                  {t("You're about to switch your active repayment strategy:")} {" "}
                  <strong className="font-semibold text-fg">{t(currentName)} → {t(nextName)}</strong>.{" "}
                  {t("This will update your debt payoff projections, repayment order, and estimated debt-free date.")} {" "}
                  {t("Your existing debts, recorded payments, and payment schedules will remain unchanged.")}
                </>
              }
              className="sm:max-w-[470px]"
            >
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={closeStrategyDialog} disabled={isSavingStrategy}>
                  {t("Cancel")}
                </Button>
                <Button variant="primary" size="sm" onClick={() => void confirmStrategy()} disabled={isSavingStrategy}>
                  {isSavingStrategy ? t("Saving…") : t("Switch to {strategy}", { strategy: t(nextName) })}
                </Button>
              </div>
            </DialogContent>
          );
        })() : null}
      </Dialog>
    </div>
  );
}
