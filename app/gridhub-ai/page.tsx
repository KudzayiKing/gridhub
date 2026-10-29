import type { Metadata } from "next";
import { GridhubAIContent } from "./gridhub-ai-content";

export const metadata: Metadata = {
  title: "GridHub AI",
  description:
    "GridHub AI: an on-device workspace assistant that finds the right tool, prepares the entry and asks before saving. In development — not yet available.",
  alternates: { canonical: "/gridhub-ai" },
};

export default function GridhubAIPage() {
  return <GridhubAIContent />;
}
