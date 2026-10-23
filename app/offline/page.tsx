import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Card, InlineAlert } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/icons/animated-icon";

export const metadata: Metadata = {
  title: "Offline & PWA",
  description:
    "Gridhub is an offline-first progressive web app. Install it on Android, iPhone, iPad or desktop and keep working without a connection.",
  alternates: { canonical: "/offline" },
};

export default function OfflinePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Offline-first"
        title="Install once. Work anywhere."
        description="Gridhub is built as an offline-first progressive web app: local-first writes, a durable mutation queue, and honest sync status."
      />

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">How a change is saved</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {[
              { t: "1. Written locally", b: "The record is persisted to IndexedDB before the interface confirms it." },
              { t: "2. Queued", b: "A mutation with a unique id joins the outbox. The record is marked unsynced." },
              { t: "3. Synced", b: "When online and signed in, the queue is pushed. Only server-acknowledged mutations are cleared." },
              { t: "4. Reconciled", b: "Server changes are pulled since the last cursor. Locally edited records are never overwritten." },
            ].map((step) => (
              <li key={step.t} className="flex gap-2.5">
                <AnimatedIcon name="check" size={14} className="mt-0.5 text-[var(--accent)]" trigger="none" />
                <div>
                  <p className="text-[12.5px] font-medium">{step.t}</p>
                  <p className="text-[11.5px] leading-relaxed text-fg-muted">{step.b}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">Install on your device</h2>
          <div className="mt-3 flex flex-col gap-3 text-[12.5px] leading-relaxed text-fg-muted">
            <div>
              <p className="font-medium text-fg">iPhone &amp; iPad</p>
              <p>Open Gridhub in Safari, tap Share, then “Add to Home Screen”.</p>
            </div>
            <div>
              <p className="font-medium text-fg">Android</p>
              <p>Open in Chrome and use the install prompt, or Menu → “Install app”.</p>
            </div>
            <div>
              <p className="font-medium text-fg">Desktop</p>
              <p>Use the install icon in the address bar (Chrome or Edge) to install Gridhub as an app.</p>
            </div>
          </div>

          <div className="mt-4">
            <InlineAlert tone="info" title="Platform behavior differs">
              Installation and background sync support vary by browser. Gridhub never relies solely on background
              sync — it also syncs on launch, reconnect and when you return to the tab.
            </InlineAlert>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-[15px] font-semibold">What offline means for your subscription</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">
            After an online check-in, Gridhub issues a signed, time-limited entitlement grant so your paid tools keep
            working for a seven-day grace period. The grant is signed on the server; editing it on your device cannot
            create access. When you reconnect, the entitlement is revalidated.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { icon: "shield", t: "Signed grant", b: "HMAC-signed payload with an expiry." },
              { icon: "clock", t: "Seven days", b: "Enough for a trip; not indefinite access." },
              { icon: "lock", t: "No data loss", b: "Expiry never deletes your records." },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-line bg-[var(--bg-subtle)]/50 p-3">
                <AnimatedIcon name={f.icon} size={15} className="text-fg-muted" trigger="hover" />
                <p className="mt-1.5 text-[12px] font-medium">{f.t}</p>
                <p className="text-[11px] text-fg-subtle">{f.b}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
