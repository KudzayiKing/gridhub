"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app", label: "Workspace", icon: "home" },
  { href: "/admin", label: "Admin", icon: "shield" },
  { href: "/admin/journal", label: "Journal", icon: "book-open" },
] as const;

export function AdminMobileNav() {
  const pathname = usePathname() ?? "/admin";

  return (
    <nav
      aria-label="Admin and workspace navigation"
      className="safe-bottom app-bottom-nav-glass fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {ITEMS.map((item) => {
          const active = item.href === "/admin"
            ? pathname === "/admin"
            : item.href === "/admin/journal"
              ? pathname === item.href || pathname.startsWith(`${item.href}/`)
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex min-w-24 flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium",
                active ? "text-fg" : "text-fg-subtle",
              )}
            >
              <AnimatedIcon
                name={item.icon}
                size={20}
                trigger="both"
                className={active ? "text-[var(--accent)]" : ""}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
