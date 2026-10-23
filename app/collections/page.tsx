import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Badge } from "@/components/ui/card";
import { ToolIcon } from "@/components/icons/tool-icons";
import { COLLECTIONS, toolsByCollection } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Collections",
  description: "Four Gridhub collections: Money, Business, Life and Work.",
  alternates: { canonical: "/collections" },
};

export default function CollectionsPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Collections"
        title="Four collections. Sixteen tools."
        description="Collections group tools that share the same real-world records, so you enter data once and every related view stays accurate."
      />

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 sm:grid-cols-2">
        {COLLECTIONS.map((c) => (
          <Link
            key={c.id}
            href={`/collections/${c.id}`}
            className="gp-card lift glass-sheen flex flex-col gap-3 p-5"
            style={{ borderTop: `3px solid ${c.accent}` }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{c.label}</h2>
              <Badge tone="neutral">{toolsByCollection(c.id).length} tools</Badge>
            </div>
            <p className="text-[12.5px] leading-relaxed text-fg-muted">{c.blurb}</p>
            <div className="flex flex-wrap gap-1.5">
              {toolsByCollection(c.id).map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-fg-muted">
                  <ToolIcon toolId={t.id} size={10} tinted={false} trigger="none" />
                  {t.shortName}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
