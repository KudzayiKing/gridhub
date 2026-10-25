import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand, BackLink } from "@/components/marketing/page-parts";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToolIcon } from "@/components/icons/tool-icons";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { COLLECTION_MAP, TOOLS, TOOL_MAP, toolBySlug, toolsByCollection } from "@/lib/catalog";
import { PLANS } from "@/lib/plans";
import { getSiteUrl } from "@/lib/site-url";

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) return { title: "Tool not found" };
  return {
    title: tool.name,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title: `${tool.name} · Gridhub`, description: tool.description },
  };
}

export default async function ToolDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();

  const collection = COLLECTION_MAP[tool.collection];
  const related = toolsByCollection(tool.collection).filter((t) => t.id !== tool.id).slice(0, 3);
  const siteUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${siteUrl}/tools/${tool.slug}#software`,
    name: tool.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android, macOS, Windows",
    description: tool.description,
    url: `${siteUrl}/tools/${tool.slug}`,
    provider: { "@id": `${siteUrl}/#organization` },
    offers: [
      ...(tool.freeTier ? [{ "@type": "Offer", name: "Free starter plan", price: "0", priceCurrency: "USD", url: `${siteUrl}/pricing` }] : []),
      ...PLANS.filter((plan) => plan.id !== "free").flatMap((plan) => [
        { "@type": "Offer", name: `${plan.name} monthly plan`, description: `Access to ${plan.toolLimit === 16 ? "all 16 tools" : `any ${plan.toolLimit} paid ${plan.toolLimit === 1 ? "tool" : "tools"}`}.`, price: String(plan.monthly), priceCurrency: "USD", priceSpecification: { "@type": "UnitPriceSpecification", price: String(plan.monthly), priceCurrency: "USD", unitText: "month" }, url: `${siteUrl}/pricing` },
        { "@type": "Offer", name: `${plan.name} annual plan`, description: `Access to ${plan.toolLimit === 16 ? "all 16 tools" : `any ${plan.toolLimit} paid ${plan.toolLimit === 1 ? "tool" : "tools"}`}; billed annually.`, price: String(plan.annual), priceCurrency: "USD", priceSpecification: { "@type": "UnitPriceSpecification", price: String(plan.annual), priceCurrency: "USD", unitText: "year" }, url: `${siteUrl}/pricing` },
      ]),
    ],
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader eyebrow={collection.label} title={tool.name} description={tool.description}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="md" iconRight="arrowRight" asChild>
            <Link href="/login">Start with this tool</Link>
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/pricing">See pricing</Link>
          </Button>
          {tool.freeTier ? <Badge tone="accent">Free forever</Badge> : null}
        </div>
      </PageHeader>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-12 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <ToolIcon toolId={tool.id} size={24} trigger="mount" />
            <div>
              <p className="text-[13px] font-medium">What you get</p>
              <p className="text-[11.5px] text-fg-subtle">{tool.tagline}</p>
            </div>
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {tool.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-2.5 text-[12px] text-fg-muted">
                <AnimatedIcon name="check" size={13} className="mt-0.5 text-[var(--accent)]" trigger="none" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <p className="text-[12.5px] font-medium">Designed for</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {tool.benefits.map((b) => (
                <li key={b} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-muted">
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-xl border border-line p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-medium">
              <AnimatedIcon name="offline" size={13} trigger="none" /> Works offline
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">
              Records are stored on your device first. Install Gridhub as an app and keep working without a
              connection; changes sync when you return online.
            </p>
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <p className="text-[12px] font-medium">How the numbers work</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">
              Calculations are decimal-safe and documented. Every metric states its currency, period and source, and
              empty tools show an explanation rather than invented figures.
            </p>
          </Card>

          {related.length ? (
            <Card className="p-4">
              <p className="text-[12px] font-medium">Also in {collection.name}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/tools/${r.slug}`}
                    className="press flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12px] hover:bg-[var(--bg-subtle)]"
                  >
                    <ToolIcon toolId={r.id} size={13} tinted={false} trigger="none" />
                    <span className="min-w-0 flex-1 truncate">{r.shortName}</span>
                    <AnimatedIcon name="chevronRight" size={12} className="text-fg-subtle" trigger="none" />
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <BackLink href="/tools">All tools</BackLink>
      </div>

      <div className="mt-8">
        <CtaBand
          title={`${TOOL_MAP[tool.id].shortName}, organized.`}
          body="Activate it in your workspace and start with your own records — no demo data required."
        />
      </div>
    </MarketingShell>
  );
}
