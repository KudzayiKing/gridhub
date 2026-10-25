"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { ThemeToggle } from "@/components/shell/sync-indicator";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/field";
import { usePrefs } from "@/components/providers";
import { UI_LANGUAGES, useI18n } from "@/lib/i18n";

const NAV = [
  { href: "/tools", label: "Tools" },
  { href: "/collections", label: "Collections" },
  { href: "/free-tools", label: "Free Tools", wideOnly: "2xl" },
  { href: "/journal", label: "Journal", wideOnly: "2xl" },
  // Secondary links are progressively revealed at wider breakpoints so translated labels retain
  // their width and do not collide with the brand or account controls.
  { href: "/gridhub-ai", label: "GridHub AI", wideOnly: "2xl" },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How it works", wideOnly: "xl" },
  { href: "/offline", label: "Offline", wideOnly: "xl" },
];

export function SiteHeader() {
  const { prefs, setPrefs } = usePrefs();
  const { t } = useI18n();
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
      <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="press shrink-0" aria-label="Gridhub home">
          <Logo size="md" />
        </Link>

        <nav className="ml-8 hidden min-w-0 flex-1 items-center justify-center gap-1.5 md:flex xl:gap-2 2xl:gap-3" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "press shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium text-fg-muted hover:bg-[var(--bg-subtle)] hover:text-fg xl:px-4 2xl:px-4.5",
                item.wideOnly === "xl" ? "hidden xl:block" : undefined,
                item.wideOnly === "2xl" ? "hidden 2xl:block" : undefined,
              )}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 xl:gap-2">
          <Select
            aria-label="Interface language"
            value={prefs.uiLanguage ?? "en"}
            onChange={(event) => void setPrefs({ uiLanguage: event.target.value as typeof prefs.uiLanguage })}
            className="h-8 w-auto min-w-0 rounded-full px-2 text-[11px]"
          >
            {UI_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.nativeName}</option>)}
          </Select>
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="hidden xl:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="primary" size="sm" iconRight="arrowRight" className="hidden lg:inline-flex" asChild>
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
              {t(item.label)}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="press block rounded-lg px-2 py-2.5 text-[13.5px] font-medium">
            {t("Sign in")}
          </Link>
          <Link href="/login" onClick={() => setOpen(false)} className="press block rounded-lg px-2 py-2.5 text-[13.5px] font-medium">
            {t("Get started")}
          </Link>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo size="md" />
          <p className="mt-2 max-w-[220px] text-[12.5px] leading-relaxed text-fg-muted">
            {t("Beautifully simple tools to organize your money, manage your business, and take control of everyday life.")}
          </p>
        </div>

        <div>
          <p className="eyebrow mb-2">{t("Product")}</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg-muted">
            <li><Link className="hover:text-fg" href="/tools">{t("All 16 tools")}</Link></li>
            <li><Link className="hover:text-fg" href="/free-tools">{t("Free Tools")}</Link></li>
            <li><Link className="hover:text-fg" href="/journal">{t("GridHub Journal")}</Link></li>
            <li><Link className="hover:text-fg" href="/collections">{t("Collections")}</Link></li>
            <li><Link className="hover:text-fg" href="/gridhub-ai">GridHub AI</Link></li>
            <li><Link className="hover:text-fg" href="/pricing">{t("Pricing")}</Link></li>
            <li><Link className="hover:text-fg" href="/offline">{t("Offline & PWA")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-2">{t("Company")}</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg-muted">
            <li><Link className="hover:text-fg" href="/about">{t("About")}</Link></li>
            <li><Link className="hover:text-fg" href="/how-it-works">{t("How it works")}</Link></li>
            <li><Link className="hover:text-fg" href="/faq">FAQ</Link></li>
            <li><Link className="hover:text-fg" href="/contact">{t("Contact")}</Link></li>
            <li><a className="hover:text-fg" href="mailto:support@gridhub.online">support@gridhub.online</a></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-2">{t("Legal")}</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg-muted">
            <li><Link className="hover:text-fg" href="/privacy">{t("Privacy")}</Link></li>
            <li><Link className="hover:text-fg" href="/terms">{t("Terms")}</Link></li>
            <li><Link className="hover:text-fg" href="/refund-policy">{t("Refund policy")}</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11.5px] text-fg-subtle">
          <p>© {new Date().getFullYear()} Gridhub. {t("One hub. Everything organized.")}</p>
          <p>{t("Built as an installable PWA. Your data stays yours.")}</p>
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
