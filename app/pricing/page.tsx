import type { Metadata } from "next";
import { BILLING_FAQ } from "@/lib/marketing/faq";
import { PricingContent } from "./pricing-content";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "GridHub pricing in USD: Free; Single $3/month or $29/year; Plus $7/$69; Pro $11/$109; Unlimited $15/$149. Paid plans include 1, 3, 6, or all 16 tools.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: BILLING_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <PricingContent />
    </>
  );
}
