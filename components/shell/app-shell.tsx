"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { Splash } from "@/components/brand/splash";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { ToolIcon, toolIconName } from "@/components/icons/tool-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/overlay";
import { SyncIndicator, ThemeToggle } from "./sync-indicator";
import { GridhubAIFab } from "@/components/ai/ai-fab";
import { GridhubAIPanel } from "@/components/ai/ai-panel";
import { AppPrompts } from "@/components/pwa/app-prompts";
import { useGridhubAI } from "@/components/ai/ai-provider";
import { COLLECTIONS, TOOL_MAP, toolsByCollection, type ToolId } from "@/lib/catalog";
import { useActiveTools } from "@/lib/use-tools";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

const PRIMARY_NAV = [
  { href: "/app", label: "Overview", icon: "dashboard" },
  { href: "/app/tools", label: "My Tools", icon: "tools" },
  { href: "/app/explore", label: "Explore Tools", icon: "explore" },
];

const SECONDARY_NAV = [
  { href: "/app/billing", label: "Billing", icon: "billing" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

const MOBILE_NAV = [
  { href: "/app", label: "Home", icon: "dashboard" },
  { href: "/app/tools", label: "Tools", icon: "tools" },
  { href: "/app/explore", label: "Explore", icon: "explore" },
  { href: "/app/settings", label: "Account", icon: "user" },
];
const ADMIN_NAV_ITEM = { href: "/admin", label: "Admin", icon: "shield" };

function isCurrent(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon,
  active,
  onNavigate,
  indent,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  onNavigate?: () => void;
  indent?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "press group flex items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-medium",
        indent ? "py-1.5 pl-3" : "py-2",
        active
          ? "bg-[var(--accent-soft)] text-fg"
          : "text-fg-muted hover:bg-[var(--bg-subtle)] hover:text-fg",
      )}
    >
      <AnimatedIcon
        name={icon}
        size={indent ? 15 : 17}
        trigger="hover"
        className={cn(active ? "text-[var(--accent)]" : "text-fg-subtle group-hover:text-fg")}
      />
      <span className="truncate">{t(label)}</span>
      {active ? (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

export interface AppShellProps {
  children: React.ReactNode;
  buildVersion?: string;
  isAdmin?: boolean;
  user?: { email?: string | null; name?: string | null } | null;
  workspaceName?: string;
}

export function AppShell({ children, user, isAdmin = false, buildVersion = "local" }: AppShellProps) {
  const { t } = useI18n();
  const pathname = usePathname() || "/app";
  const router = useRouter();
  const { active } = useActiveTools();
  const { ai } = useGridhubAI();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [openCollections, setOpenCollections] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(COLLECTIONS.map((collection) => [collection.id, true])),
  );

  /*
   * ⌘K / Ctrl+K opens the tool switcher; ⌘J / Ctrl+J opens Gridhub AI.
   *
   * The specification asked for ⌘K for the assistant "if it does not conflict". It does: ⌘K has
   * opened the tool switcher since the first release, and taking it over would break a shortcut
   * people already use. ⌘J sits next to it on the keyboard and is unused.
   */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }
      if (meta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (ai.open) ai.closePanel();
        else ai.openPanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ai]);

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      await getSupabaseBrowserClient()?.auth.signOut();
    }
    router.push("/");
    router.refresh();
  };

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const tools = Object.values(TOOL_MAP).filter(
      (t) => !q || t.name.toLowerCase().includes(q) || t.keywords.some((k) => k.includes(q)),
    );
    return tools.slice(0, 8);
  }, [query]);

  const initials = (user?.name || user?.email || "G").slice(0, 1).toUpperCase();
  const mobileNav = isAdmin ? [...MOBILE_NAV, ADMIN_NAV_ITEM] : MOBILE_NAV;

  /*
   * Rendered as a function so the mobile drawer can close itself on navigation. Without
   * `onNavigate` a tap on "Tools" navigated underneath a drawer that stayed open, which made
   * the drawer feel broken — and now that the account controls live here, the drawer is the
   * primary way around on a phone.
   */
  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-between px-1 pt-1">
        <Link href="/app" aria-label="Gridhub home" className="press" onClick={onNavigate}>
          <LogoMark size={28} />
        </Link>
      </div>

      <button
        onClick={() => setCommandOpen(true)}
        className="press flex items-center gap-2 rounded-xl border border-line bg-[var(--surface-strong)] px-2.5 py-2 text-left text-[12.5px] text-fg-subtle hover:text-fg-muted"
      >
        <AnimatedIcon name="search" size={14} trigger="hover" />
        <span className="flex-1">{t("Search…")}</span>
        <kbd className="rounded border border-line px-1 text-[10px] text-fg-subtle">⌘K</kbd>
      </button>

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isCurrent(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="thin-scroll -mx-1 flex-1 overflow-y-auto px-1">
        {COLLECTIONS.map((collection) => {
          const tools = toolsByCollection(collection.id).filter((t) => active.includes(t.id));
          if (!tools.length) return null;
          const isOpen = openCollections[collection.id] ?? true;
          const listId = `sidebar-collection-${collection.id}`;
          return (
            <div key={collection.id} className="mb-3">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={listId}
                onClick={() => setOpenCollections((current) => ({
                  ...current,
                  [collection.id]: !(current[collection.id] ?? true),
                }))}
                className="group mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-left hover:bg-[var(--bg-subtle)]"
              >
                <span className="eyebrow text-[10px]">{t(collection.name)}</span>
                <AnimatedIcon
                  name="chevronDown"
                  size={13}
                  trigger="none"
                  className={cn("text-fg-subtle transition-transform", isOpen && "rotate-180")}
                />
              </button>
              <div id={listId} className={cn("flex flex-col gap-0.5", !isOpen && "hidden")}>
                {tools.map((tool) => (
                  <NavLink
                    key={tool.id}
                    href={tool.route}
                    label={t(tool.shortName)}
                    icon={toolIconName(tool.id)}
                    active={isCurrent(pathname, tool.route)}
                    onNavigate={onNavigate}
                    indent
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2">
          {SECONDARY_NAV.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isCurrent(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
          {isAdmin ? (
            <NavLink
              {...ADMIN_NAV_ITEM}
              active={isCurrent(pathname, ADMIN_NAV_ITEM.href)}
              onNavigate={onNavigate}
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-[var(--bg-subtle)]/60 p-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-semibold text-[var(--accent-fg)]">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-fg">{user?.name ?? "Local workspace"}</p>
            <p className="truncate text-[10.5px] text-fg-subtle">{user?.email ?? "Not signed in"}</p>
          </div>
        </div>
      </div>
      <a
        href="mailto:support@gridhub.online"
        className="px-1 text-[11px] text-fg-subtle underline-offset-4 hover:text-fg hover:underline"
      >
        support@gridhub.online
      </a>

      {/*
        Phone-only. These three controls used to crowd the header, which left the wordmark
        squeezed against the hamburger. The drawer has the room, and Settings / Subscription /
        Sign out are already reachable from the nav above, so the avatar needs no menu of its own.
      */}
      <div className="flex flex-col gap-1.5 lg:hidden">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <SyncIndicator />
          <ThemeToggle />
        </div>
        <button
          onClick={() => {
            onNavigate?.();
            void signOut();
          }}
          className="press flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-fg-muted hover:bg-[var(--bg-subtle)] hover:text-fg"
        >
          <AnimatedIcon name="logout" size={16} className="text-fg-subtle" trigger="hover" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="app-desktop-sidebar fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-[var(--surface)] backdrop-blur-xl lg:block">
        {sidebar()}
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <div className="app-mobile-sidebar glass-strong absolute inset-y-0 left-0 w-[280px]">
            {sidebar(() => setMobileNavOpen(false))}
          </div>
        </div>
      ) : null}

      <div className="app-shell-content lg:pl-[248px]">
        {/* Top bar */}
        <header className="safe-top sticky top-0 z-20 border-b border-line bg-header backdrop-blur-xl">
          <div className="relative flex h-14 items-center gap-2 px-3 sm:px-5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <AnimatedIcon name="menu" size={18} trigger="click" />
            </Button>

            {/*
              Brand wordmark, optically centred in the header on every breakpoint. On phones the
              hamburger holds the left edge, so the wordmark is taken out of flow and pinned to
              the centre with a transform; on desktop the hamburger is gone and the wordmark
              simply centres against the right-aligned controls.
            */}
            <Link
              href="/app"
              aria-label="Gridhub home"
              className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center"
            >
              <Wordmark size="xl" />
            </Link>

            {/* Phone: these live in the drawer instead. */}
            <div className="ml-auto hidden items-center gap-1.5 lg:flex">
              <button
                onClick={() => setCommandOpen(true)}
                className="press hidden items-center gap-1.5 rounded-full border border-line bg-[var(--surface-strong)] px-2.5 py-1 text-[11.5px] text-fg-subtle sm:flex"
                aria-label="Search tools"
              >
                <AnimatedIcon name="search" size={13} trigger="hover" />
                Search
              </button>
              <SyncIndicator />
              <ThemeToggle />
              <Dropdown>
                <DropdownTrigger asChild>
                  <button
                    className="press grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-[var(--accent-fg)]"
                    aria-label="Account menu"
                  >
                    {initials}
                  </button>
                </DropdownTrigger>
                <DropdownContent>
                  <div className="px-2 py-1.5">
                    <p className="text-[12.5px] font-medium text-fg">{user?.name ?? "Local workspace"}</p>
                    <p className="truncate text-[11px] text-fg-subtle">{user?.email ?? "Not signed in"}</p>
                  </div>
                  <DropdownSeparator />
                  <DropdownItem icon="settings" onSelect={() => router.push("/app/settings")}>
                    Settings
                  </DropdownItem>
                  <DropdownItem icon="billing" onSelect={() => router.push("/app/billing")}>
                    Subscription
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem icon="logout" danger onSelect={() => void signOut()}>
                    Sign out
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-3 pb-28 pt-4 sm:px-5 sm:pt-5 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--bottom-nav-bg)] lg:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {mobileNav.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "press flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium",
                  current ? "text-fg" : "text-fg-subtle",
                )}
              >
                <AnimatedIcon
                  name={item.icon}
                  size={20}
                  trigger="both"
                  className={current ? "text-[var(--accent)]" : ""}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Command menu */}
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent title="Jump to" description="Search your tools and workspace.">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, e.g. budget, invoice, habit…"
            className="mb-3"
            aria-label="Search"
          />
          <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto thin-scroll">
            {results.map((tool) => (
              <button
                key={tool.id}
                onClick={() => {
                  setCommandOpen(false);
                  setQuery("");
                  router.push(tool.route);
                }}
                className="press flex items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-[var(--bg-subtle)]"
              >
                <ToolIcon toolId={tool.id as ToolId} size={16} tinted={false} trigger="none" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-fg">{t(tool.name)}</span>
                  <span className="block truncate text-[11.5px] text-fg-subtle">{t(tool.tagline)}</span>
                </span>
                {!active.includes(tool.id) ? <Badge tone="neutral">Inactive</Badge> : null}
              </button>
            ))}
            {!results.length ? (
              <p className="px-2 py-6 text-center text-[13px] text-fg-subtle">{t("No tools match “{query}”.", { query })}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <GridhubAIFab />
      <GridhubAIPanel />
      <AppPrompts buildVersion={buildVersion} />
      <Splash />
    </div>
  );
}
