"use client";

import * as React from "react";
import { PLANS, annualSavings, annualSavingsAmount, type BillingInterval } from "@/lib/plans";
import { useActiveTools } from "@/lib/use-tools";
import { Button } from "@/components/ui/button";
import { Badge, Card, InlineAlert, SectionHeading } from "@/components/ui/card";
import { Segmented } from "@/components/ui/field";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EntitlementResponse {
  plan?: string;
  interval?: string;
  tools?: string[];
  status?: string;
  currentPeriodEnd?: string;
  configured?: boolean;
}

export default function BillingPage() {
  const { active } = useActiveTools();
  const [interval, setInterval] = React.useState<BillingInterval>("monthly");
  const [entitlement, setEntitlement] = React.useState<EntitlementResponse | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/entitlements")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setEntitlement(body))
      .catch(() => setEntitlement({ configured: false }));
  }, []);

  const startCheckout = async (plan: string) => {
    setBusy(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval, tools: active }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      // `location.assign` rather than assigning `location.href`: the latter is flagged as
      // mutating a non-writable value, and assign() is the documented way to navigate.
      if (body.url) window.location.assign(body.url);
      else toast.error(body.error ?? "Checkout is not configured yet.");
    } catch {
      toast.error("Could not reach the billing service.");
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body = (await res.json()) as { url?: string; error?: string };
      if (body.url) window.location.href = body.url;
      else toast.error(body.error ?? "The billing portal is not configured yet.");
    } catch {
      toast.error("Could not reach the billing service.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        eyebrow="Subscription"
        title="Billing"
        description="Choose the plan that fits the tools you actually use. Annual billing is charged upfront."
        action={
          <Segmented
            value={interval}
            onChange={setInterval}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annual", label: "Annual" },
            ]}
          />
        }
      />

      {entitlement && entitlement.configured === false ? (
        <InlineAlert tone="warning" title="Billing is not configured in this environment">
          Stripe keys and price IDs are missing, so checkout cannot complete. Everything else in the workspace works
          locally. See <code className="text-[12px]">docs/STRIPE_SETUP.md</code> to finish configuration.
        </InlineAlert>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Current plan</p>
            <p className="mt-0.5 text-lg font-semibold capitalize">{entitlement?.plan ?? "No active subscription"}</p>
            <p className="text-[12px] text-fg-muted">
              {entitlement?.currentPeriodEnd
                ? `Renews ${entitlement.currentPeriodEnd}`
                : "Local preview — no payment method on file."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={entitlement?.status === "active" ? "positive" : "neutral"}>
              {entitlement?.status ?? "local"}
            </Badge>
            <Button variant="secondary" size="sm" icon="billing" onClick={openPortal} disabled={busy === "portal"}>
              Manage billing
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PLANS.map((plan) => {
          const price = interval === "annual" ? plan.annual : plan.monthly;
          const isCurrent = entitlement?.plan === plan.id;
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
                  <p className="text-[11px] text-[var(--positive)]">
                    Save ${annualSavingsAmount(plan)} ({saving}%)
                  </p>
                ) : (
                  <p className="text-[11px] text-fg-subtle">{plan.blurb}</p>
                )}
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
                {plan.id === "free" ? (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    {isCurrent ? "Current plan" : "Included"}
                  </Button>
                ) : (
                  <Button
                    variant={plan.id === "plus" ? "primary" : "secondary"}
                    size="sm"
                    className="w-full"
                    onClick={() => void startCheckout(plan.id)}
                    disabled={busy === plan.id}
                  >
                    {isCurrent ? "Current plan" : busy === plan.id ? "Opening…" : "Choose"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h3 className="text-[13.5px] font-semibold">How tool selection works</h3>
        <ul className="mt-2 flex flex-col gap-1.5 text-[12px] leading-relaxed text-fg-muted">
          <li>· Single includes any one paid tool, Plus three, Pro six, Unlimited all sixteen.</li>
          <li>· Tool swaps are allowed once per billing cycle on Single, Plus and Pro. Upgrades take effect immediately.</li>
          <li>· If you deactivate a tool, its records are preserved and become read-only rather than being deleted.</li>
          <li>· Offline editing, data export and privacy protections are never paywalled.</li>
        </ul>
        <p className="mt-2 text-[11.5px] text-fg-subtle">
          You currently have {active.length} tool{active.length === 1 ? "" : "s"} activated.
        </p>
      </Card>
    </div>
  );
}
