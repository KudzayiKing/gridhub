"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CategoryBreakdownChart, ChartContainer, ChartEmptyState, ChartLegend, TrendChart } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Badge, CompactMetric } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { useCollection } from "@/lib/store";
import { formatMoney, formatPercent, round2 } from "@/lib/money";
import { downloadFile } from "@/lib/utils";
import { PinChartButton } from "@/lib/chart-widgets";
import { netWorthSummary } from "@/lib/calc/money";
import { rows, today, type DataMap } from "@/lib/tools/shared";
import type { Holding, InvestmentTransaction, NetWorthAllocationTarget, NetWorthItem, ValuationSnapshot } from "@/lib/types";
import { calculateTimeWeightedReturn, calculateXirr } from "@/lib/reporting/investment-returns";

type Range = 3 | 6 | 12 | "all";
const PALETTE = ["var(--positive)", "var(--accent)", "var(--warning)", "var(--negative)", "#76a8c9", "#b39ddb", "#e7a6c9", "#8cae91"];
const sum = (values: number[]) => round2(values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0));
const asDate = (value: string) => new Date(value + "T00:00:00");

export function NetWorthDashboard({ data, currency, onOpenTab }: { data: DataMap; currency: string; onOpenTab: (tab: string) => void }) {
  const items = rows<NetWorthItem>(data, "items").filter((row) => !row.deleted && (row.currency || "USD") === currency);
  const holdings = rows<Holding>(data, "holdings").filter((row) => !row.deleted && (row.currency || "USD") === currency);
  const snapshotStore = useCollection<ValuationSnapshot>("net-worth", "snapshots");
  const targetStore = useCollection<NetWorthAllocationTarget>("net-worth", "allocationTargets");
  const activityStore = useCollection<InvestmentTransaction>("net-worth", "investmentTransactions");
  const snapshots = snapshotStore.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency).sort((a, b) => a.date.localeCompare(b.date));
  const investmentActivity = activityStore.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency);
  const targets = targetStore.rows.filter((row) => !row.deleted);
  const currentDate = today();
  const summarySnapshots = snapshots.filter((row) => row.date < currentDate);
  const summary = netWorthSummary(items, holdings, summarySnapshots, currency);
  const [range, setRange] = React.useState<Range>(12);
  const [growthSeries, setGrowthSeries] = React.useState(["assets", "liabilities", "netWorth"]);
  const [aggregation, setAggregation] = React.useState<"month" | "year">("month");
  const [gainSort, setGainSort] = React.useState<"gain" | "loss">("gain");
  const [holdingFilter, setHoldingFilter] = React.useState("");
  const [selectedHolding, setSelectedHolding] = React.useState("");
  const [selectedAssetCategory, setSelectedAssetCategory] = React.useState("");
  const [selectedLiabilityCategory, setSelectedLiabilityCategory] = React.useState("");
  const [selectedInvestmentClass, setSelectedInvestmentClass] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const marketValue = (holding: Holding) => round2(Number(holding.quantity) * Number(holding.unitPrice));
  const current = summary.netWorth;
  const totalAssets = summary.assets;
  const totalLiabilities = summary.liabilities;
  const investmentValue = summary.holdingsValue;
  const xirr = calculateXirr(investmentActivity, investmentValue, currentDate);
  const timeWeightedReturn = calculateTimeWeightedReturn(snapshots, investmentActivity);
  const ratio = totalLiabilities > 0 ? totalAssets / totalLiabilities : null;
  const assetItems = items.filter((row) => row.kind === "asset" && Number(row.value) > 0);
  const liabilityItems = items.filter((row) => row.kind === "liability" && Number(row.value) > 0);
  const assetIds = new Set(items.filter((item) => item.kind === "asset").map((item) => item.id));
  const holdingsCountedAsAssets = holdings.filter((holding) => !holding.parentAssetId || !assetIds.has(holding.parentAssetId));
  const staleValuations = [...items, ...holdings].filter((row) => row.valuationDate && (asDate(currentDate).getTime() - asDate(row.valuationDate).getTime()) / 86400000 > 180);
  const currenciesPresent = new Set([...rows<NetWorthItem>(data, "items").filter((row) => !row.deleted).map((row) => row.currency || "USD"), ...rows<Holding>(data, "holdings").filter((row) => !row.deleted).map((row) => row.currency || "USD")]);

  const assetTotals = new Map<string, number>();
  for (const item of assetItems) {
    const category = item.category?.trim() || "Uncategorized";
    assetTotals.set(category, (assetTotals.get(category) ?? 0) + Number(item.value));
  }
  for (const holding of holdingsCountedAsAssets) {
    const category = "Investment · " + (holding.assetClass?.trim() || "Unclassified");
    assetTotals.set(category, (assetTotals.get(category) ?? 0) + marketValue(holding));
  }
  const assetSlices = [...assetTotals].filter(([, value]) => value > 0).map(([name, value], index) => ({ id: name, name, value: round2(value), color: PALETTE[index % PALETTE.length] }));
  const liabilityTotals = new Map<string, number>();
  for (const item of liabilityItems) {
    const category = item.category?.trim() || "Uncategorized";
    liabilityTotals.set(category, (liabilityTotals.get(category) ?? 0) + Number(item.value));
  }
  const liabilitySlices = [...liabilityTotals].map(([name, value], index) => ({ id: name, name, value: round2(value), color: PALETTE[index % PALETTE.length] }));
  const investmentTotals = new Map<string, number>();
  for (const holding of holdings) {
    const assetClass = holding.assetClass?.trim() || "Unclassified";
    investmentTotals.set(assetClass, (investmentTotals.get(assetClass) ?? 0) + marketValue(holding));
  }
  const investmentSlices = [...investmentTotals].map(([name, value], index) => ({ id: name, name, value: round2(value), color: PALETTE[index % PALETTE.length] }));

  const cutoff = (() => {
    if (range === "all") return "0000-00-00";
    const date = asDate(currentDate);
    date.setMonth(date.getMonth() - range);
    return date.toISOString().slice(0, 10);
  })();
  const historical = snapshots.filter((row) => row.date >= cutoff && row.date <= currentDate).map((row) => ({
    date: row.date,
    assets: Number(row.totalAssets),
    liabilities: Number(row.totalLiabilities),
    netWorth: round2(Number(row.totalAssets) - Number(row.totalLiabilities)),
    investmentValue: row.investmentValue,
  }));
  if (!historical.some((point) => point.date === currentDate)) historical.push({ date: currentDate, assets: totalAssets, liabilities: totalLiabilities, netWorth: current, investmentValue });
  historical.sort((a, b) => a.date.localeCompare(b.date));
  const portfolioHistory = historical.filter((point) => point.investmentValue != null).map((point) => ({ date: point.date, portfolio: Number(point.investmentValue) }));
  const groupedPeriods = new Map<string, (typeof historical)[number]>();
  for (const point of historical) groupedPeriods.set(aggregation === "month" ? point.date.slice(0, 7) : point.date.slice(0, 4), point);
  const groupedHistory = [...groupedPeriods.values()];
  const gains = holdings.map((holding) => ({
    id: holding.id,
    label: holding.symbol ? holding.name + " · " + holding.symbol : holding.name,
    marketValue: marketValue(holding),
    basis: Number(holding.costBasis),
    gain: Number(holding.costBasis) > 0 ? round2(marketValue(holding) - Number(holding.costBasis)) : null,
    percent: Number(holding.costBasis) > 0 ? round2((marketValue(holding) - Number(holding.costBasis)) / Number(holding.costBasis) * 100) : null,
    holding,
  })).filter((row) => !holdingFilter || row.holding.accountName === holdingFilter)
    .sort((a, b) => gainSort === "gain" ? (b.gain ?? -Infinity) - (a.gain ?? -Infinity) : (a.gain ?? Infinity) - (b.gain ?? Infinity));
  const selectedHoldingRow = gains.find((row) => row.id === selectedHolding);
  const targetByClass = new Map<string, number>();
  for (const target of targets) targetByClass.set(target.assetClass, (targetByClass.get(target.assetClass) ?? 0) + Number(target.targetPercent));
  const targetTotal = sum(targets.map((row) => Number(row.targetPercent)));
  const targetsValid = targets.length > 0 && targets.every((row) => Number(row.targetPercent) >= 0 && Number(row.targetPercent) <= 100) && Math.abs(targetTotal - 100) <= 0.5;
  const actualByClass = new Map(investmentTotals);
  const driftRows = [...new Set([...targetByClass.keys(), ...actualByClass.keys()])].map((assetClass) => {
    const actual = investmentValue > 0 ? (actualByClass.get(assetClass) ?? 0) / investmentValue * 100 : 0;
    const target = targetByClass.get(assetClass) ?? 0;
    return { name: assetClass, target, actual: round2(actual), drift: round2(actual - target) };
  });
  const assetsReconcile = sum(assetSlices.map((slice) => slice.value)) === totalAssets;
  const liabilitiesReconcile = sum(liabilitySlices.map((slice) => slice.value)) === totalLiabilities;

  const createSnapshot = async () => {
    setMessage(""); setError("");
    if (snapshots.some((row) => row.date === currentDate)) { setMessage("A snapshot already exists for today. Edit it in Snapshots if you need to correct the recorded values."); return; }
    setSaving(true);
    try {
      const assetsByCategory = Object.fromEntries(assetSlices.map((slice) => [slice.name, slice.value]));
      const liabilitiesByCategory = Object.fromEntries(liabilitySlices.map((slice) => [slice.name, slice.value]));
      await snapshotStore.add({ date: currentDate, totalAssets, totalLiabilities, currency, investmentValue, assetsByCategory, liabilitiesByCategory, note: "Recorded from current net-worth dashboard values" });
      setMessage("Today's net-worth snapshot was recorded.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not record snapshot.");
    } finally { setSaving(false); }
  };
  const exportReport = () => {
    const csv = [
      ["GridHub Net Worth Report", currentDate], ["Currency", currency], ["Total assets", totalAssets], ["Total liabilities", totalLiabilities], ["Net worth", current], ["Investment value", investmentValue],
      [], ["Assets", "Category", "Value", "Currency", "Valuation date"],
      ...assetItems.map((row) => [row.name, row.category || "Uncategorized", row.value, row.currency, row.valuationDate]),
      ...holdingsCountedAsAssets.map((row) => [row.name, "Investment · " + (row.assetClass || "Unclassified"), marketValue(row), row.currency, row.valuationDate]),
      [], ["Liabilities", "Category", "Balance", "Currency", "Valuation date"],
      ...liabilityItems.map((row) => [row.name, row.category || "Uncategorized", row.value, row.currency, row.valuationDate]),
    ].map((line) => line.map((value) => "\"" + String(value ?? "").replaceAll("\"", "\"\"") + "\"").join(",")).join("\n");
    downloadFile("gridhub-net-worth-" + currentDate + ".csv", csv, "text/csv;charset=utf-8");
  };

  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-[16px] font-semibold">Wealth dashboard</h2><p className="text-[11px] text-fg-muted">Values use {currency} records only. No exchange rates or market prices are invented.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" icon="plus" onClick={() => onOpenTab("items")}>Add asset or liability</Button>
        <Button size="sm" variant="secondary" icon="line-chart" onClick={() => onOpenTab("holdings")}>Add investment</Button>
        <Button size="sm" variant="secondary" icon="camera" disabled={saving} onClick={() => void createSnapshot()}>{saving ? "Recording…" : "Record snapshot"}</Button>
        <Button size="sm" variant="secondary" icon="download" onClick={exportReport}>Export report</Button>
      </div>
    </div>
    {currenciesPresent.size > 1 ? <p className="rounded-xl border border-line bg-[var(--bg-subtle)] px-3 py-2 text-[11px] text-fg-muted">Other currencies ({[...currenciesPresent].filter((code) => code !== currency).join(", ")}) are excluded until you record verified exchange rates.</p> : null}
    {staleValuations.length ? <p className="rounded-xl border border-line bg-[var(--bg-subtle)] px-3 py-2 text-[11px] text-fg-muted">{staleValuations.length} valuation{staleValuations.length === 1 ? " is" : "s are"} more than 180 days old. Check the recorded dates before relying on the current totals.</p> : null}
    {message ? <p role="status" className="text-[11px] text-fg-muted">{message}</p> : null}{error ? <p role="alert" className="text-[11px] text-[var(--negative)]">{error}</p> : null}
    <div className="grid items-stretch gap-3 xl:grid-cols-2">
      <ChartContainer title="Asset allocation" subtitle="Assets and holdings by one primary category · each holding is included once" icon="chart-column" action={<PinChartButton chartId="net-worth.assets" title="Asset Allocation" tool="net-worth" />}>
        {!assetsReconcile && assetSlices.length ? <ChartEmptyState label="Asset allocation is unavailable because one or more non-positive asset values prevent the category totals from matching Total Assets. Review the recorded valuations." /> : assetSlices.length ? <CategoryBreakdownChart data={assetSlices} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} centerLabel="Total assets" centerValue={formatMoney(totalAssets, { currency })} onSliceClick={(id) => setSelectedAssetCategory(id === selectedAssetCategory ? "" : id)} height={330} /> : <ChartEmptyState label="Add your first asset to understand what you own." />}
        {selectedAssetCategory ? <div className="mt-2 rounded-xl border border-line p-3"><p className="text-xs font-semibold">{selectedAssetCategory}</p>{assetItems.filter((item) => (item.category?.trim() || "Uncategorized") === selectedAssetCategory).map((item) => <p key={item.id} className="flex justify-between gap-2 border-b border-line py-1.5 text-[11px] last:border-0"><span>{item.name}</span><span>{formatMoney(item.value, { currency })}</span></p>)}{selectedAssetCategory.startsWith("Investment · ") ? holdings.filter((holding) => selectedAssetCategory === "Investment · " + (holding.assetClass?.trim() || "Unclassified")).map((holding) => <p key={holding.id} className="flex justify-between gap-2 border-b border-line py-1.5 text-[11px] last:border-0"><span>{holding.name}</span><span>{formatMoney(marketValue(holding), { currency })}</span></p>) : null}</div> : null}
      </ChartContainer>
      <ChartContainer title="Wealth summary" subtitle="Current balance sheet and investment position" icon="wallet">
        <div className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="min-h-[96px] [&>div]:h-full"><CompactMetric label="Total net worth" value={formatMoney(current, { currency, signed: true })} hint={summary.change == null ? "No historical comparison yet" : "Since latest snapshot · " + formatMoney(summary.change, { currency, signed: true })} tone={current >= 0 ? "positive" : "negative"} /></div>
          <div className="min-h-[96px] [&>div]:h-full"><CompactMetric label="Total assets" value={formatMoney(totalAssets, { currency })} hint={assetItems.length + holdings.length + " asset records and holdings"} tone="positive" /></div>
          <div className="min-h-[96px] [&>div]:h-full"><CompactMetric label="Total liabilities" value={formatMoney(totalLiabilities, { currency })} hint={liabilityItems.length ? liabilityItems.length + " tracked liabilities" : "No liabilities tracked yet"} tone={totalLiabilities ? "negative" : "neutral"} /></div>
          <div className="min-h-[96px] [&>div]:h-full"><CompactMetric label="Investment portfolio value" value={formatMoney(investmentValue, { currency })} hint={holdings.length + " holdings · manually valued"} /></div>
          <div className="min-h-[96px] [&>div]:h-full"><CompactMetric label="Net worth change" value={summary.change == null ? "Add a dated snapshot" : formatMoney(summary.change, { currency, signed: true })} hint={summary.changePct == null ? "Percentage unavailable for this baseline" : formatPercent(summary.changePct) + " since latest snapshot"} tone={summary.change == null ? "neutral" : summary.change >= 0 ? "positive" : "negative"} /></div>
          <div className="min-h-[96px] [&>div]:h-full"><CompactMetric label="Asset-to-debt ratio" value={ratio == null ? "No tracked debt" : ratio.toFixed(2) + "×"} hint={ratio == null ? "No liabilities recorded in this currency" : "Assets divided by liabilities"} /></div>
        </div>
      </ChartContainer>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartContainer title="Net worth growth" subtitle="Recorded snapshots plus today's current valuation · no backfilled history" icon="trending-up" action={<div className="flex flex-wrap items-center justify-end gap-1"><div className="flex gap-1">{([3, 6, 12, "all"] as const).map((value) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={"rounded-full px-2 py-1 text-[10px] " + (range === value ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-fg-muted")}>{value === "all" ? "All" : value + "M"}</button>)}</div><PinChartButton chartId="net-worth.growth" title="Net Worth Growth" tool="net-worth" /></div>}>
        <div className="mb-2 flex flex-wrap gap-1">{([{ key: "assets", label: "Assets" }, { key: "liabilities", label: "Liabilities" }, { key: "netWorth", label: "Net worth" }] as const).map((series) => <button key={series.key} type="button" aria-pressed={growthSeries.includes(series.key)} onClick={() => setGrowthSeries((current) => current.includes(series.key) ? current.filter((key) => key !== series.key) : [...current, series.key])} className={"rounded-full border px-2 py-1 text-[10px] " + (growthSeries.includes(series.key) ? "border-[var(--accent)] text-fg" : "border-line text-fg-subtle")}>{series.label}</button>)}</div>
        {historical.length ? <TrendChart data={historical.map((row) => ({ ...row, date: new Date(row.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "2-digit" }) }))} xKey="date" series={[{ key: "assets", name: "Assets", color: "var(--positive)" }, { key: "liabilities", name: "Liabilities", color: "var(--negative)" }, { key: "netWorth", name: "Net worth", color: "var(--accent)" }].filter((series) => growthSeries.includes(series.key))} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} type="line" height={260} /> : <ChartEmptyState label="Your net worth history will appear after you record valuations over time." />}
      </ChartContainer>
      <ChartContainer title="Liabilities breakdown" subtitle="Outstanding balances grouped by their recorded category" icon="chart-column">
        {!liabilitiesReconcile && liabilitySlices.length ? <ChartEmptyState label="Liability allocation is unavailable because recorded values do not reconcile to Total Liabilities. Review the liability valuations." /> : liabilitySlices.length ? <CategoryBreakdownChart data={liabilitySlices} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} centerLabel="Liabilities" centerValue={formatMoney(totalLiabilities, { currency })} onSliceClick={(id) => setSelectedLiabilityCategory(id === selectedLiabilityCategory ? "" : id)} height={260} /> : <ChartEmptyState label="No liabilities tracked yet." />}
        {selectedLiabilityCategory ? <div className="mt-2 rounded-xl border border-line p-3"><p className="text-xs font-semibold">{selectedLiabilityCategory}</p>{liabilityItems.filter((item) => (item.category?.trim() || "Uncategorized") === selectedLiabilityCategory).map((item) => <p key={item.id} className="flex justify-between gap-2 border-b border-line py-1.5 text-[11px] last:border-0"><span>{item.name}</span><span>{formatMoney(item.value, { currency })}</span></p>)}</div> : null}
      </ChartContainer>
      <ChartContainer title="Investment portfolio allocation" subtitle="Holdings grouped by their saved top-level asset class" icon="chart-column">
        {investmentSlices.length ? <CategoryBreakdownChart data={investmentSlices} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} centerLabel="Portfolio value" centerValue={formatMoney(investmentValue, { currency })} onSliceClick={(id) => setSelectedInvestmentClass(id === selectedInvestmentClass ? "" : id)} height={260} /> : <ChartEmptyState label="Add an investment holding to see portfolio allocation." />}
        {selectedInvestmentClass ? <div className="mt-2 rounded-xl border border-line p-3"><p className="text-xs font-semibold">{selectedInvestmentClass}</p>{holdings.filter((holding) => (holding.assetClass?.trim() || "Unclassified") === selectedInvestmentClass).map((holding) => <p key={holding.id} className="flex justify-between gap-2 border-b border-line py-1.5 text-[11px] last:border-0"><span>{holding.name}</span><span>{formatMoney(marketValue(holding), { currency })}</span></p>)}</div> : null}
      </ChartContainer>
      <ChartContainer title="Portfolio value history" subtitle="Dated snapshot values · changes are not labeled as investment returns" icon="line-chart">
        {portfolioHistory.length ? <TrendChart data={portfolioHistory} xKey="date" series={[{ key: "portfolio", name: "Portfolio value" }]} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} type="line" height={260} /> : <ChartEmptyState label="Portfolio history will appear after recording a snapshot with the current holdings valuation." />}
      </ChartContainer>
      <ChartContainer title="Investment returns" subtitle="Return measures use recorded cash flows and dated valuations; portfolio growth alone is not treated as return" icon="trending-up">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-h-[124px] rounded-xl border border-line bg-[var(--bg-subtle)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Money-weighted return · XIRR</p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: xirr.annualizedPct == null ? "var(--fg)" : xirr.annualizedPct >= 0 ? "var(--positive)" : "var(--negative)" }}>{xirr.annualizedPct == null ? "Unavailable" : formatPercent(xirr.annualizedPct)}</p>
            <p className="mt-1 text-[11px] text-fg-muted">Annualized against contributions, withdrawals, non-reinvested distributions, external fees, and today&apos;s portfolio value.</p>
            {xirr.reason ? <p className="mt-2 text-[10px] text-fg-subtle">{xirr.reason}</p> : null}
          </div>
          <div className="min-h-[124px] rounded-xl border border-line bg-[var(--bg-subtle)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Time-weighted return · TWR</p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: timeWeightedReturn.cumulativePct == null ? "var(--fg)" : timeWeightedReturn.cumulativePct >= 0 ? "var(--positive)" : "var(--negative)" }}>{timeWeightedReturn.cumulativePct == null ? "Unavailable" : formatPercent(timeWeightedReturn.cumulativePct)}</p>
            <p className="mt-1 text-[11px] text-fg-muted">{timeWeightedReturn.annualizedPct == null ? "Cumulative return from eligible snapshot periods." : "Cumulative · " + formatPercent(timeWeightedReturn.annualizedPct) + " annualized · " + timeWeightedReturn.periods + " periods"}</p>
            {timeWeightedReturn.reason ? <p className="mt-2 text-[10px] text-fg-subtle">{timeWeightedReturn.reason}</p> : null}
          </div>
        </div>
        <p className="mt-3 text-[10px] text-fg-subtle">Returns depend on the accuracy of entered transactions and valuations. TWR is withheld for periods containing external cash flows because no before-and-after flow valuations are recorded.</p>
      </ChartContainer>
      <ChartContainer title="Assets vs liabilities" subtitle="Last recorded value in each selected month or year · amounts in the selected currency" icon="chart-column" action={<Select aria-label="Aggregate wealth history" value={aggregation} onChange={(event) => setAggregation(event.target.value as "month" | "year")} className="h-8 w-auto"><option value="month">Monthly</option><option value="year">Yearly</option></Select>}>
        {groupedHistory.length ? <div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={groupedHistory} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="date" tick={{ fill: "var(--fg-subtle)", fontSize: 10 }} /><YAxis tick={{ fill: "var(--fg-subtle)", fontSize: 10 }} tickFormatter={(value) => formatMoney(Number(value), { currency, maximumFractionDigits: 0 })} /><Tooltip formatter={(value) => formatMoney(Number(value ?? 0), { currency })} /><Bar dataKey="assets" name="Assets" fill="var(--positive)" radius={[4, 4, 0, 0]} /><Bar dataKey="liabilities" name="Liabilities" fill="var(--negative)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <ChartEmptyState label="Record snapshots to compare asset and liability values over time." />}
        <ChartLegend items={[{ label: "Assets", color: "var(--positive)" }, { label: "Liabilities", color: "var(--negative)" }]} />
      </ChartContainer>
      <ChartContainer title="Portfolio gains and losses" subtitle="Market value minus entered total cost basis · not a tax statement" icon="trending-up" action={<div className="flex flex-wrap gap-1"><Select aria-label="Filter holdings by account" value={holdingFilter} onChange={(event) => setHoldingFilter(event.target.value)} className="h-8 w-auto max-w-36"><option value="">All accounts</option>{[...new Set(holdings.map((holding) => holding.accountName).filter((name): name is string => Boolean(name)))].map((name) => <option key={name} value={name}>{name}</option>)}</Select><Select aria-label="Sort gains and losses" value={gainSort} onChange={(event) => setGainSort(event.target.value as "gain" | "loss")} className="h-8 w-auto"><option value="gain">Largest gain</option><option value="loss">Largest loss</option></Select></div>}>
        {gains.length ? <div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={gains} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }} onClick={(event) => { const id = (event as unknown as { activePayload?: { payload?: { id?: string } }[] })?.activePayload?.[0]?.payload?.id; if (id) setSelectedHolding(id); }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" tick={{ fill: "var(--fg-subtle)", fontSize: 9 }} tickFormatter={(value) => formatMoney(Number(value), { currency, maximumFractionDigits: 0 })} /><YAxis type="category" dataKey="label" width={120} tick={{ fill: "var(--fg-subtle)", fontSize: 10 }} /><ReferenceLine x={0} stroke="var(--border)" /><Tooltip formatter={(value, _name, item) => value == null ? "Cost basis unavailable" : formatMoney(Number(value), { currency, signed: true }) + " · " + (item.payload.percent == null ? "" : formatPercent(item.payload.percent))} /><Bar dataKey="gain" name="Unrealized gain/loss" radius={[0, 4, 4, 0]}>{gains.map((row) => <Cell key={row.id} fill={row.gain == null ? "var(--fg-subtle)" : row.gain >= 0 ? "var(--positive)" : "var(--negative)"} className="cursor-pointer" />)}</Bar></BarChart></ResponsiveContainer></div> : <ChartEmptyState label="Add investment holdings to compare market value with recorded cost basis." />}
        {gains.some((row) => row.gain == null) ? <p className="mt-2 text-[10px] text-fg-subtle">Holdings without a positive entered cost basis are shown as unavailable.</p> : null}
        {selectedHoldingRow ? <div className="mt-2 rounded-xl border border-line p-3 text-[11px]"><div className="flex justify-between gap-2"><span className="font-semibold">{selectedHoldingRow.holding.name}</span><span>{selectedHoldingRow.holding.valuationDate}</span></div><p className="mt-1 text-fg-muted">{selectedHoldingRow.holding.accountName || "Account not specified"} · {selectedHoldingRow.holding.quantity} units · {formatMoney(selectedHoldingRow.marketValue, { currency })} market value · {selectedHoldingRow.gain == null ? "Cost basis unavailable" : formatMoney(selectedHoldingRow.basis, { currency }) + " cost basis · " + formatMoney(selectedHoldingRow.gain, { currency, signed: true }) + " (" + formatPercent(selectedHoldingRow.percent) + ")"}</p>{selectedHoldingRow.holding.notes ? <p className="mt-1 text-fg-subtle">{selectedHoldingRow.holding.notes}</p> : null}</div> : null}
      </ChartContainer>
      <ChartContainer title="Asset allocation drift" subtitle="User-defined targets compared with actual holding allocation · no trading advice" icon="target" action={<Button size="sm" variant="secondary" onClick={() => onOpenTab("allocationTargets")}>Edit targets</Button>}>
        {targets.length && !targetsValid ? <ChartEmptyState label={"Allocation targets must total 100% (currently " + formatPercent(targetTotal) + "). Adjust targets in the Allocation targets tab."} /> : targetsValid && investmentValue > 0 ? <div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={driftRows} layout="vertical" margin={{ top: 6, right: 18, bottom: 4, left: 8 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "var(--fg-subtle)", fontSize: 9 }} /><YAxis type="category" dataKey="name" width={110} tick={{ fill: "var(--fg-subtle)", fontSize: 10 }} /><Tooltip formatter={(value, name) => [Number(value).toFixed(1) + "%", name]} /><Bar dataKey="target" name="Target" fill="var(--bg-subtle)" radius={[0, 4, 4, 0]} /><Bar dataKey="actual" name="Actual" fill="var(--accent)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <ChartEmptyState label="Add target allocations totaling 100% and classify holdings to inspect allocation drift." />}
        {targetsValid ? <div className="mt-2 flex flex-wrap gap-2">{driftRows.map((row) => <Badge key={row.name} tone="neutral">{row.name}: {row.drift > 0 ? "+" : ""}{row.drift.toFixed(1)} pts</Badge>)}</div> : null}
      </ChartContainer>
    </div>
    {snapshots.length ? <p className="text-[10px] text-fg-subtle">Latest snapshot: {snapshots[snapshots.length - 1].date} · historical records preserve values as recorded.</p> : null}
  </div>;
}
