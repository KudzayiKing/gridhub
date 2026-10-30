"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo size="md" />
      <p className="eyebrow">404</p>
      <h1 className="display-xl text-3xl">{t("Nothing in this place.")}</h1>
      <p className="text-[13px] leading-relaxed text-fg-muted">
        {t("That page does not exist. It may have moved, or the link may be incomplete.")}
      </p>
      <div className="flex gap-2">
        <Button variant="primary" size="md" iconRight="arrowRight" asChild>
          <Link href="/">{t("Back home")}</Link>
        </Button>
        <Button variant="secondary" size="md" asChild>
          <Link href="/app">{t("Open workspace")}</Link>
        </Button>
      </div>
    </div>
  );
}
