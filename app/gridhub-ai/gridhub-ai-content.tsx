"use client";

import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Badge, Card, InlineAlert } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { AI_PUBLIC_CAVEAT, AI_PUBLIC_LABEL, AI_PUBLIC_NOTE, AI_PUBLICLY_AVAILABLE } from "@/lib/ai/status";
import { AI_FAQ } from "@/lib/marketing/ai-faq";
import { useI18n } from "@/lib/i18n";

export function GridhubAIContent() {
  const { t } = useI18n();

  const capabilities = [
    {
      icon: "search" as const,
      title: t("Finds the right tool"),
      body: t(
        "You type “log two eggs for breakfast”; it works out that this is the nutrition diary and not the grocery budget.",
      ),
      detail: t(
        "It chooses from a fixed list of known actions, so it cannot invent a screen that does not exist.",
      ),
    },
    {
      icon: "edit" as const,
      title: t("Prepares the entry"),
      body: t(
        "Reads the amount, the category and the date out of your sentence, and fills those fields for you.",
      ),
      detail: t("Anything it cannot read stays empty and is left for you to complete."),
    },
    {
      icon: "table" as const,
      title: t("Answers from your records"),
      body: t(
        "Totals, balances, unpaid invoices and upcoming deadlines — read from the data already on your device.",
      ),
      detail: t(
        "Answers are calculated from your records, not generated prose that might be wrong.",
      ),
    },
    {
      icon: "shield" as const,
      title: t("Asks before writing"),
      body: t(
        "A write becomes a confirmation card listing exactly what will be saved. Nothing changes until you confirm.",
      ),
      detail: t("Cancel at that step and nothing is written — not even locally."),
    },
  ];

  const steps = [
    {
      icon: "edit" as const,
      title: t("You type a request"),
      body: t("Use everyday language, or add a record directly with Quick add."),
      detail: t("Typed requests use the on-device model; Quick add uses the tool's standard form."),
    },
    {
      icon: "target" as const,
      title: t("It maps the request to a known action"),
      body: t(
        "Your sentence is matched against the actions the app actually supports, across the sixteen tools.",
      ),
      detail: t(
        "Unrecognised requests are refused rather than guessed at. There is no open-ended code execution.",
      ),
    },
    {
      icon: "check" as const,
      title: t("You review the change"),
      body: t(
        "For anything that writes, you see the fields, the amount and the date before it is saved.",
      ),
      detail: t("Read-only questions skip this step and answer directly."),
    },
    {
      icon: "offline" as const,
      title: t("It saves locally, then syncs"),
      body: t("The record is written to this device first, like every other edit in GridHub."),
      detail: t(
        "It then syncs to your private workspace when you are online — the same sync engine, unchanged.",
      ),
    },
  ];

  const privacy = [
    {
      icon: "download" as const,
      title: t("Optional model download"),
      body: t("Nothing is downloaded until you choose to install the model."),
    },
    {
      icon: "lock" as const,
      title: t("Runs on your device"),
      body: t("Typed requests are processed in the browser, not by a cloud AI service."),
    },
    {
      icon: "offline" as const,
      title: t("Works offline after setup"),
      body: t("Once installed, supported commands do not need a connection."),
    },
    {
      icon: "gauge" as const,
      title: t("No metered AI credits"),
      body: t("Local inference has no per-command API cost, so there is nothing to meter."),
    },
  ];

  const limitations = [
    t("It does not write anything without a confirmation step you can cancel."),
    t("Voice input is not available yet; the current assistant accepts typed requests."),
    t("It does not invent actions. Requests outside the supported set are refused, not approximated."),
    t("It does not run on every device or browser; compatibility is checked before installation."),
    t(
      "It does not change how your records sync — the same sync engine still moves your data between devices.",
    ),
  ];

  const alertTitle = AI_PUBLICLY_AVAILABLE
    ? t("GridHub AI is available")
    : t("GridHub AI is in development");

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="GridHub AI"
        title="Less typing. More doing."
        description="An assistant that works inside your workspace: it finds the tool, prepares the entry and explains your numbers — then waits for you to confirm anything that writes."
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{t(AI_PUBLIC_LABEL)}</Badge>
          <span className="text-[12px] text-fg-subtle">
            {t("Included on every plan when it ships.")}
          </span>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-4xl px-4 pb-10">
        <InlineAlert tone="info" title={alertTitle}>
          {t(AI_PUBLIC_NOTE)}
        </InlineAlert>
      </div>

      <section className="mx-auto max-w-4xl px-4 pb-12">
        <h2 className="text-xl font-semibold tracking-tight">{t("What it does")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {capabilities.map((item) => (
            <Card key={item.title} className="p-4">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-[var(--bg-subtle)]">
                <AnimatedIcon name={item.icon} size={15} trigger="hover" />
              </span>
              <h3 className="mt-2.5 text-[14px] font-semibold">{item.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{item.body}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-subtle">{item.detail}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-12">
        <h2 className="text-xl font-semibold tracking-tight">{t("How a request runs")}</h2>
        <div className="mt-3 flex flex-col gap-3">
          {steps.map((step, i) => (
            <Card key={step.title} className="flex gap-4 p-5">
              <div className="flex flex-col items-center">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-[var(--bg-subtle)]">
                  <AnimatedIcon name={step.icon} size={17} trigger="hover" />
                </span>
                {i < steps.length - 1 ? (
                  <span className="mt-1 h-full w-px bg-[var(--border)]" />
                ) : null}
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold">{step.title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">{step.body}</p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-subtle">{step.detail}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-12">
        <h2 className="text-xl font-semibold tracking-tight">{t("Private by design")}</h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {privacy.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-line bg-[var(--bg-subtle)]/50 p-3"
            >
              <AnimatedIcon name={item.icon} size={16} className="text-fg-muted" trigger="hover" />
              <p className="mt-1.5 text-[12.5px] font-medium">{item.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-fg-subtle">{t(AI_PUBLIC_CAVEAT)}</p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("What it deliberately does not do")}
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-[12.5px] leading-relaxed text-fg-muted">
          {limitations.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-12">
        <h2 className="text-xl font-semibold tracking-tight">{t("Questions")}</h2>
        <div className="mt-2 flex flex-col divide-y divide-[var(--border)]">
          {AI_FAQ.map((item) => (
            <details key={item.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-medium">
                {t(item.q)}
                <AnimatedIcon
                  name="chevronDown"
                  size={14}
                  className="shrink-0 text-fg-subtle group-open:rotate-180"
                  trigger="none"
                />
              </summary>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{t(item.a)}</p>
            </details>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-fg-subtle">
          {t("More about how the workspace works in")}{" "}
          <Link href="/how-it-works" className="underline decoration-line-strong underline-offset-2">
            {t("How it works")}
          </Link>{" "}
          {t("and")}{" "}
          <Link href="/offline" className="underline decoration-line-strong underline-offset-2">
            {t("Offline & PWA")}
          </Link>
          .
        </p>
      </section>

      <CtaBand
        title="Start with the tools. AI comes next."
        body="Create a workspace now — GridHub AI will be included on your plan when it ships."
      />
    </MarketingShell>
  );
}
