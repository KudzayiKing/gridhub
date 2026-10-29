import type { Metadata } from "next";
import { HowItWorksContent } from "./how-it-works-content";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Gridhub works: choose tools, work in one dashboard, stay offline-first, and keep your data portable.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return <HowItWorksContent />;
}
