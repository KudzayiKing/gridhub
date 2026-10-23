"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { ThemeToggle } from "@/components/shell/sync-indicator";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/tools", label: "Tools" },
  { href: "/collections", label: "Collections" },
  { href: "/free-tools", label: "Free Tools", wideOnly: true },
  { href: "/journal", label: "Journal", wideOnly: true },
  /*
   * Shown from `lg` only. Measured: at 768–1023px the header has no room for a sixth item (the
   * row needs 862px at 768), and dropping it in would either wrap or push the page into a
   * horizontal scroll. The five-item layout below `lg` is therefore untouched; this link is still
   * in the mobile menu and the footer.
   */
  { href: "/gridhub-ai", label: "GridHub AI", wideOnly: true },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/offline", label: "Offline" },
];

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors",
        scrolled ? "border-line bg-header backdrop-blur-xl" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="press" aria-label="Gridhub home">
          <Logo size="md" />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                // px-2.5 rather than px-3: at exactly 768px the five-item row was overflowing its
                // container by 14px, which produced a page-wide horizontal scrollbar.
                "press rounded-full px-2.5 py-1.5 text-[13px] font-medium text-fg-muted hover:bg-[var(--bg-subtle)] hover:text-fg",
                "wideOnly" in item && item.wideOnly ? "hidden lg:block" : undefined,
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="primary" size="sm" iconRight="arrowRight" asChild>
            <Link href="/login">Get started</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <AnimatedIcon name={open ? "close" : "menu"} size={18} trigger="click" />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line bg-[var(--surface-strong)] px-4 py-2 backdrop-blur-xl md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="press block rounded-lg px-2 py-2.5 text-[13.5px] text-fg-muted hover:bg-[var(--bg-subtle)] hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="press block rounded-lg px-2 py-2.5 text-[13.5px] font-medium">
            Sign in
          </Link>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo size="md" />
          <p className="mt-2 max-w-[220px] text-[12.5px] leading-relaxed text-fg-muted">
            Beautifully simple tools to organize your money, manage your business, and take control of everyday life.
          </p>
        </div>

        <div>
          <p className="eyebrow mb-2">Product</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg-muted">
            <li><Link className="hover:text-fg" href="/tools">All 16 tools</Link></li>
            <li><Link className="hover:text-fg" href="/free-tools">Free Tools</Link></li>
            <li><Link className="hover:text-fg" href="/journal">GridHub Journal</Link></li>
            <li><Link className="hover:text-fg" href="/collections">Collections</Link></li>
            <li><Link className="hover:text-fg" href="/gridhub-ai">GridHub AI</Link></li>
            <li><Link className="hover:text-fg" href="/pricing">Pricing</Link></li>
            <li><Link className="hover:text-fg" href="/offline">Offline &amp; PWA</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-2">Company</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg-muted">
            <li><Link className="hover:text-fg" href="/about">About</Link></li>
            <li><Link className="hover:text-fg" href="/how-it-works">How it works</Link></li>
            <li><Link className="hover:text-fg" href="/faq">FAQ</Link></li>
            <li><Link className="hover:text-fg" href="/contact">Contact</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-2">Legal</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg-muted">
            <li><Link className="hover:text-fg" href="/privacy">Privacy</Link></li>
            <li><Link className="hover:text-fg" href="/terms">Terms</Link></li>
            <li><Link className="hover:text-fg" href="/refund-policy">Refund policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11.5px] text-fg-subtle">
          <p>© {new Date().getFullYear()} Gridhub. One hub. Everything organized.</p>
          <p>Built as an installable PWA. Your data stays yours.</p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
