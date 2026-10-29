import type { Metadata } from "next";
import { FAQ_GROUPS } from "@/lib/marketing/faq";
import { FaqContent } from "./faq-content";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Gridhub tools, pricing, offline use and data ownership.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const questions = FAQ_GROUPS.flatMap((group) => group.items).map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  }));
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <FaqContent />
    </>
  );
}
