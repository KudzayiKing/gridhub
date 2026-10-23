import { Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { AdminTable } from "@/components/admin/admin-table";
import { tableRows, tableCount } from "@/lib/admin";

export const dynamic = "force-dynamic";

interface CatalogRow {
  id: string;
  name: string;
  collection: string;
  free_tier: boolean;
  visible: boolean;
  sort_order: number;
}

export default async function AdminToolsPage() {
  const catalog = await tableRows<CatalogRow>("tool_catalog", {
    limit: 100,
    orderBy: "sort_order",
    ascending: true,
  });

  // One exact count per tool. Sixteen head requests is cheaper than paging every
  // activation row into memory and is the only way to report a true figure.
  const counts = await Promise.all(
    catalog.rows.map((tool) =>
      tableCount("tool_activations", [
        { column: "tool_id", value: tool.id },
        { column: "active", value: true },
      ]),
    ),
  );

  return (
    <>
      <SectionHeading
        eyebrow="Catalog"
        title="Tools"
        description="The sixteen tools, their collection, and how many accounts currently have each one active."
      />

      {catalog.error ? (
        <InlineAlert tone="warning" title="Catalog could not be read">
          {catalog.error}. If the migration has not been applied, run{" "}
          <code className="font-mono text-[12px]">supabase db push</code> — the seeded
          catalog lives in <code className="font-mono text-[12px]">0001_init.sql</code>.
        </InlineAlert>
      ) : null}

      <Card className="p-4">
        <AdminTable
          head={["Tool", "Collection", "Free tier", "Visible", "Active accounts"]}
          caption="Tool catalog and activation counts"
          empty={
            catalog.error
              ? "Catalog unavailable."
              : "tool_catalog is empty. The migration seeds it; an empty table means the seed did not run."
          }
          rows={catalog.rows.map((tool, i) => {
            const c = counts[i];
            return [
              <span key="t" className="font-medium">{tool.name}</span>,
              <span key="c" className="capitalize text-fg-muted">{tool.collection}</span>,
              <span key="f" className={tool.free_tier ? "text-[var(--positive)]" : "text-fg-subtle"}>
                {tool.free_tier ? "Yes" : "No"}
              </span>,
              <span key="v" className="text-fg-muted">{tool.visible ? "Yes" : "Hidden"}</span>,
              <span key="n" className="tnum">
                {c.error ? `— (${c.error})` : (c.count ?? 0).toLocaleString("en-GB")}
              </span>,
            ];
          })}
        />
      </Card>

      <p className="text-[12px] leading-relaxed text-fg-subtle">
        Activation counts come from <code className="font-mono text-[12px]">tool_activations</code>{" "}
        with <code className="font-mono text-[12px]">active = true</code>. Users working in
        local-only mode have no server rows and therefore do not appear here.
      </p>
    </>
  );
}
