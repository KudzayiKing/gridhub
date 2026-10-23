import Link from "next/link";
import { AnimatedIcon } from "@/components/icons/animated-icon";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pt-14">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display-xl mt-2 max-w-3xl text-[34px] sm:text-[46px]">{title}</h1>
      {description ? (
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-fg-muted">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <div className="flex flex-col gap-5 text-[13.5px] leading-relaxed text-fg-muted [&_h2]:mt-4 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-fg [&_h3]:mt-2 [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-fg [&_li]:ml-4 [&_li]:list-disc [&_p]:max-w-none [&_strong]:text-fg [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
      <p className="mt-8 rounded-xl border border-line bg-[var(--bg-subtle)]/60 p-3 text-[11.5px] text-fg-subtle">
        This page is product documentation, not legal advice. Have your own counsel review anything you rely on
        commercially.
      </p>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-muted hover:text-fg"
    >
      <AnimatedIcon name="arrowLeft" size={13} trigger="hover" />
      {children}
    </Link>
  );
}

export function CtaBand({
  title = "One hub. Everything organized.",
  body = "Start with one tool. Add the rest when you need them.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <div className="gp-card glass-sheen flex flex-col items-center gap-2 px-6 py-10 text-center">
        <h2 className="display-xl text-2xl sm:text-3xl">{title}</h2>
        <p className="max-w-md text-[13px] leading-relaxed text-fg-muted">{body}</p>
        <Link
          href="/login"
          className="press mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[13px] font-medium text-[var(--accent-fg)]"
        >
          Create your workspace
          <AnimatedIcon name="arrowRight" size={14} trigger="click" />
        </Link>
      </div>
    </section>
  );
}
