import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand, BackLink } from "@/components/marketing/page-parts";
import { ToolIcon } from "@/components/icons/tool-icons";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { COLLECTION_MAP, COLLECTIONS, toolsByCollection, type CollectionId } from "@/lib/catalog";

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const collection = COLLECTION_MAP[slug as CollectionId];
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.label,
    description: collection.blurb,
    alternates: { canonical: `/collections/${collection.id}` },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = COLLECTION_MAP[slug as CollectionId];
  if (!collection) notFound();

  const tools = toolsByCollection(collection.id);

  return (
    <MarketingShell>
      <PageHeader eyebrow="Collection" title={collection.label} description={collection.blurb} />

      <div className="mx-auto grid max-w-6xl gap-3 px-4 pb-12 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.id} href={`/tools/${tool.slug}`} className="gp-card lift glass-sheen flex flex-col gap-2.5 p-4">
            <ToolIcon toolId={tool.id} size={18} trigger="hover" />
            <h2 className="text-[13.5px] font-semibold leading-tight">{tool.name}</h2>
            <p className="text-[11.5px] leading-relaxed text-fg-muted">{tool.description}</p>
            <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[11.5px] font-medium text-fg-muted">
              Open details <AnimatedIcon name="arrowRight" size={12} trigger="none" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <BackLink href="/collections">All collections</BackLink>
      </div>

      <div className="mt-8">
        <CtaBand title={`${collection.name}, organized.`} />
      </div>
    </MarketingShell>
  );
}
