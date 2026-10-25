import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { AI_FAQ } from "@/lib/marketing/ai-faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about Gridhub tools, pricing, offline use and data ownership.",
  alternates: { canonical: "/faq" },
};

const GROUPS = [
  {
    title: "Product",
    items: [
      { q: "What exactly do I get?", a: "A personal workspace plus the tools you choose. Each tool has its own dashboard, editable records, tables, search, filters, reporting and export." },
      { q: "Is it a spreadsheet?", a: "No. You never write formulas. Calculations are built into each tool and documented, and they use decimal-safe arithmetic." },
      { q: "Can I use more than one tool?", a: "Yes — that is the point. Plans cover 1, 3, 6 or all 16 tools, and related tools share records so you do not re-enter data." },
      { q: "Do tools share data?", a: "Where it is safe and meaningful: customers, products and business money movements are shared. Personal nutrition data is never linked to business records." },
    ],
  },
  {
    title: "GridHub AI",
    items: AI_FAQ,
  },
  {
    title: "Billing",
    items: [
      { q: "How much does it cost?", a: "Free for one limited starter tool. Single $3/mo or $29/yr, Plus $7/$69, Pro $11/$109, Unlimited $15/$149." },
      { q: "Can I switch plans?", a: "Yes. Upgrades take effect immediately; downgrades apply at the end of the period. Stripe handles proration." },
      { q: "What happens if I cancel?", a: "Access continues to the end of the paid period. Records are retained and remain exportable; tools become read-only rather than disappearing." },
    ],
  },
  {
    title: "Offline & data",
    items: [
      { q: "Does it work without internet?", a: "Yes, after one online sign-in and load. Records and pending edits are stored on the device, then synced." },
      { q: "Will I lose edits made offline?", a: "No. Edits queue in an outbox and retry. A mutation is only cleared after the server acknowledges it." },
      { q: "Can I export everything?", a: "Yes — CSV per table and a full JSON archive of your workspace. Export is available on every plan." },
      { q: "Where is my data stored?", a: "On your device first, then in your private Supabase workspace when you are signed in. Row-level security isolates your records." },
    ],
  },
];

export default function FaqPage() {
  const questions = GROUPS.flatMap((group) => group.items).map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  }));
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: questions };
  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader
        eyebrow="FAQ"
        title="Questions, answered plainly."
        description="If something here is unclear, tell us — we would rather fix the product than write a longer FAQ."
      />

      <div className="mx-auto max-w-3xl px-4 pb-12">
        {GROUPS.map((group) => (
          <section key={group.title} className="mb-8">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">{group.title}</h2>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {group.items.map((item) => (
                <details key={item.q} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-medium">
                    {item.q}
                    <AnimatedIcon name="chevronDown" size={14} className="shrink-0 text-fg-subtle group-open:rotate-180" trigger="none" />
                  </summary>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
