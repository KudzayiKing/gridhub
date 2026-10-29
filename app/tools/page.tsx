import type { Metadata } from "next";
import { ToolsIndexContent } from "./tools-index-content";

export const metadata: Metadata = {
  title: "All 16 tools",
  description:
    "Sixteen Gridhub applications for budgeting, debt, savings, net worth, bookkeeping, inventory, sales, invoicing, cash flow, weddings, rentals, nutrition, projects, habits and content planning.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndexPage() {
  return <ToolsIndexContent />;
}
