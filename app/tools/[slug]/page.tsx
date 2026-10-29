import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, toolBySlug } from "@/lib/catalog";
import { PLANS } from "@/lib/plans";
import { getSiteUrl } from "@/lib/site-url";
import { ToolDetailContent } from "./tool-detail-content";

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
      ...(tool.freeTier
        ? [
            {
              "@type": "Offer",
              name: "Free starter plan",
              price: "0",
              priceCurrency: "USD",
              url: `${siteUrl}/pricing`,
            },
          ]
        : []),
      ...PLANS.filter((plan) => plan.id !== "free").flatMap((plan) => [
        {
          "@type": "Offer",
          name: `${plan.name} monthly plan`,
          description: `Access to ${plan.toolLimit === 16 ? "all 16 tools" : `any ${plan.toolLimit} paid ${plan.toolLimit === 1 ? "tool" : "tools"}`}.`,
          price: String(plan.monthly),
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: String(plan.monthly),
            priceCurrency: "USD",
            unitText: "month",
          },
          url: `${siteUrl}/pricing`,
        },
        {
          "@type": "Offer",
          name: `${plan.name} annual plan`,
          description: `Access to ${plan.toolLimit === 16 ? "all 16 tools" : `any ${plan.toolLimit} paid ${plan.toolLimit === 1 ? "tool" : "tools"}`}; billed annually.`,
          price: String(plan.annual),
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: String(plan.annual),
            priceCurrency: "USD",
            unitText: "year",
          },
          url: `${siteUrl}/pricing`,
        },
      ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ToolDetailContent slug={slug} />
    </>
  );
}
