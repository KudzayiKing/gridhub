"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AnimatedIcon } from "@/components/icons/animated-icon";

const ITEMS: { href: string; label: string; icon: string }[] = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/tools", label: "Tools", icon: "tools" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "repeat" },
  { href: "/admin/billing", label: "Billing events", icon: "billing" },
  { href: "/admin/system", label: "System", icon: "gauge" },
  { href: "/admin/support", label: "Support", icon: "mail" },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {ITEMS.map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium",
              current
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-fg-muted hover:bg-[var(--bg-subtle)] hover:text-fg",
            )}
          >
            <AnimatedIcon name={item.icon} size={14} trigger="hover" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
