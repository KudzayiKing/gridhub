import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/shell";
import { FreeCalculator } from "@/components/free-tools/calculator";
import { FREE_TOOLS, getFreeTool, type FreeToolId } from "@/lib/free-tool-catalog";
import { getSiteUrl } from "@/lib/site-url";
import { faqFor } from "@/lib/free-tool-faq";

const seoTitles: Record<FreeToolId, string> = {
  "debt-payoff-calculator": "Free Debt Payoff Calculator — Snowball vs Avalanche",
  "monthly-budget-calculator": "Free Monthly Budget Calculator",
  "rental-property-calculator": "Rental Property Cash Flow Calculator",
  "savings-goal-calculator": "Free Savings Goal Calculator",
  "profit-margin-calculator": "Free Profit Margin & Markup Calculator",
  "invoice-total-calculator": "Free Invoice Total Calculator",
};

export function generateStaticParams() {
  return FREE_TOOLS.map((tool) => ({ slug: tool.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getFreeTool(slug);
  if (!tool) return { title: "Calculator not found" };
  const canonical = `${getSiteUrl()}/free-tools/${tool.id}`;
  return {
    title: seoTitles[tool.id],
    description: tool.intro,
    keywords: [tool.title, "free calculator", "GridHub", tool.category],
    alternates: { canonical },
    openGraph: { type: "website", title: seoTitles[tool.id], description: tool.intro, url: canonical },
    twitter: { card: "summary_large_image", title: seoTitles[tool.id], description: tool.intro },
  };
}

export default async function FreeCalculatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getFreeTool(slug);
  if (!tool) notFound();
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}/free-tools/${tool.id}`;
  const questions = faqFor(tool.id).map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  }));
  const calculatorJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.title,
    url: canonical,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    description: tool.intro,
    isAccessibleForFree: true,
    featureList: [tool.description, tool.method],
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: { "@id": `${siteUrl}/#organization` },
  };
  const faqJsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions };
  return <MarketingShell><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorJsonLd).replace(/</g, "\\u003c") }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} /><FreeCalculator id={tool.id} /></MarketingShell>;
}
