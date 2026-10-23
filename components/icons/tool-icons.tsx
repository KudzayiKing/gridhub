"use client";

import { TOOL_MAP, type ToolId } from "@/lib/catalog";
import { AnimatedIcon, type AnimatedIconTrigger } from "./animated-icon";
import { cn } from "@/lib/utils";

export const TOOL_ICON: Record<ToolId, string> = {
  budget: "wallet",
  paycheck: "calendar-days",
  debt: "trending-down",
  savings: "piggy-bank",
  "net-worth": "line-chart",
  bookkeeping: "book-open",
  inventory: "package",
  sales: "shopping-cart",
  invoicing: "file-text",
  "cash-flow": "waves",
  wedding: "heart",
  property: "home",
  nutrition: "utensils",
  projects: "kanban",
  habits: "circle-check",
  content: "calendar-range",
};

export function toolIconName(toolId: ToolId): string {
  return TOOL_ICON[toolId] ?? "blocks";
}

/** Tool icon with the collection accent tint. */
export function ToolIcon({
  toolId,
  size = 22,
  className,
  tinted = true,
  trigger = "hover",
}: {
  toolId: ToolId;
  size?: number;
  className?: string;
  tinted?: boolean;
  trigger?: AnimatedIconTrigger;
}) {
  const tool = TOOL_MAP[toolId];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        tinted && "border border-line",
        className,
      )}
      style={
        tinted
          ? {
              width: size * 1.9,
              height: size * 1.9,
              background: "var(--surface-strong)",
              color: "var(--fg)",
            }
          : undefined
      }
    >
      <AnimatedIcon name={toolIconName(toolId)} size={size} trigger={trigger} />
      <span className="sr-only">{tool?.name ?? toolId}</span>
    </span>
  );
}
