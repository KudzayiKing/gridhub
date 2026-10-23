"use client";

import * as React from "react";
import { useCollection } from "@/lib/store";
import type { BaseRecord } from "@/lib/types";
import type { ToolId } from "@/lib/catalog";
import { TOOL_MAP } from "@/lib/catalog";
import { cn, downloadFile } from "@/lib/utils";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { ToolIcon } from "@/components/icons/tool-icons";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/data/data-table";
import { RecordForm, type FormField, type FormValues } from "@/components/data/record-form";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/overlay";

export interface LedgerTab {
  id: string;
  label: string;
  icon?: string;
  collection: string;
  fields: FormField[];
  columns: Column<BaseRecord>[];
  emptyTitle: string;
  emptyDescription: string;
  defaults?: Record<string, unknown>;
  searchText?: (row: BaseRecord) => string;
  addLabel?: string;
  pageSize?: number;
  renderExtra?: (rows: BaseRecord[], helpers: { reload: () => Promise<void> }) => React.ReactNode;
  /** When set, only rows matching the predicate are shown — used by chart drill-down (spec #21). */
  filter?: (row: BaseRecord) => boolean;
  /** Human-readable description of the active filter, shown as a dismissible chip. */
  filterLabel?: string;
}

/**
 * Type-safe tab factory. Each tool declares its columns against its own record type;
 * the array is erased to `BaseRecord` for the shared engine, so render functions keep
 * their real types at the call site.
 */
export function defineTab<T extends BaseRecord>(
  def: Omit<LedgerTab, "columns" | "renderExtra" | "searchText"> & {
    columns: Column<T>[];
    renderExtra?: (rows: T[], helpers: { reload: () => Promise<void> }) => React.ReactNode;
    searchText?: (row: T) => string;
  },
): LedgerTab {
  return def as unknown as LedgerTab;
}

function TabPanel({
  toolId,
  tab,
  onClearFilter,
}: {
  toolId: ToolId;
  tab: LedgerTab;
  onClearFilter?: () => void;
}) {
  const { rows, loading, add, update, remove, reload } = useCollection<BaseRecord>(
    toolId,
    tab.collection,
  );
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BaseRecord | null>(null);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSubmit = async (values: FormValues) => {
    if (editing) await update(editing.id, values as Partial<BaseRecord>);
    else await add(values as Omit<BaseRecord, "id" | "createdAt" | "updatedAt">);
  };

  const singular = tab.label.replace(/ies$/, "y").replace(/s$/, "").toLowerCase();
  const visible = tab.filter ? rows.filter(tab.filter) : rows;

  return (
    <div className="flex flex-col gap-4">
      {tab.renderExtra?.(rows, { reload })}
      {tab.filterLabel ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-[var(--bg-subtle)]/60 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[12px] text-fg-muted">
            <AnimatedIcon name="filter" size={13} trigger="none" />
            Filtered to <span className="font-medium text-fg">{tab.filterLabel}</span>
          </span>
          <button
            type="button"
            onClick={onClearFilter}
            className="press inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] text-fg-muted hover:bg-[var(--surface-strong)] hover:text-fg"
          >
            Clear <AnimatedIcon name="close" size={12} trigger="click" />
          </button>
        </div>
      ) : null}
      <DataTable
        rows={visible}
        columns={tab.columns}
        loading={loading}
        searchText={tab.searchText}
        exportName={`gridhub-${toolId}-${tab.collection}`}
        emptyTitle={tab.emptyTitle}
        emptyDescription={tab.emptyDescription}
        pageSize={tab.pageSize ?? 12}
        onEdit={(row) => {
          setEditing(row);
          setFormOpen(true);
        }}
        onDelete={(row) => remove(row.id)}
        emptyAction={
          <Button variant="primary" size="sm" icon="plus" onClick={openNew}>
            {tab.addLabel ?? `Add ${singular}`}
          </Button>
        }
        toolbar={
          <Button variant="secondary" size="sm" icon="plus" onClick={openNew}>
            {tab.addLabel ?? "Add"}
          </Button>
        }
      />

      <RecordForm
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
        title={editing ? `Edit ${singular}` : (tab.addLabel ?? `New ${singular}`)}
        fields={tab.fields}
        initial={(editing as FormValues | null) ?? tab.defaults}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export interface LedgerToolProps {
  toolId: ToolId;
  tabs: LedgerTab[];
  metrics?: React.ReactNode;
  overview?: React.ReactNode;
  description?: string;
  notices?: React.ReactNode;
  onLoadSample?: () => Promise<void>;
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
  /** When provided, the tool opens on this tab (used by chart drill-down to reveal filtered rows). */
  defaultTab?: string;
  /** Called when the user dismisses an active tab filter chip. */
  onClearFilter?: () => void;
}

/**
 * The shared shell for every Gridhub application: identity header, metric strip,
 * optional overview, section tabs and a fully editable, exportable ledger.
 */
export function LedgerTool({
  toolId,
  tabs,
  metrics,
  overview,
  description,
  notices,
  onLoadSample,
  headerExtra,
  children,
  defaultTab,
  onClearFilter,
}: LedgerToolProps) {
  const tool = TOOL_MAP[toolId];
  const [active, setActive] = React.useState(defaultTab ?? tabs[0]?.id ?? "");
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  // Drill-down (e.g. clicking a month in a chart) asks to focus a specific tab.
  React.useEffect(() => {
    if (defaultTab) setActive(defaultTab);
  }, [defaultTab]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ToolIcon toolId={toolId} size={22} trigger="mount" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{tool.name}</h1>
              <Badge tone="neutral">{tool.collection}</Badge>
            </div>
            <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
              {description ?? tool.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {headerExtra}
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Tool options">
                <AnimatedIcon name="more" size={16} trigger="click" />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem
                icon="download"
                onSelect={() =>
                  downloadFile(
                    `gridhub-${toolId}-export.json`,
                    JSON.stringify({ tool: toolId, exportedAt: new Date().toISOString() }, null, 2),
                    "application/json",
                  )
                }
              >
                Export workspace
              </DropdownItem>
              {onLoadSample ? (
                <DropdownItem icon="flask" onSelect={() => void onLoadSample()}>
                  Load sample data
                </DropdownItem>
              ) : null}
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      {notices}

      {metrics ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">{metrics}</div>
      ) : null}

      {overview}
      {children}

      {tabs.length > 1 && (
        <div className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium",
                active === t.id
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-fg-muted hover:bg-[var(--bg-subtle)] hover:text-fg",
              )}
            >
              {t.icon ? <AnimatedIcon name={t.icon} size={14} trigger="hover" /> : null}
              {t.label}
            </button>
          ))}
        </div>
      )}

      <Card className="p-3 sm:p-4">
        {activeTab ? (
          <TabPanel key={activeTab.id} toolId={toolId} tab={activeTab} onClearFilter={onClearFilter} />
        ) : null}
      </Card>
    </div>
  );
}

/** Compact panel used inside tool overviews. */
export function Panel({
  title,
  description,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {icon ? (
            <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg border border-line bg-[var(--bg-subtle)] text-fg-muted">
              <AnimatedIcon name={icon} size={14} trigger="hover" />
            </span>
          ) : null}
          <div>
            <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
            {description ? <p className="text-[12px] text-fg-muted">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
