/**
 * Gridhub AI — entitlement enforcement.
 *
 * The AI is included in every plan, but it must never grant access to a tool the customer does not
 * have. Entitlements come from the server (`/api/entitlements`); local activation is only a
 * fallback for local-only mode.
 */

import { ALL_TOOL_IDS, isToolId, type ToolId } from "@/lib/catalog";
import { PLAN_MAP, type PlanId } from "@/lib/plans";

export interface EntitlementState {
  plan: PlanId;
  /** Tool ids the server says this account may use. */
  entitledTools: ToolId[];
  /** Tools activated on this device. */
  activeTools: ToolId[];
  /** False when Supabase is not configured (local-only mode). */
  configured: boolean;
}

export const LOCAL_ENTITLEMENT: EntitlementState = {
  plan: "free",
  entitledTools: ["budget"],
  activeTools: ["budget"],
  configured: false,
};

function sanitize(ids: unknown): ToolId[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is ToolId => typeof id === "string" && isToolId(id));
}

/**
 * The set of tools the customer may actually use. Server entitlement wins; the plan's tool limit is
 * a hard cap so a stale or over-broad grant cannot widen access. Free is always budget-only.
 */
export function entitledToolSet(state: EntitlementState): Set<ToolId> {
  if (!state.configured) {
    const local = sanitize(state.activeTools);
    return new Set(local.length ? local : ["budget"]);
  }

  if (state.plan === "free") return new Set<ToolId>(["budget"]);

  const limit = PLAN_MAP[state.plan]?.toolLimit ?? 0;
  const server = sanitize(state.entitledTools);
  const base = server.length ? server : sanitize(state.activeTools);
  return new Set(base.filter((id) => ALL_TOOL_IDS.includes(id)).slice(0, limit));
}

export function allowedToolIds(state: EntitlementState): ToolId[] {
  return [...entitledToolSet(state)];
}

export function canUseTool(toolId: ToolId, state: EntitlementState): boolean {
  return entitledToolSet(state).has(toolId);
}

export function permissionMessage(toolId: ToolId, state: EntitlementState): string {
  const planName = PLAN_MAP[state.plan]?.name ?? "your plan";
  return `Your ${planName} plan does not include that tool, so Gridhub AI can't change it. You can still use it manually if it is active.`;
}
