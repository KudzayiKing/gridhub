"use client";

import * as React from "react";
import Link from "next/link";
import { PLANS, annualSavings, annualSavingsAmount, type BillingInterval } from "@/lib/plans";
import { AI_PUBLIC_LABEL } from "@/lib/ai/status";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/field";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { cn } from "@/lib/utils";

export function PricingTable({ compact = false }: { compact?: boolean }) {
  const [interval, setInterval] = React.useState<BillingInterval>("monthly");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <Segmented
          value={interval}
          onChange={setInterval}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "annual", label: "Annual" },
          ]}
        />
      </div>

      <div className={cn("grid gap-3", compact ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5")}>
        {PLANS.map((plan) => {
          const price = interval === "annual" ? plan.annual : plan.monthly;
          const saving = annualSavings(plan);
          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col gap-3 p-4",
                plan.id === "plus" && "ring-1 ring-[var(--accent)]",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold">{plan.name}</h3>
                {plan.id === "plus" ? <Badge tone="accent">Popular</Badge> : null}
              </div>

              <div>
                <p className="tnum text-2xl font-semibold tracking-tight">
                  ${price}
                  <span className="text-[12px] font-normal text-fg-subtle">
                    {plan.monthly === 0 ? "" : interval === "annual" ? "/yr" : "/mo"}
                  </span>
                </p>
                {interval === "annual" && saving > 0 ? (
                  <p className="text-[11px] text-[var(--positive)]">Save ${annualSavingsAmount(plan)} · {saving}%</p>
                ) : (
                  <p className="text-[11px] text-fg-subtle">{plan.blurb}</p>
                )}
              </div>

              {/*
                GridHub AI is included on every plan, so this row is uniform. The status line is
                not decoration: the assistant has not been verified end to end, so the card must
                not read as though it is already switched on.
              */}
              <div className="flex flex-col gap-0.5 rounded-lg border border-line bg-[var(--bg-subtle)]/60 px-2 py-1.5">
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg">
                  <AnimatedIcon name="blocks" size={12} className="shrink-0 text-[var(--accent)]" trigger="none" />
                  GridHub AI included
                </span>
                <span className="pl-[18px] text-[10px] leading-snug text-fg-subtle">{AI_PUBLIC_LABEL}</span>
              </div>

              <ul className="flex flex-col gap-1 text-[11.5px] text-fg-muted">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-1.5">
                    <AnimatedIcon name="check" size={12} className="mt-0.5 text-[var(--accent)]" trigger="none" />
                    {h}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-1">
                <Button
                  variant={plan.id === "plus" ? "primary" : "secondary"}
                  size="sm"
                  className="w-full"
                  asChild
                >
                  <Link href="/login">{plan.id === "free" ? "Start free" : "Choose plan"}</Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-fg-subtle">
        Prices in USD. Annual plans are billed upfront. Cancel any time; your records stay exportable.
        GridHub AI is included on every plan and is still in development.
      </p>
    </div>
  );
}
