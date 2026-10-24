import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { FreeToolsDirectory } from "@/components/free-tools/calculator";
import { getSiteUrl } from "@/lib/site-url";

const canonical = `${getSiteUrl()}/free-tools`;

export const metadata: Metadata = {
  title: "Free Tools — Financial & Business Calculators",
  description: "Free calculators for budgets, debt, savings, business profits, invoices, and rental properties. Get clear answers in seconds. No signup required.",
  alternates: { canonical },
  openGraph: { type: "website", title: "GridHub Free Tools — Financial & Business Calculators", description: "Free calculators for budgets, debt, savings, business profits, invoices, and rental properties. No signup required.", url: canonical },
};

export default function FreeToolsPage() {
  return <MarketingShell><FreeToolsDirectory /></MarketingShell>;
}
