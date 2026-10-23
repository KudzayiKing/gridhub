"use client";

/**
 * Gridhub AI — confirmation card.
 *
 * The model's suggestion is rendered as a plain list of facts before anything is written. Nothing is
 * saved until the user presses Confirm, and the confirm button says what will happen.
 */

import * as React from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import type { PreparedAction } from "@/lib/ai/action-executor";

export function AIActionPreview({
  proposal,
  busy,
  onConfirm,
  onCancel,
}: {
  proposal: PreparedAction;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-[var(--surface-strong)]/80 p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* A shield, not a check: the check belongs to the Confirm button. This icon marks the
              card as the guard between the model's proposal and a real write. */}
          <AnimatedIcon name="shield" size={15} trigger="mount" className="text-[var(--brand)]" />
          <p className="truncate text-[13px] font-semibold text-fg">{proposal.label}</p>
        </div>
        <Badge tone="neutral">Needs confirmation</Badge>
      </div>

      <dl className="mb-3 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-line">
        {proposal.summary.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-3 px-2.5 py-1.5">
            <dt className="text-[11.5px] uppercase tracking-wide text-fg-subtle">{line.label}</dt>
            <dd className="min-w-0 truncate text-right text-[12.5px] font-medium text-fg">
              {line.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="sm" icon="close" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" icon="check" onClick={onConfirm} disabled={busy}>
          {busy ? "Saving…" : "Confirm"}
        </Button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">
        Saved on this device first. It syncs with your other devices when you are online.
      </p>
    </div>
  );
}
