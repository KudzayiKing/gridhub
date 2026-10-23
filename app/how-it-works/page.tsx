import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Card } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/icons/animated-icon";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Gridhub works: choose tools, work in one dashboard, stay offline-first, and keep your data portable.",
  alternates: { canonical: "/how-it-works" },
};

const STAGES = [
  {
    icon: "explore",
    title: "Choose your tools",
    body: "Pick from sixteen applications across four collections. Your subscription covers a number of tools; you decide which ones.",
    detail: "Free includes the Annual Budget Planner. Paid plans cover one, three, six or all sixteen tools.",
  },
  {
    icon: "dashboard",
    title: "One dashboard, assembled for you",
    body: "The home screen is built from the tools you activated — real metrics, real deadlines, real balances.",
    detail: "Widgets declare their currency, period and source. Tools you do not own never appear.",
  },
  {
    icon: "layers",
    title: "Enter data once",
    body: "Shared records connect related tools. A customer in Invoicing is the same customer in Sales; a transaction in your budget can fund a savings goal.",
    detail: "One record has one authoritative owner. Mirrored entries carry a source reference so nothing is double counted.",
  },
  {
    icon: "offline",
    title: "Keep working offline",
    body: "Every edit is written to this device first. A queued outbox syncs when connectivity returns.",
    detail: "Financial records are version-checked. Conflicts are surfaced, never silently overwritten.",
  },
  {
    icon: "download",
    title: "Take your data with you",
    body: "Export CSV or a full JSON archive at any time, including after cancelling.",
    detail: "Data portability is not a paywalled feature.",
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="How it works"
        title="A workspace that assembles itself."
        description="Gridhub is not a spreadsheet with sixteen tabs. Each tool has its own interface, and the platform keeps the shared records consistent between them."
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 pb-12">
        {STAGES.map((stage, i) => (
          <Card key={stage.title} className="flex gap-4 p-5">
            <div className="flex flex-col items-center">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-[var(--bg-subtle)]">
                <AnimatedIcon name={stage.icon} size={17} trigger="hover" />
              </span>
              {i < STAGES.length - 1 ? <span className="mt-1 h-full w-px bg-[var(--border)]" /> : null}
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">{stage.title}</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{stage.body}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-subtle">{stage.detail}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-12">
        <h2 className="text-xl font-semibold tracking-tight">What Gridhub deliberately does not do</h2>
        <ul className="mt-3 flex flex-col gap-2 text-[12.5px] leading-relaxed text-fg-muted">
          <li>· It does not invent market prices, nutrition values or benchmarks.</li>
          <li>· It does not present projections as guarantees.</li>
          <li>· It does not silently merge unrelated financial records.</li>
          <li>· It does not claim tax or accounting compliance — the books are a clearly defined cash-basis model.</li>
          <li>· It does not send your transaction descriptions or food diary to marketing analytics.</li>
        </ul>
        <p className="mt-3 text-[12px] text-fg-subtle">
          Read more in{" "}
          <Link href="/offline" className="underline decoration-line-strong underline-offset-2">
            Offline &amp; PWA
          </Link>{" "}
          or{" "}
          <Link href="/tools" className="underline decoration-line-strong underline-offset-2">
            browse the tools
          </Link>
          .
        </p>
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
