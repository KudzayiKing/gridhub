"use client";

import Link from "next/link";
import { MarketingShell } from "@/components/marketing/shell";
import { PageHeader, CtaBand, BackLink } from "@/components/marketing/page-parts";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToolIcon } from "@/components/icons/tool-icons";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { COLLECTION_MAP, TOOL_MAP, toolBySlug, toolsByCollection } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";

export function ToolDetailContent({ slug }: { slug: string }) {
  const { t } = useI18n();
  const tool = toolBySlug(slug);
  if (!tool) return null;

  const collection = COLLECTION_MAP[tool.collection];
  const related = toolsByCollection(tool.collection)
    .filter((item) => item.id !== tool.id)
    .slice(0, 3);

  return (
    <MarketingShell>
      <PageHeader eyebrow={collection.label} title={tool.name} description={tool.description}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="md" iconRight="arrowRight" asChild>
            <Link href="/login">{t("Start with this tool")}</Link>
          </Button>
          <Button variant="secondary" size="md" asChild>
            <Link href="/pricing">{t("See pricing")}</Link>
          </Button>
          {tool.freeTier ? <Badge tone="accent">{t("Free forever")}</Badge> : null}
        </div>
      </PageHeader>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-12 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <ToolIcon toolId={tool.id} size={24} trigger="mount" />
            <div>
              <p className="text-[13px] font-medium">{t("What you get")}</p>
              <p className="text-[11.5px] text-fg-subtle">{t(tool.tagline)}</p>
            </div>
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {tool.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-2.5 text-[12px] text-fg-muted"
              >
                <AnimatedIcon
                  name="check"
                  size={13}
                  className="mt-0.5 text-[var(--accent)]"
                  trigger="none"
                />
                {t(feature)}
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <p className="text-[12.5px] font-medium">{t("Designed for")}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {tool.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-muted"
                >
                  {t(benefit)}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-xl border border-line p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-medium">
              <AnimatedIcon name="offline" size={13} trigger="none" /> {t("Works offline")}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">
              {t(
                "Records are stored on your device first. Install Gridhub as an app and keep working without a connection; changes sync when you return online.",
              )}
            </p>
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <p className="text-[12px] font-medium">{t("How the numbers work")}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">
              {t(
                "Calculations are decimal-safe and documented. Every metric states its currency, period and source, and empty tools show an explanation rather than invented figures.",
              )}
            </p>
          </Card>

          {related.length ? (
            <Card className="p-4">
              <p className="text-[12px] font-medium">
                {t("Also in {collection}", { collection: collection.name })}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/tools/${item.slug}`}
                    className="press flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12px] hover:bg-[var(--bg-subtle)]"
                  >
                    <ToolIcon toolId={item.id} size={13} tinted={false} trigger="none" />
                    <span className="min-w-0 flex-1 truncate">{item.shortName}</span>
                    <AnimatedIcon
                      name="chevronRight"
                      size={12}
                      className="text-fg-subtle"
                      trigger="none"
                    />
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <BackLink href="/tools">{t("All tools")}</BackLink>
      </div>

      <div className="mt-8">
        <CtaBand
          title={t("{name}, organized.", { name: TOOL_MAP[tool.id].shortName })}
          body="Activate it in your workspace and start with your own records — no demo data required."
        />
      </div>
    </MarketingShell>
  );
}
