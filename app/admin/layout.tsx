import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminCheck, adminEmails } from "@/lib/admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { Card, InlineAlert } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

function Blocked({
  title,
  body,
  hint,
}: {
  title: string;
  body: string;
  hint?: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-5 py-16">
      <Link href="/" aria-label="Gridhub home" className="inline-flex">
        <Logo />
      </Link>
      <Card className="p-5">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{body}</p>
        {hint ? (
          <p className="mt-2 text-[12px] leading-relaxed text-fg-subtle">{hint}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/app">Back to workspace</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Public site</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const check = await getAdminCheck();

  if (check.status === "anonymous") {
    redirect("/login?next=/admin");
  }

  if (check.status === "unconfigured") {
    return (
      <Blocked
        title="Admin is unavailable in local-only mode"
        body="Supabase is not configured in this environment, so there is no server-side user base to administer. Gridhub is running entirely from this browser's local storage."
        hint="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable the admin surface. See docs/SUPABASE_SETUP.md."
      />
    );
  }

  if (check.status === "forbidden") {
    return (
      <Blocked
        title="You do not have access to admin"
        body={`The account ${check.email ?? "(no email)"} is signed in but is not on the admin allowlist.`}
        hint={
          adminEmails().length === 0
            ? "No admin accounts are configured. Set the ADMIN_EMAILS environment variable to a comma-separated list of operator emails."
            : "Admin access is controlled by the ADMIN_EMAILS environment variable on the server."
        }
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" aria-label="Admin home" className="inline-flex">
            <Logo />
          </Link>
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
            Operator
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[12px] text-fg-muted sm:inline">{check.email}</span>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app">Workspace</Link>
          </Button>
        </div>
      </header>

      <AdminNav />

      <InlineAlert tone="warning" title="Operator view">
        This surface reads across all accounts with the service-role key. Every table shows
        what the database actually contains — no demo figures are injected anywhere.
      </InlineAlert>

      <main className="flex flex-col gap-4 pb-10">{children}</main>
    </div>
  );
}
