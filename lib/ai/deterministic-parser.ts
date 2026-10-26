/**
 * Gridhub AI — deterministic command router.
 *
 * Navigation and a handful of exact read-only questions never need the model. Handling them here
 * cuts latency, saves battery, and keeps working even when no model is installed.
 */

import { TOOLS, type ToolId } from "@/lib/catalog";
import type { ActionId } from "./action-schemas";
import { normalizeName } from "./entity-resolver";

export interface DeterministicMatch {
  intent: "navigation" | "query" | "action";
  path?: string;
  actionId?: ActionId;
  parameters?: Record<string, unknown>;
}

const NAV_VERB =
  /^(?:please\s+)?(?:open|go\s+to|goto|show\s+me|show|navigate\s+to|take\s+me\s+to|launch|switch\s+to|bring\s+up)\s+(.+)$/;

interface NavTarget {
  path: string;
  aliases: string[];
}

const EXTRA_TARGETS: NavTarget[] = [
  { path: "/app/settings", aliases: ["settings", "account settings", "preferences"] },
  { path: "/app/billing", aliases: ["billing", "subscription", "plan", "upgrade"] },
  { path: "/app/explore", aliases: ["explore", "explore tools", "catalog", "all tools"] },
  { path: "/app/tools", aliases: ["my tools", "tools"] },
  { path: "/app", aliases: ["home", "dashboard", "overview", "workspace"] },
];

const TOOL_TARGETS: NavTarget[] = TOOLS.map((tool) => ({
  path: tool.route,
  aliases: [tool.shortName, tool.name, tool.id, tool.slug, ...tool.keywords].map(normalizeName),
}));

const TARGETS = [...TOOL_TARGETS, ...EXTRA_TARGETS];

/** Exact, unambiguous read-only questions. Anything fuzzier goes to the model. */
const QUERY_SHORTCUTS: Array<{ pattern: RegExp; actionId: ActionId }> = [
  {
    pattern: /\b(unpaid|outstanding|overdue)\b[^.]*\binvoices?\b|\binvoices?\b[^.]*\b(unpaid|outstanding|overdue)\b/,
    actionId: "invoicing.query_unpaid",
  },
  {
    pattern: /\b(low stock|running low|out of stock|reorder|restock)\b/,
    actionId: "inventory.query_low_stock",
  },
  {
    pattern: /\bcash[\s-]?(flow\s+)?forecast\b|\brunway\b/,
    actionId: "cash-flow.query_forecast",
  },
  {
    pattern: /\b(upcoming|due)\b[^.]*\b(deadlines?|tasks?)\b|\bwhat'?s due\b/,
    actionId: "projects.query_deadlines",
  },
];

function matchTarget(target: string): string | null {
  const t = normalizeName(target);
  if (!t) return null;

  let best: { path: string; score: number } | null = null;
  for (const entry of TARGETS) {
    for (const alias of entry.aliases) {
      if (!alias) continue;
      let score = 0;
      if (alias === t) score = 100;
      else if (t.startsWith(alias) || t.endsWith(alias)) score = 85;
      else if (t.includes(alias) || alias.includes(t)) score = 70;
      if (score > (best?.score ?? 0)) best = { path: entry.path, score };
    }
  }
  return best && best.score >= 70 ? best.path : null;
}

export function deterministicParse(input: string): DeterministicMatch | null {
  const text = input.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  // Conservative, typed fallback for a common expense entry. This intentionally accepts only a
  // small, explicit grammar; the normal permission checks and confirmation card still apply.
  const expense = text.match(
    /^(?:(?:please\s+)?(?:add|log|record|spent|spend)\s+)?(?:\$\s*)?([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?\s*)?(?:for|on|at|to)\s+(.+?)(?:\s+(?:today|yesterday))?[.!?]?$/i,
  );
  if (expense && /\b(add|log|record|spent|spend|expense|groceries|coffee|fuel|gas|lunch|dinner|parking|rent|electricity|internet|shopping)\b/i.test(text)) {
    const amount = Number(expense[1].replaceAll(",", ""));
    const description = expense[2].trim().replace(/[.!?]+$/, "");
    if (Number.isFinite(amount) && amount > 0 && description && description.length <= 140) {
      const date = /\byesterday\b/i.test(text) ? "yesterday" : undefined;
      return {
        intent: "action",
        actionId: "budget.create_expense",
        parameters: { amount, description, date },
      };
    }
  }

  for (const shortcut of QUERY_SHORTCUTS) {
    if (shortcut.pattern.test(lower)) {
      return { intent: "query", actionId: shortcut.actionId, parameters: {} };
    }
  }

  const nav = lower.match(NAV_VERB);
  if (nav) {
    const path = matchTarget(nav[1]);
    if (path) return { intent: "navigation", path };
  }

  // "budget" on its own is a navigation request, but only when it is a bare tool name.
  const bare = matchTarget(lower);
  if (bare && normalizeName(lower).split(" ").length <= 3) {
    return { intent: "navigation", path: bare };
  }

  return null;
}

export function toolIdForPath(path: string): ToolId | undefined {
  return TOOLS.find((t) => t.route === path)?.id;
}
