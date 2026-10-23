import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Small server-rendered metric tile for admin pages. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-subtle">{hint}</p> : null}
    </Card>
  );
}

/**
 * Minimal server-rendered table. Deliberately not the client `DataTable`: admin views are
 * read-only listings, and keeping them on the server avoids shipping a second interactive
 * table engine plus its state to a page only operators ever load.
 */
export function AdminTable({
  head,
  rows,
  empty,
  caption,
}: {
  head: string[];
  rows: ReactNode[][];
  empty: string;
  caption?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-center text-[13px] text-fg-muted">{empty}</p>;
  }

  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-2 align-top text-fg">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function mono(value: string) {
  return <span className="font-mono text-[11.5px] text-fg-muted">{value}</span>;
}

export function when(iso: string | null | undefined) {
  if (!iso) return <span className="text-fg-subtle">—</span>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <span className="text-fg-subtle">—</span>;
  return (
    <span className="whitespace-nowrap text-fg-muted">
      {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
    </span>
  );
}
