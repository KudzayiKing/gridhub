"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  Tooltip,
} from "@/components/ui/overlay";
import { useSyncState } from "@/components/providers";
import { runSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

const PHASE_COPY = {
  local: { label: "Saved on this device", icon: "offline", tone: "text-fg-subtle" },
  offline: { label: "Offline — saved locally", icon: "offline", tone: "text-[var(--warning)]" },
  pending: { label: "Waiting to sync", icon: "sync", tone: "text-[var(--warning)]" },
  syncing: { label: "Synchronizing…", icon: "sync", tone: "text-fg-muted" },
  synced: { label: "Up to date", icon: "online", tone: "text-[var(--positive)]" },
  error: { label: "Sync failed", icon: "alert", tone: "text-[var(--negative)]" },
} as const;

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const sync = useSyncState();
  const copy = PHASE_COPY[sync.phase];

  return (
    <Tooltip content={sync.message ?? copy.label}>
      <button
        onClick={() => void runSync()}
        className={cn(
          "press inline-flex items-center gap-1.5 rounded-full border border-line bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-medium",
          copy.tone,
        )}
        aria-label={`Sync status: ${copy.label}. Click to sync now.`}
      >
        <AnimatedIcon name={copy.icon} size={13} trigger="click" />
        {!compact ? <span className="hidden sm:inline">{copy.label}</span> : null}
        {sync.pending > 0 ? (
          <span className="tnum rounded-full bg-[var(--bg-subtle)] px-1.5 text-[10px] text-fg-muted">
            {sync.pending}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

/**
 * "Has the client taken over yet?" without an effect.
 *
 * The usual `useEffect(() => setMounted(true), [])` pattern triggers the
 * `set-state-in-effect` rule and costs an extra render pass. `useSyncExternalStore`
 * expresses the same thing declaratively: the server snapshot is `false`, the client
 * snapshot is `true`, so the first client render flips it with no state write.
 */
function useIsClient(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useIsClient();

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change theme">
          <AnimatedIcon
            name={mounted && resolvedTheme === "dark" ? "moon" : "sun"}
            size={16}
            trigger="click"
          />
        </Button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem icon="sun" onSelect={() => setTheme("light")}>
          Light {theme === "light" ? "✓" : ""}
        </DropdownItem>
        <DropdownItem icon="moon" onSelect={() => setTheme("dark")}>
          Dark {theme === "dark" ? "✓" : ""}
        </DropdownItem>
        <DropdownItem icon="monitor" onSelect={() => setTheme("system")}>
          System {theme === "system" ? "✓" : ""}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
