import Link from "next/link";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { AI_PUBLIC_LABEL } from "@/lib/ai/status";

/*
 * The GridHub AI feature section on the homepage.
 *
 * Additive: it sits between the hero and the collections and reuses the existing visual grammar —
 * `gp-card glass-sheen`, the `eyebrow` label, the same type scale, AnimateIcons, and the browser-
 * chrome mock from the hero preview. Nothing about the surrounding sections changes.
 *
 * The mock is deliberately marked "Illustration" and built from spans, not buttons: it shows the
 * confirmation step the product actually implements, but it must never look like a live control
 * while the assistant is still in development.
 */

const EXAMPLES = [
  "Add $45 for groceries today.",
  "Show my unpaid invoices.",
  "How much did I spend last month?",
  "Log two eggs for breakfast.",
];

const CAPABILITIES = [
  {
    icon: "search",
    title: "Finds the right tool",
    body: "Names the app and the action for what you asked, instead of guessing which screen you meant.",
  },
  {
    icon: "edit",
    title: "Prepares the entry",
    body: "Fills the fields it can read from your sentence and leaves the ones it cannot.",
  },
  {
    icon: "table",
    title: "Answers from your records",
    body: "Reads totals, balances and deadlines from the data already on your device.",
  },
  {
    icon: "shield",
    title: "Asks before writing",
    body: "Every change appears as a confirmation card first. Nothing saves on its own.",
  },
];

export function GridhubAISection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12" id="ai">
      <div className="gp-card glass-sheen p-6 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Introducing GridHub AI</p>
              <Badge tone="neutral">{AI_PUBLIC_LABEL}</Badge>
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Less typing. More doing.
            </h2>
            <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-fg-muted">
              Tell GridHub what you need in everyday language. It finds the right tool, prepares the
              entry, and shows you exactly what will be saved before anything changes. Type it, tap
              it, or say it.
            </p>

            {/* items-start so each suggestion hugs its own text instead of stretching to the
                column width, which read as a list of rows rather than things you could say. */}
            <ul className="mt-4 flex flex-col items-start gap-1.5">
              {EXAMPLES.map((example) => (
                <li
                  key={example}
                  className="flex items-start gap-2 rounded-full border border-line bg-[var(--bg-subtle)]/50 px-2.5 py-1 text-[11.5px] text-fg-muted"
                >
                  <AnimatedIcon
                    name="arrowRight"
                    size={11}
                    className="mt-0.5 shrink-0 text-[var(--accent)]"
                    trigger="none"
                  />
                  <span className="truncate">“{example}”</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[12px] leading-relaxed text-fg-subtle">
              Your words. Your tools. Your control — important changes always wait for your
              confirmation.
            </p>

            <Button variant="secondary" size="md" className="mt-4" iconRight="arrowRight" asChild>
              <Link href="/gridhub-ai">How GridHub AI works</Link>
            </Button>
          </div>

          <AssistantPreview />
        </div>

        <div className="mt-7 grid gap-2.5 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((item) => (
            <div key={item.title} className="rounded-xl border border-line bg-[var(--bg-subtle)]/50 p-3">
              <AnimatedIcon name={item.icon} size={16} className="text-fg-muted" trigger="hover" />
              <p className="mt-1.5 text-[12.5px] font-medium">{item.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SUMMARY = [
  { label: "Amount", value: "$45.00" },
  { label: "Category", value: "Groceries" },
  { label: "Date", value: "Today" },
];

function AssistantPreview() {
  return (
    <div className="relative">
      <div className="gp-card glass-sheen overflow-hidden p-3">
        <div className="flex items-center gap-1.5 pb-2.5">
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />
          <span className="ml-2 text-[10px] text-fg-subtle">gridhub.online / app</span>
          <span className="ml-auto rounded-full border border-line px-1.5 py-0.5 text-[9px] text-fg-subtle">
            Illustration
          </span>
        </div>

        {/* Composer */}
        <div className="flex items-center gap-2 rounded-full border border-line bg-[var(--surface-strong)] px-2.5 py-1.5">
          <AnimatedIcon name="blocks" size={12} className="shrink-0 text-[var(--accent)]" trigger="none" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
            Add $45 for groceries today.
          </span>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
            <AnimatedIcon name="send" size={10} trigger="none" />
          </span>
        </div>

        {/* Confirmation card */}
        <div className="mt-2 rounded-xl border border-line bg-[var(--surface-strong)] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <AnimatedIcon name="shield" size={11} className="shrink-0 text-[var(--accent)]" trigger="none" />
              <span className="truncate text-[10.5px] font-semibold">Add expense</span>
            </span>
            <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[8.5px] text-fg-subtle">
              Needs confirmation
            </span>
          </div>

          <dl className="mt-1.5 divide-y divide-[var(--border)]">
            {SUMMARY.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 py-1">
                <dt className="text-[8.5px] uppercase tracking-wide text-fg-subtle">{row.label}</dt>
                <dd className="tnum truncate text-[10px] font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-2 flex justify-end gap-1.5">
            <span className="rounded-full border border-line px-2 py-0.5 text-[9px] text-fg-muted">
              Cancel
            </span>
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-medium text-[var(--accent-fg)]">
              Confirm
            </span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-fg-subtle">
        Illustrative interface with sample data — not a live assistant.
      </p>
    </div>
  );
}
