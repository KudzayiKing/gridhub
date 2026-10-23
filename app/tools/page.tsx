import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Badge } from "@/components/ui/card";
import { ToolIcon } from "@/components/icons/tool-icons";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { COLLECTIONS, toolsByCollection } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "All 16 tools",
  description:
    "Sixteen Gridhub applications for budgeting, debt, savings, net worth, bookkeeping, inventory, sales, invoicing, cash flow, weddings, rentals, nutrition, projects, habits and content planning.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndexPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="The catalog"
        title="Sixteen tools. One workspace."
        description="Every tool has its own purpose-built interface, real records, accurate calculations and offline support. Nothing is a renamed spreadsheet."
      />

      <div className="mx-auto max-w-6xl px-4 pb-10">
        {COLLECTIONS.map((collection) => (
          <section key={collection.id} className="mb-10">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold" style={{ color: collection.accent }}>
                  {collection.label}
                </h2>
                <p className="text-[12.5px] text-fg-muted">{collection.blurb}</p>
              </div>
              <Link
                href={`/collections/${collection.id}`}
                className="shrink-0 text-[12px] font-medium text-fg-muted underline decoration-line-strong underline-offset-4 hover:text-fg"
              >
                Collection
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {toolsByCollection(collection.id).map((tool) => (
                <Link
                  key={tool.id}
                  href={`/tools/${tool.slug}`}
                  className="gp-card lift glass-sheen flex flex-col gap-2.5 p-4"
                >
                  <div className="flex items-start justify-between">
                    <ToolIcon toolId={tool.id} size={18} trigger="hover" />
                    {tool.freeTier ? <Badge tone="accent">Free</Badge> : null}
                  </div>
                  <div>
                    <h3 className="text-[13.5px] font-semibold leading-tight">{tool.name}</h3>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">{tool.tagline}</p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-fg-muted">
                    See the tool
                    <AnimatedIcon name="arrowRight" size={12} trigger="none" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
