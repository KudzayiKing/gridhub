"use client";

import * as React from "react";
import Link from "next/link";
import { COLLECTIONS, TOOLS, TOOL_MAP, toolsByCollection, type CollectionId, type ToolId } from "@/lib/catalog";
import { useActiveTools } from "@/lib/use-tools";
import { ToolIcon } from "@/components/icons/tool-icons";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, SectionHeading } from "@/components/ui/card";
import { Segmented } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function ToolCatalog({ mode }: { mode: "mine" | "explore" }) {
  const { t } = useI18n();
  const { active, toggle, isActive, loading } = useActiveTools();
  const [filter, setFilter] = React.useState<CollectionId | "all">("all");
  const [query, setQuery] = React.useState("");

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((tool) => {
      if (mode === "mine" && !isActive(tool.id)) return false;
      if (filter !== "all" && tool.collection !== filter) return false;
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.tagline.toLowerCase().includes(q) ||
        tool.keywords.some((k) => k.includes(q))
      );
    });
  }, [mode, filter, query, isActive]);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        eyebrow={mode === "mine" ? "Your workspace" : "The catalog"}
        title={mode === "mine" ? "My tools" : "Explore tools"}
        description={
          mode === "mine"
            ? "Everything you have activated. Deactivate a tool to remove it from your dashboard — its records are preserved."
            : "Sixteen purpose-built applications. Activate the ones you need; the rest stay out of your way."
        }
        action={
          <div className="relative">
            <AnimatedIcon
              name="search"
              size={14}
              trigger="none"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools…"
              className="h-9 w-full rounded-full border border-line-strong bg-[var(--surface-strong)] pl-9 pr-3 text-[13px] sm:w-56"
              aria-label="Search tools"
            />
          </div>
        }
      />

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[{ value: "all" as const, label: "All" }, ...COLLECTIONS.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="shimmer h-40 rounded-[20px]" />
          ))}
        </div>
      ) : list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tool) => {
            const on = isActive(tool.id);
            return (
              <Card key={tool.id} className="lift flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <ToolIcon toolId={tool.id} size={20} trigger="hover" />
                  <Badge tone={on ? "accent" : "neutral"}>
                    {on ? "Active" : tool.freeTier ? "Free" : "Inactive"}
                  </Badge>
                </div>

                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold leading-tight">{t(tool.name)}</h3>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">{t(tool.description)}</p>
                </div>

                <ul className="flex flex-wrap gap-1">
                  {tool.benefits.slice(0, 3).map((b) => (
                    <li
                      key={b}
                      className="rounded-full border border-line bg-[var(--bg-subtle)]/60 px-2 py-0.5 text-[10.5px] text-fg-muted"
                    >
                      {t(b)}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-center gap-1.5 pt-1">
                  {on ? (
                    <>
                      <Button variant="primary" size="sm" icon="arrowRight" asChild>
                        <Link href={tool.route}>Open</Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggle(tool.id)}>
                        Deactivate
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" icon="plus" onClick={() => toggle(tool.id)}>
                      Activate
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : mode === "mine" ? (
        <EmptyState
          icon="grid"
          title="No tools activated"
          description="Pick the tools you need. You can change this at any time."
          action={
            <Button variant="primary" size="sm" icon="explore" asChild>
              <Link href="/app/explore">Browse the catalog</Link>
            </Button>
          }
        />
      ) : (
        <EmptyState icon="search" title="No tools match that search" description="Try a different word, or clear the filters." />
      )}

      {mode === "mine" ? (
        <Card className="p-4">
          <h3 className="text-[13.5px] font-semibold">Tool access</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">
            Activation here controls what appears in your workspace. Paid access is controlled separately by your
            subscription entitlement — see{" "}
            <Link href="/app/billing" className="underline decoration-line-strong underline-offset-2">
              Billing
            </Link>
            .
          </p>
        </Card>
      ) : null}
    </div>
  );
}
