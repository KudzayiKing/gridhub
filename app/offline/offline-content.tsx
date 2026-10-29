"use client";

import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand } from "@/components/marketing/page-parts";
import { Card, InlineAlert } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { useI18n } from "@/lib/i18n";

const STEP_ICON = "check" as const;

export function OfflineContent() {
  const { t } = useI18n();

  const steps = [
    {
      title: t("1. Written locally"),
      body: t("The record is persisted to IndexedDB before the interface confirms it."),
    },
    {
      title: t("2. Queued"),
      body: t("A mutation with a unique id joins the outbox. The record is marked unsynced."),
    },
    {
      title: t("3. Synced"),
      body: t(
        "When online and signed in, the queue is pushed. Only server-acknowledged mutations are cleared.",
      ),
    },
    {
      title: t("4. Reconciled"),
      body: t(
        "Server changes are pulled since the last cursor. Locally edited records are never overwritten.",
      ),
    },
  ];

  const installs = [
    {
      platform: t("iPhone & iPad"),
      body: t("Open Gridhub in Safari, tap Share, then “Add to Home Screen”."),
    },
    {
      platform: t("Android"),
      body: t("Open in Chrome and use the install prompt, or Menu → “Install app”."),
    },
    {
      platform: t("Desktop"),
      body: t(
        "Use the install icon in the address bar (Chrome or Edge) to install Gridhub as an app.",
      ),
    },
  ];

  const features = [
    {
      icon: "shield" as const,
      title: t("Signed grant"),
      body: t("HMAC-signed payload with an expiry."),
    },
    {
      icon: "clock" as const,
      title: t("Seven days"),
      body: t("Enough for a trip; not indefinite access."),
    },
    {
      icon: "lock" as const,
      title: t("No data loss"),
      body: t("Expiry never deletes your records."),
    },
  ];

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Offline-first"
        title="Install once. Work anywhere."
        description="Gridhub is built as an offline-first progressive web app: local-first writes, a durable mutation queue, and honest sync status."
      />

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">{t("How a change is saved")}</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {steps.map((step) => (
              <li key={step.title} className="flex gap-2.5">
                <AnimatedIcon
                  name={STEP_ICON}
                  size={14}
                  className="mt-0.5 text-[var(--accent)]"
                  trigger="none"
                />
                <div>
                  <p className="text-[12.5px] font-medium">{step.title}</p>
                  <p className="text-[11.5px] leading-relaxed text-fg-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold">{t("Install on your device")}</h2>
          <div className="mt-3 flex flex-col gap-3 text-[12.5px] leading-relaxed text-fg-muted">
            {installs.map((item) => (
              <div key={item.platform}>
                <p className="font-medium text-fg">{item.platform}</p>
                <p>{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <InlineAlert tone="info" title={t("Platform behavior differs")}>
              {t(
                "Installation and background sync support vary by browser. Gridhub never relies solely on background sync — it also syncs on launch, reconnect and when you return to the tab.",
              )}
            </InlineAlert>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-[15px] font-semibold">
            {t("What offline means for your subscription")}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">
            {t(
              "After an online check-in, Gridhub issues a signed, time-limited entitlement grant so your paid tools keep working for a seven-day grace period. The grant is signed on the server; editing it on your device cannot create access. When you reconnect, the entitlement is revalidated.",
            )}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-line bg-[var(--bg-subtle)]/50 p-3"
              >
                <AnimatedIcon
                  name={feature.icon}
                  size={15}
                  className="text-fg-muted"
                  trigger="hover"
                />
                <p className="mt-1.5 text-[12px] font-medium">{feature.title}</p>
                <p className="text-[11px] text-fg-subtle">{feature.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <CtaBand />
    </MarketingShell>
  );
}
