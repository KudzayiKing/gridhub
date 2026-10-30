"use client";

/**
 * Gridhub AI — the assistant panel.
 *
 * A bottom sheet on a phone and a floating panel on desktop. Every state is explicit: listening,
 * thinking, review, done, error. Nothing is written without the confirmation card, and the panel
 * always says whether the model is installed so "it didn't understand me" is never confused with
 * "it isn't installed".
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { AIActionPreview } from "./ai-action-preview";
import { QuickAddDialog } from "./quick-add-dialog";
import { useGridhubAI } from "./ai-provider";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function GridhubAIPanel() {
  const { ai, enabled } = useGridhubAI();
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  // Focus the composer when the panel opens in an idle state.
  React.useEffect(() => {
    if (!ai.open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [ai.open]);

  // Keep the newest content in view.
  React.useEffect(() => {
    if (!ai.open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [ai.open, ai.phase, ai.proposal, ai.query, ai.clarification, ai.result]);

  if (!enabled) return null;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void ai.submit();
  };

  return (
    <DialogPrimitive.Root
      open={ai.open}
      onOpenChange={(next) => (next ? ai.openPanel() : ai.closePanel())}
      modal={false}
    >
      <DialogPrimitive.Portal>
        {/*
          Mobile-only scrim: on a phone the sheet should feel modal. On desktop the panel is a
          floating companion and must not block the page behind it.
        */}
        <div
          className="fixed inset-0 z-40 bg-[rgba(0,0,0,0.4)] backdrop-blur-[2px] sm:hidden"
          aria-hidden="true"
          onClick={() => ai.closePanel()}
        />

        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            // Let the effect decide where focus goes; Radix's default jumps to the close button.
            event.preventDefault();
          }}
          className={cn(
            "glass-strong fixed z-50 flex flex-col overflow-hidden",
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[24px]",
            "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-h-[min(640px,82dvh)] sm:w-[420px] sm:rounded-[24px]",
            "shadow-[var(--shadow-lift)]",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--brand)] text-[#06231a]">
              {/* The brand's own tile motif rather than a generic "AI" glyph — the assistant is
                  part of the product, not a third-party feature bolted on. */}
              <AnimatedIcon name="blocks" size={15} trigger="mount" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[13.5px] font-semibold leading-tight text-fg">
                {t("Gridhub AI")}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[10.5px] leading-tight text-fg-subtle">
                {t("Text commands · works offline")}
              </DialogPrimitive.Description>
            </div>
            <Badge tone="positive">{t("Local commands")}</Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("Close Gridhub AI")}
              onClick={() => ai.closePanel()}
            >
              <AnimatedIcon name="close" size={15} trigger="click" />
            </Button>
          </div>

          {/* Scrollable body */}
          <div ref={listRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {ai.phase === "idle" ? (
              <div className="space-y-3">
                <p className="text-[12.5px] leading-relaxed text-fg-muted">
                  {t("Type a command in plain language. I can look up supported summaries and prepare changes for your review. Use Quick add for records outside the command list.")}
                </p>
                {ai.examples.length ? (
                  <div className="space-y-1.5">
                    <p className="eyebrow text-[10px]">{t("Try")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ai.examples.map((example) => (
                        <span
                          key={example}
                          className="rounded-full border border-line bg-[var(--surface-strong)] px-2.5 py-1 text-left text-[11.5px] text-fg-muted"
                        >
                          {t(example)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-fg-subtle">
                    {t("Activate a tool to see what I can do with it.")}
                  </p>
                )}
                {ai.history.length ? (
                  <div className="space-y-1">
                    <p className="eyebrow text-[10px]">{t("Recent")}</p>
                    <ul className="space-y-0.5">
                      {ai.history.slice(0, 3).map((entry) => (
                        <li key={entry.id} className="truncate text-[11.5px] text-fg-subtle">
                          <span className="text-fg-muted">{entry.text}</span> · {entry.outcome}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {ai.phase === "thinking" ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-[var(--surface-strong)]/70 px-3 py-3">
                <AnimatedIcon name="loader" size={16} trigger="mount" className="animate-spin text-[var(--brand)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-fg">{t("Working it out on this device")}</p>
                  <p className="text-[11px] text-fg-subtle">
                    {t("Nothing is being uploaded. This can take a moment on a phone.")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={ai.cancel}>
                  {t("Stop")}
                </Button>
              </div>
            ) : null}

            {ai.phase === "review" && ai.proposal ? (
              <AIActionPreview
                proposal={ai.proposal}
                busy={ai.busy}
                onConfirm={() => void ai.confirm()}
                onCancel={ai.discard}
              />
            ) : null}

            {ai.phase === "review" && ai.clarification ? (
              <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3">
                <p className="text-[12.5px] font-medium text-fg">{t(ai.clarification.question)}</p>
                {ai.clarification.options?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ai.clarification.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => void ai.choose(option)}
                        className="press rounded-full border border-line bg-[var(--surface)] px-2.5 py-1 text-[11.5px] text-fg hover:bg-[var(--surface-hover)]"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2.5 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={ai.discard}>
                    {t("Never mind")}
                  </Button>
                </div>
              </div>
            ) : null}

            {ai.phase === "done" && ai.query ? (
              <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3">
                <p className="mb-1.5 text-[13px] font-semibold text-fg">
                  {ai.query.title.includes(" · ")
                    ? `${t(ai.query.title.split(" · ")[0])} · ${ai.query.title.split(" · ").slice(1).join(" · ")}`
                    : t(ai.query.title)}
                </p>
                <ul className="space-y-1">
                  {ai.query.lines.map((line) => (
                    <li key={line} className="text-[12.5px] leading-relaxed text-fg-muted">
                      {line.includes(": ")
                        ? `${t(line.split(": ")[0])}: ${line.split(": ").slice(1).join(": ")}`
                        : t(line)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ai.phase === "done" && ai.result ? (
              <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 p-3">
                <div className="flex items-start gap-2">
                  <AnimatedIcon
                    name="check"
                    size={16}
                    trigger="mount"
                    className="mt-0.5 text-[var(--positive)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-fg">{t(ai.result.message)}</p>
                    <p className="mt-0.5 text-[11px] text-fg-subtle">
                      {t("Local · will sync when you're online")}
                    </p>
                  </div>
                  {ai.result.undo ? (
                    <Button variant="ghost" size="sm" icon="undo" onClick={() => void ai.undo()}>
                      {t("Undo")}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {ai.note ? (
              <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/70 px-3 py-2.5">
                <p className="text-[12.5px] leading-relaxed text-fg-muted">{t(ai.note)}</p>
              </div>
            ) : null}

            {ai.error ? (
              <div className="rounded-2xl border border-[var(--negative)]/30 bg-[var(--negative)]/5 px-3 py-2.5">
                <p className="text-[12.5px] leading-relaxed text-fg">{t(ai.error)}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                  {t("You can still type a simple command such as “Add $40 for groceries” or enter it in the tool directly. Any AI change still waits for your confirmation.")}
                </p>
                <div className="mt-1.5 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="refresh"
                  onClick={() => void ai.submit(ai.lastCommand)}
                  >
                    {t("Try again")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={ai.reset}>
                    {t("Dismiss")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="border-t border-line px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  ai.closePanel();
                  setQuickAddOpen(true);
                }}
                aria-label={t("Quick add")}
                title={t("Quick add")}
                className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-[var(--surface-strong)] text-fg-muted transition-colors hover:text-fg"
              >
                <AnimatedIcon name="plus" size={16} trigger="click" />
              </button>

              <Input
                ref={inputRef}
                value={ai.transcript}
                onChange={(event) => ai.setTranscript(event.target.value)}
                placeholder={t("Try: add salary 1000")}
                aria-label={t("Ask Gridhub AI")}
                className="h-9 flex-1"
                autoComplete="off"
                enterKeyHint="send"
              />

              <Button
                type="submit"
                size="icon"
                variant="primary"
                aria-label={t("Send")}
                disabled={ai.busy || !ai.transcript.trim()}
                className="h-9 w-9"
              >
                <AnimatedIcon name="send" size={15} trigger="click" />
              </Button>
            </div>

            <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-fg-subtle">
              {t("Runs on this device. Gridhub AI proposes changes; you confirm them.")}
            </p>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onAskAI={() => {
          setQuickAddOpen(false);
          ai.openPanel();
        }}
      />
    </DialogPrimitive.Root>
  );
}
