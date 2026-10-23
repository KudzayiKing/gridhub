import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Card, InlineAlert } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/icons/animated-icon";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Gridhub team about product, billing or data questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@gridhub.online";

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Contact"
        title="Talk to a human."
        description="Product questions, billing issues, data requests — one inbox, answered by the people who build Gridhub."
      />

      <div className="mx-auto grid max-w-3xl gap-4 px-4 pb-12">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <AnimatedIcon name="mail" size={17} trigger="hover" />
            <h2 className="text-[15px] font-semibold">Email</h2>
          </div>
          <a
            href={`mailto:${email}`}
            className="mt-1.5 inline-block text-[15px] font-medium underline decoration-line-strong underline-offset-4"
          >
            {email}
          </a>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">
            Include the email address on your account and, for billing questions, the last four digits of the card or
            the invoice date. Never send full card details.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Data requests</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">
            You can export everything yourself from Settings → Data &amp; privacy. For deletion, the same screen
            removes your workspace records and local cache. Billing records required for tax and accounting are
            retained by Stripe under their policy.
          </p>
        </Card>

        <InlineAlert tone="info" title="No contact form backend is configured">
          This build ships a mailto link rather than a form, because a form without a configured delivery service
          would silently discard messages. Connect a provider (Resend, Postmark, SES) and replace this block when you
          are ready.
        </InlineAlert>
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
