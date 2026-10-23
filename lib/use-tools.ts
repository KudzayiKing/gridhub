"use client";

import { ALL_TOOL_IDS, TOOLS, type ToolId } from "@/lib/catalog";
import { useMeta } from "@/lib/store";

/**
 * Tool activation is stored per device and, when signed in, reconciled with the
 * server entitlement. A tool is usable when it is activated AND entitled; the
 * entitlement check lives in `lib/entitlements.ts`.
 */
export function useActiveTools() {
  const [active, setActive, loading] = useMeta<ToolId[]>("activations", ALL_TOOL_IDS);

  return {
    active,
    loading,
    setActive: (ids: ToolId[]) => setActive(ids.filter((id) => ALL_TOOL_IDS.includes(id))),
    toggle: (id: ToolId) =>
      setActive(active.includes(id) ? active.filter((t) => t !== id) : [...active, id]),
    isActive: (id: ToolId) => active.includes(id),
    activeTools: TOOLS.filter((t) => active.includes(t.id)),
  };
}
