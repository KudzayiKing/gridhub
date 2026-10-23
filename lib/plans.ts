/**
 * Subscription plans. Prices are launch prices in USD.
 * The server must resolve the Stripe price ID from this table — never from the browser.
 */

export type PlanId = "free" | "single" | "plus" | "pro" | "unlimited";
export type BillingInterval = "monthly" | "annual";

export interface PlanDef {
  id: PlanId;
  name: string;
  monthly: number;
  annual: number;
  /** Number of paid tools included. Infinity for unlimited. */
  toolLimit: number;
  blurb: string;
  highlights: string[];
  stripeEnv: Record<BillingInterval, string | null>;
  order: number;
}

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    annual: 0,
    toolLimit: 1,
    blurb: "One limited starter tool, forever free.",
    highlights: ["Annual Budget Planner (basic)", "Manual transactions", "Export your data"],
    stripeEnv: { monthly: null, annual: null },
    order: 0,
  },
  {
    id: "single",
    name: "Single",
    monthly: 3,
    annual: 29,
    toolLimit: 1,
    blurb: "Any one paid tool.",
    highlights: ["Any 1 paid tool", "Full reporting", "Offline editing"],
    stripeEnv: {
      monthly: "STRIPE_PRICE_SINGLE_MONTHLY",
      annual: "STRIPE_PRICE_SINGLE_ANNUAL",
    },
    order: 1,
  },
  {
    id: "plus",
    name: "Plus",
    monthly: 7,
    annual: 69,
    toolLimit: 3,
    blurb: "Any three paid tools.",
    highlights: ["Any 3 paid tools", "Unified dashboard", "Priority sync"],
    stripeEnv: {
      monthly: "STRIPE_PRICE_PLUS_MONTHLY",
      annual: "STRIPE_PRICE_PLUS_ANNUAL",
    },
    order: 2,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 11,
    annual: 109,
    toolLimit: 6,
    blurb: "Any six paid tools.",
    highlights: ["Any 6 paid tools", "Cross-tool insights", "Advanced exports"],
    stripeEnv: {
      monthly: "STRIPE_PRICE_PRO_MONTHLY",
      annual: "STRIPE_PRICE_PRO_ANNUAL",
    },
    order: 3,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    monthly: 15,
    annual: 149,
    toolLimit: 16,
    blurb: "All sixteen tools.",
    highlights: ["All 16 tools", "No tool-swap limits", "Everything included"],
    stripeEnv: {
      monthly: "STRIPE_PRICE_UNLIMITED_MONTHLY",
      annual: "STRIPE_PRICE_UNLIMITED_ANNUAL",
    },
    order: 4,
  },
];

export const PLAN_MAP: Record<PlanId, PlanDef> = Object.fromEntries(
  PLANS.map((p) => [p.id, p]),
) as Record<PlanId, PlanDef>;

export function isPlanId(v: string): v is PlanId {
  return PLANS.some((p) => p.id === v);
}

export function annualSavings(plan: PlanDef): number {
  const full = plan.monthly * 12;
  if (!full) return 0;
  return Math.round(((full - plan.annual) / full) * 100);
}

export function annualSavingsAmount(plan: PlanDef): number {
  return Math.max(0, plan.monthly * 12 - plan.annual);
}

/** Cheapest paid plan that covers a number of paid tools. */
export function recommendPlan(toolCount: number): PlanDef {
  const paid = PLANS.filter((p) => p.id !== "free" && p.toolLimit >= toolCount);
  return paid[0] ?? PLAN_MAP.unlimited;
}

/** All plans that would cover the selection, cheapest first. */
export function plansCovering(toolCount: number): PlanDef[] {
  return PLANS.filter((p) => p.id !== "free" && p.toolLimit >= toolCount);
}

export function planPrice(plan: PlanDef, interval: BillingInterval): number {
  return interval === "annual" ? plan.annual : plan.monthly;
}

export function priceLabel(plan: PlanDef, interval: BillingInterval): string {
  if (plan.monthly === 0) return "$0";
  return interval === "annual" ? `$${plan.annual}/yr` : `$${plan.monthly}/mo`;
}
