"use client";

import * as React from "react";
import { cn, toCSV, downloadFile } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { Button } from "@/components/ui/button";
import { Input, Select, Checkbox } from "@/components/ui/field";
import { EmptyState, LoadingRows } from "@/components/ui/card";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  ConfirmDialog,
} from "@/components/ui/overlay";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
  /** Value used for sorting and CSV export. */
  value?: (row: T) => string | number | null | undefined;
  defaultHidden?: boolean;
  /** Show this column in the mobile card summary. */
  primary?: boolean;
  width?: string;
}

export interface FilterDef<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
}

export interface DataTableProps<T extends { id: string }> {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchText?: (row: T) => string;
  filters?: FilterDef<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  canEdit?: (row: T) => boolean;
  canDelete?: (row: T) => boolean;
  deleteConfirmation?: { title: string; description: string; confirmLabel: string };
  onRowClick?: (row: T) => void;
  exportName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  toolbar?: React.ReactNode;
  pageSize?: number;
  /** Rendered instead of the built-in empty state. */
  emptyIcon?: string;
  dense?: boolean;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  loading,
  searchPlaceholder = "Search…",
  searchText,
  filters,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  deleteConfirmation,
  onRowClick,
  exportName,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Add your first record to get started.",
  emptyAction,
  toolbar,
  pageSize = 12,
  emptyIcon = "inbox",
  dense,
}: DataTableProps<T>) {
  const { t } = useI18n();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [filterState, setFilterState] = React.useState<Record<string, string>>({});
  const [page, setPage] = React.useState(0);
  const [hidden, setHidden] = React.useState<string[]>(
    columns.filter((c) => c.defaultHidden).map((c) => c.key),
  );
  const [pendingDelete, setPendingDelete] = React.useState<T | null>(null);

  const visibleColumns = columns.filter((c) => !hidden.includes(c.key));
  const rowHasActions = (row: T) => Boolean(
    (onEdit && canEdit?.(row) !== false) || (onDelete && canDelete?.(row) !== false) || onRowClick,
  );

  const filtered = React.useMemo(() => {
    let out = rows;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((row) => {
        const haystack = searchText
          ? searchText(row).toLowerCase()
          : columns.map((c) => String(c.value?.(row) ?? "")).join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    for (const f of filters ?? []) {
      const v = filterState[f.key];
      if (v && v !== "all") out = out.filter((row) => f.match(row, v));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      out = [...out].sort((a, b) => {
        const av = col?.value?.(a);
        const bv = col?.value?.(b);
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, query, filters, filterState, sort, columns, searchText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  /*
   * Pagination is reset where the query changes, not in an effect. An effect that calls
   * setState forces a second render pass on every keystroke, and the page index is a
   * property of the current filter — so it belongs with the filter's own event handler.
   * Row-count changes (a delete shrinking the list) are handled by clamping `safePage`.
   */

  const handleExport = () => {
    const data = filtered.map((row) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) out[c.header] = c.value?.(row) ?? "";
      return out;
    });
    downloadFile(`${exportName ?? "gridhub-export"}.csv`, toCSV(data), "text/csv");
  };

  const activeFilters = Object.values(filterState).filter((v) => v && v !== "all").length;

  if (loading) return <LoadingRows rows={5} />;

  if (!rows.length) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <AnimatedIcon
            name="search"
            size={15}
            trigger="none"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="h-9 pl-9 text-[13px]"
            aria-label="Search records"
          />
        </div>

        {filters?.map((f) => (
          <Select
            key={f.key}
            value={filterState[f.key] ?? "all"}
            onChange={(e) => {
              setFilterState((s) => ({ ...s, [f.key]: e.target.value }));
              setPage(0);
            }}
            className="h-9 w-auto min-w-[120px] text-[13px]"
            aria-label={f.label}
          >
            <option value="all">{f.label}: All</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </Select>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          {toolbar}
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("Choose columns")}>
                <AnimatedIcon name="table" size={15} trigger="click" />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-fg-subtle">{t("Columns")}</p>
              {columns.map((c) => (
                <label
                  key={c.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--bg-subtle)]"
                >
                  <Checkbox
                    checked={!hidden.includes(c.key)}
                    onCheckedChange={(v) =>
                      setHidden((h) => (v ? h.filter((k) => k !== c.key) : [...h, c.key]))
                    }
                    aria-label={t(c.header)}
                  />
                  {t(c.header)}
                </label>
              ))}
            </DropdownContent>
          </Dropdown>
          {exportName ? (
            <Button variant="ghost" size="icon-sm" onClick={handleExport} aria-label={t("Export CSV")}>
              <AnimatedIcon name="download" size={15} trigger="click" />
            </Button>
          ) : null}
        </div>
      </div>

      {(activeFilters > 0 || query) && (
        <p className="text-xs text-fg-subtle">
          {filtered.length} / {rows.length} {t("records")}
          {query ? ` · ${t("matching")} “${query}”` : ""}
          {activeFilters > 0 ? ` · ${activeFilters} ${t("filters")}` : ""}
        </p>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
        <table className="w-full min-w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line bg-[var(--bg-subtle)]/70">
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  style={{ width: c.width }}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                  )}
                >
                  {c.value ? (
                    <button
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" },
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-fg"
                    >
                      {t(c.header)}
                      <AnimatedIcon
                        name={sort?.key === c.key ? (sort.dir === "asc" ? "arrowUp" : "arrowDown") : "chevronDown"}
                        size={11}
                        trigger="none"
                        className={cn("opacity-40", sort?.key === c.key && "opacity-90")}
                      />
                    </button>
                  ) : (
                    t(c.header)
                  )}
                </th>
              ))}
              {(onEdit || onDelete || onRowClick) && <th className="w-10 px-2" />}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-line last:border-0 transition-colors hover:bg-[var(--bg-subtle)]/60",
                  onRowClick && "cursor-pointer",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {visibleColumns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 text-fg",
                      dense ? "py-1.5" : "py-2.5",
                      c.align === "right" && "text-right tnum",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
                {rowHasActions(row) && (
                  <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <Dropdown>
                      <DropdownTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t("Row actions")}>
                          <AnimatedIcon name="more" size={15} trigger="click" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownContent>
                        {onEdit && canEdit?.(row) !== false ? (
                          <DropdownItem icon="edit" onSelect={() => onEdit(row)}>
                            Edit
                          </DropdownItem>
                        ) : null}
                        {onDelete && canDelete?.(row) !== false ? (
                          <>
                            <DropdownSeparator />
                            <DropdownItem icon="trash" danger onSelect={() => setPendingDelete(row)}>
                              Delete
                            </DropdownItem>
                          </>
                        ) : null}
                      </DropdownContent>
                    </Dropdown>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {paged.map((row) => {
          const primary = visibleColumns.find((c) => c.primary) ?? visibleColumns[0];
          const rest = visibleColumns.filter((c) => c !== primary).slice(0, 3);
          return (
            <div
              key={row.id}
              className="rounded-xl border border-line bg-[var(--surface-strong)] p-3"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-[13px] font-medium">{primary?.render(row)}</div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {onEdit && canEdit?.(row) !== false ? (
                    <Button variant="ghost" size="icon-sm" aria-label={t("Edit")} onClick={() => onEdit(row)}>
                      <AnimatedIcon name="edit" size={14} trigger="click" />
                    </Button>
                  ) : null}
                  {onDelete && canDelete?.(row) !== false ? (
                    <Button variant="ghost" size="icon-sm" aria-label={t("Delete")} onClick={() => setPendingDelete(row)}>
                      <AnimatedIcon name="trash" size={14} trigger="click" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-wide text-fg-subtle">{t(c.header)}</dt>
                    <dd className="truncate text-[12.5px] text-fg">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-fg-subtle">
            {t("Page {current} of {total}", { current: safePage + 1, total: pageCount })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              icon="chevronLeft"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              iconRight="chevronRight"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={deleteConfirmation?.title ?? "Delete this record?"}
        description={deleteConfirmation?.description ?? "It will be removed from your workspace and from the cloud on the next sync. Export first if you may need it."}
        confirmLabel={deleteConfirmation?.confirmLabel ?? "Delete"}
        onConfirm={() => {
          if (pendingDelete) onDelete?.(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
