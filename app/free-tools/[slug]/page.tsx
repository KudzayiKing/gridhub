import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/shell";
import { FreeCalculator } from "@/components/free-tools/calculator";
import { FREE_TOOLS, getFreeTool, type FreeToolId } from "@/lib/free-tool-catalog";

const seoTitles: Record<FreeToolId, string> = {
  "debt-payoff-calculator": "Free Debt Payoff Calculator — Snowball vs Avalanche | GridHub",
  "monthly-budget-calculator": "Free Monthly Budget Calculator | GridHub",
  "rental-property-calculator": "Rental Property Cash Flow Calculator | GridHub",
  "savings-goal-calculator": "Free Savings Goal Calculator | GridHub",
  "profit-margin-calculator": "Free Profit Margin & Markup Calculator | GridHub",
  "invoice-total-calculator": "Free Invoice Total Calculator | GridHub",
};

export function generateStaticParams() {
  return FREE_TOOLS.map((tool) => ({ slug: tool.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getFreeTool(slug);
  if (!tool) return { title: "Calculator not found" };
  const canonical = `https://gridhub.online/free-tools/${tool.id}`;
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
  return <MarketingShell><FreeCalculator id={tool.id} /></MarketingShell>;
}
