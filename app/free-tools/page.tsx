import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { FreeToolsDirectory } from "@/components/free-tools/calculator";

export const metadata: Metadata = {
  title: "GridHub Free Tools — Financial & Business Calculators",
  description: "Free calculators for budgets, debt, savings, business profits, invoices, and rental properties. Get clear answers in seconds. No signup required.",
  alternates: { canonical: "https://gridhub.online/free-tools" },
  openGraph: { type: "website", title: "GridHub Free Tools — Financial & Business Calculators", description: "Free calculators for budgets, debt, savings, business profits, invoices, and rental properties. No signup required.", url: "https://gridhub.online/free-tools" },
};

export default function FreeToolsPage() {
  return <MarketingShell><FreeToolsDirectory /></MarketingShell>;
}
