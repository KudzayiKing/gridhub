"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FREE_TOOLS } from "@/lib/free-tool-catalog";
import { Button } from "@/components/ui/button";
import { FREE_TOOL_DRAFT_KEY, getFreeToolDraftSnapshot, notifyFreeToolDraftChanged, subscribeFreeToolDraft } from "@/lib/free-tool-draft";

export function FreeToolDraftNotice({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const draftRaw = React.useSyncExternalStore(subscribeFreeToolDraft, getFreeToolDraftSnapshot, () => "");
  let draft: { tool: string; destination: string; expiresAt: number } | null = null;
  try {
    const value = JSON.parse(draftRaw) as { version?: number; tool?: string; destination?: string; expiresAt?: number };
    if (value.version === 1 && value.tool && value.destination && value.expiresAt) {
      draft = { tool: value.tool, destination: value.destination, expiresAt: value.expiresAt };
    }
  } catch { /* Invalid same-tab drafts are ignored. */ }

  const tool = draft ? FREE_TOOLS.find((item) => item.id === draft.tool) : undefined;
  const dismiss = () => {
    sessionStorage.removeItem(FREE_TOOL_DRAFT_KEY);
    notifyFreeToolDraftChanged();
  };

  return <>
    {tool && draft?.destination === pathname ? <aside className="mx-auto my-3 flex max-w-6xl flex-col gap-3 rounded-2xl border border-line bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between" aria-label="Calculator draft saved">
      <div><p className="text-sm font-semibold">Your {tool.title} draft is saved in this tab</p><p className="mt-0.5 text-xs text-fg-muted">It expires in 30 minutes. Nothing has been added to your GridHub records yet.</p></div>
      <div className="flex shrink-0 gap-2"><Button size="sm" variant="secondary" asChild><Link href={`/free-tools/${tool.id}`}>Review calculator</Link></Button><Button size="sm" variant="ghost" onClick={dismiss}>Dismiss</Button></div>
    </aside> : null}
    {children}
  </>;
}
