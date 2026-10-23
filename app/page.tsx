import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { PricingTable } from "@/components/marketing/pricing-table";
import { GridhubAISection } from "@/components/marketing/ai-section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { ToolIcon } from "@/components/icons/tool-icons";
import { COLLECTIONS, TOOLS, toolsByCollection } from "@/lib/catalog";
import { AI_FAQ } from "@/lib/marketing/ai-faq";
import { formatMoney } from "@/lib/money";

const FEATURED = ["budget", "invoicing", "projects", "nutrition", "wedding", "debt"] as const;

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="relative mx-auto max-w-6xl px-4 pb-10 pt-10 sm:pt-16">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="eyebrow">16 tools. One beautiful workspace.</p>
            <h1 className="display-xl mt-3 text-[44px] leading-[0.95] sm:text-[64px]">
              One hub.
              <br />
              Everything organized<span className="text-[var(--accent)]">.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-fg-muted">
              Your money. Your business. Your life. Your work. One intelligent workspace.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" iconRight="arrowRight" asChild>
                <Link href="/tools">Explore tools</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/login">Get started</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-fg-subtle">
              <span className="inline-flex items-center gap-1.5">
                <AnimatedIcon name="offline" size={13} trigger="none" /> Works offline
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AnimatedIcon name="download" size={13} trigger="none" /> Export any time
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AnimatedIcon name="lock" size={13} trigger="none" /> Private by default
              </span>
              {/* Additive only: a fourth chip in the existing wrap row. No layout or copy change
                  above it, and it states the honest status rather than implying the AI is live. */}
              <span className="inline-flex items-center gap-1.5">
                <AnimatedIcon name="blocks" size={13} trigger="none" /> GridHub AI · in development
              </span>
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>

      <GridhubAISection />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Four collections</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Organized the way life actually is.</h2>
          </div>
          <Link href="/collections" className="text-[12.5px] font-medium text-fg-muted underline decoration-line-strong underline-offset-4 hover:text-fg">
            Browse collections
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className="gp-card lift glass-sheen flex flex-col gap-2 p-4"
              style={{ borderTop: `2px solid ${c.accent}` }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[13.5px] font-semibold">{c.name}</p>
                <Badge tone="neutral">{toolsByCollection(c.id).length}</Badge>
              </div>
              <p className="text-[11.5px] leading-relaxed text-fg-muted">{c.blurb}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {toolsByCollection(c.id).slice(0, 3).map((t) => (
                  <span key={t.id} className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-fg-subtle">
                    {t.shortName}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Featured applications</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Purpose-built, not a spreadsheet.</h2>
          </div>
          <Link href="/tools" className="text-[12.5px] font-medium text-fg-muted underline decoration-line-strong underline-offset-4 hover:text-fg">
            All 16 tools
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED.map((id) => {
            const tool = TOOLS.find((t) => t.id === id)!;
            return (
              <Link key={id} href={`/tools/${tool.slug}`} className="gp-card lift glass-sheen flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between">
                  <ToolIcon toolId={tool.id} size={19} trigger="hover" />
                  <Badge tone="neutral">{tool.collection}</Badge>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold leading-tight">{tool.name}</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">{tool.description}</p>
                </div>
                <ul className="mt-auto flex flex-col gap-1">
                  {tool.features.slice(0, 2).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[11.5px] text-fg-muted">
                      <AnimatedIcon name="check" size={11} className="mt-0.5 text-[var(--accent)]" trigger="none" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="gp-card glass-sheen overflow-hidden p-6 sm:p-8">
          <p className="eyebrow">How Gridhub works</p>
          <h2 className="mt-1 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Three steps. No formulas. No setup marathon.
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {[
              { icon: "explore", title: "Choose your tools", body: "Pick from sixteen applications. Your workspace only shows what you actually use." },
              { icon: "dashboard", title: "One dashboard", body: "Metrics, bills, deadlines and progress from every active tool, in one place." },
              { icon: "offline", title: "Work anywhere", body: "Install it, go offline, keep working. Changes sync when you are back online." },
            ].map((step, i) => (
              <div key={step.title}>
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-[var(--bg-subtle)]">
                    <AnimatedIcon name={step.icon} size={15} trigger="hover" />
                  </span>
                  <span className="tnum text-[11px] text-fg-subtle">0{i + 1}</span>
                </div>
                <h3 className="mt-2.5 text-[13.5px] font-semibold">{step.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">The unified dashboard</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Not a grid of product cards. A command center.
            </h2>
            <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-fg-muted">
              Gridhub assembles your home screen from the tools you own. Enter a bill once and it appears in your
              budget, your cash-flow forecast and your dashboard. No duplicate entry, no double counting.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {[
                "Only your tools appear — no empty widgets for apps you do not own",
                "Financial metrics declare their currency, period and source",
                "Empty states explain the next action instead of inventing numbers",
                "Widgets can be pinned, reordered and hidden",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12.5px] text-fg-muted">
                  <AnimatedIcon name="check" size={13} className="mt-0.5 text-[var(--accent)]" trigger="none" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="gp-card glass-sheen grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Offline-first PWA</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Install once. Work anywhere.</h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-fg-muted">
              Gridhub saves every change to this device first, then syncs. Flights, bad signal, a dead router — your
              work continues. Sync status is always visible and never claims something uploaded when it did not.
            </p>
            <Button variant="secondary" size="md" className="mt-4" iconRight="arrowRight" asChild>
              <Link href="/offline">How offline works</Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: "offline", title: "Saved locally", body: "Every edit persists to IndexedDB before the UI confirms." },
              { icon: "sync", title: "Safe sync", body: "A queued outbox retries with idempotent mutation ids." },
              { icon: "shield", title: "Conflict aware", body: "Financial records are version-checked, never silently overwritten." },
              { icon: "lock", title: "Grace period", body: "Seven days of signed offline entitlement after your last check-in." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-[var(--bg-subtle)]/50 p-3">
                <AnimatedIcon name={f.icon} size={16} className="text-fg-muted" trigger="hover" />
                <p className="mt-1.5 text-[12.5px] font-medium">{f.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12" id="pricing">
        <div className="text-center">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pay for the tools you use.</h2>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-fg-muted">
            One free tool forever. Paid plans start at $3/month. Annual billing saves up to 19%.
          </p>
        </div>
        <div className="mt-6">
          <PricingTable compact />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12">
        <p className="eyebrow text-center">Questions</p>
        <h2 className="mt-1 text-center text-2xl font-semibold tracking-tight sm:text-3xl">Good to know</h2>
        <div className="mt-5 flex flex-col divide-y divide-[var(--border)]">
          {[
            {
              q: "Do I have to choose tools before paying?",
              a: "Yes — you pick the tools you need, and we recommend the least expensive plan that covers them. Nothing is charged until you confirm at checkout.",
            },
            {
              q: "What happens to my data if I cancel?",
              a: "Nothing is deleted. Your records stay exportable, and deactivated tools become read-only rather than disappearing.",
            },
            {
              q: "Does it really work offline?",
              a: "Yes. After first sign-in and one online load, the app, your records and your pending edits live on the device. Changes sync when connectivity returns.",
            },
            {
              q: "Can I use the same account on phone and laptop?",
              a: "Yes. Sign in with the same Google account and your workspace follows you, with a sync engine that resolves changes safely.",
            },
            {
              q: "Do you sell my financial data?",
              a: "No. Analytics are aggregate and privacy-conscious; transaction descriptions and nutrition details are never sent to marketing tools.",
            },
            // The three headline AI questions. The full set lives on /faq.
            ...AI_FAQ.slice(0, 3),
          ].map((item) => (
            <details key={item.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-medium">
                {item.q}
                <AnimatedIcon name="chevronDown" size={14} className="text-fg-subtle transition-transform group-open:rotate-180" trigger="none" />
              </summary>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="gp-card glass-sheen flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="eyebrow">Start today</p>
          <h2 className="display-xl text-3xl sm:text-4xl">One hub. Everything organized.</h2>
          <p className="max-w-md text-[13.5px] leading-relaxed text-fg-muted">
            Start with the free budget planner. Add tools as you need them. Export everything whenever you like.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button variant="primary" size="lg" iconRight="arrowRight" asChild>
              <Link href="/login">Create your workspace</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/tools">Browse the tools</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function HeroPreview() {
  return (
    <div className="relative">
      <div className="gp-card glass-sheen overflow-hidden p-3">
        <div className="flex items-center gap-1.5 pb-2.5">
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          <span className="ml-2 text-[10px] text-fg-subtle">gridhub.online / app</span>
          <span className="ml-auto rounded-full border border-line px-1.5 py-0.5 text-[9px] text-fg-subtle">Example</span>
        </div>

        <div className="grid grid-cols-[76px_1fr] gap-2">
          <div className="flex flex-col gap-1 rounded-lg border border-line bg-[var(--bg-subtle)]/50 p-1.5">
            {["dashboard", "wallet", "kanban", "piggy-bank", "utensils"].map((icon, i) => (
              <span
                key={icon}
                className="flex items-center gap-1 rounded-md px-1 py-1 text-[8px]"
                style={{ background: i === 0 ? "var(--accent-soft)" : "transparent" }}
              >
                <AnimatedIcon name={icon} size={9} trigger="none" />
                <span className="truncate text-fg-subtle">{["Home", "Budget", "Tasks", "Savings", "Food"][i]}</span>
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { l: "Net", v: formatMoney(2140, { currency: "USD", maximumFractionDigits: 0 }) },
                { l: "Saved", v: formatMoney(8600, { currency: "USD", maximumFractionDigits: 0 }) },
                { l: "Open", v: "4" },
              ].map((m) => (
                <div key={m.l} className="rounded-lg border border-line bg-[var(--surface-strong)] p-1.5">
                  <p className="text-[7.5px] uppercase tracking-wide text-fg-subtle">{m.l}</p>
                  <p className="tnum text-[11px] font-semibold">{m.v}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-line bg-[var(--surface-strong)] p-2">
              <div className="flex items-center justify-between">
                <p className="text-[8.5px] font-medium">Spending trend</p>
                <span className="text-[7px] text-fg-subtle">Sample</span>
              </div>
              <svg viewBox="0 0 200 46" className="mt-1 w-full" aria-hidden="true">
                <defs>
                  <linearGradient id="hero-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,34 L25,28 L50,31 L75,22 L100,26 L125,16 L150,20 L175,11 L200,14 L200,46 L0,46 Z" fill="url(#hero-grad)" />
                <path d="M0,34 L25,28 L50,31 L75,22 L100,26 L125,16 L150,20 L175,11 L200,14" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
              </svg>
            </div>

            <div className="rounded-lg border border-line bg-[var(--surface-strong)] p-2">
              <p className="text-[8.5px] font-medium">Needs attention</p>
              <div className="mt-1 flex flex-col gap-1">
                {[
                  { t: "Rent due in 3 days", c: "var(--warning)" },
                  { t: "Invoice INV-0042 overdue", c: "var(--negative)" },
                ].map((row) => (
                  <div key={row.t} className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full" style={{ background: row.c }} />
                    <span className="text-[7.5px] text-fg-muted">{row.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-fg-subtle">
        Illustrative interface with sample data — not your records.
      </p>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="gp-card glass-sheen p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium">Example dashboard</p>
        <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] text-fg-subtle">Sample data</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { label: "Budget remaining", value: formatMoney(412, { currency: "USD", maximumFractionDigits: 0 }), tone: "var(--fg)" },
          { label: "Tasks overdue", value: "2", tone: "var(--warning)" },
          { label: "Invoices outstanding", value: formatMoney(1250, { currency: "USD", maximumFractionDigits: 0 }), tone: "var(--fg)" },
          { label: "Habits today", value: "3/4", tone: "var(--positive)" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-line bg-[var(--bg-subtle)]/50 p-2.5">
            <p className="text-[9px] uppercase tracking-wide text-fg-subtle">{m.label}</p>
            <p className="tnum mt-0.5 text-[15px] font-semibold" style={{ color: m.tone }}>{m.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-xl border border-line p-2.5">
        <p className="text-[9px] uppercase tracking-wide text-fg-subtle">Quick actions</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {["Add expense", "Add task", "Log meal"].map((a) => (
            <span key={a} className="rounded-full border border-line bg-[var(--surface-strong)] px-2 py-0.5 text-[9px] text-fg-muted">
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
