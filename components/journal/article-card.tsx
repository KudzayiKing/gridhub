"use client";

import * as React from "react";
import Link from "next/link";
import type { JournalArticle } from "@/lib/journal/types";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

function readTime(markdown: string) {
  const words = markdown.replace(/[#>*_`\[\]()!-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function ArticleCard({ article }: { article: JournalArticle }) {
  const { language, t } = useI18n();
  const [translation, setTranslation] = React.useState<{ language: string; value: { title: string; excerpt: string; category_name: string; body_markdown: string } } | null>(null);
  const [element, setElement] = React.useState<HTMLAnchorElement | null>(null);
  const revisionId = article.published_revision_id;

  React.useEffect(() => {
    if (language === "en" || !revisionId || !element) { setTranslation(null); return; }
    let active = true;
    const key = `gridhub-journal-translation:${article.id}:${revisionId}:${language}:summary`;
    const load = () => {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        try { setTranslation({ language, value: JSON.parse(stored) }); return; } catch { window.localStorage.removeItem(key); }
      }
      void fetch(`/api/journal/articles/${encodeURIComponent(article.slug)}/translation`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, scope: "summary" }),
      }).then(async (response) => {
        if (!response.ok) throw new Error("Translation unavailable");
        return await response.json() as { translation: { title: string; excerpt: string; category_name: string; body_markdown: string } };
      }).then(({ translation: result }) => {
        if (!active) return;
        setTranslation({ language, value: result });
        try { window.localStorage.setItem(key, JSON.stringify(result)); } catch { /* The server cache remains available. */ }
      }).catch(() => undefined);
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: "160px" });
    observer.observe(element);
    return () => { active = false; observer.disconnect(); };
  }, [article.id, article.slug, article.updated_at, element, language, revisionId]);

  const dateLocale = ({ en: "en-US", es: "es-ES", "zh-CN": "zh-CN", "pt-BR": "pt-BR", fr: "fr-FR", ar: "ar", ru: "ru-RU" } as Record<string, string>)[language] ?? "en-US";
  const dateLabel = article.published_at ? new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(article.published_at)) : "";
  const localized = translation?.language === language ? translation.value : null;
  return <Link ref={setElement} href={`/journal/${article.slug}`} className="group block h-full">
    <Card className="flex h-full flex-col overflow-hidden p-0 transition-transform group-hover:-translate-y-0.5">
      {article.featured_image ? <div className="aspect-[16/9] overflow-hidden bg-[var(--bg-subtle)]"><img className="h-full w-full object-cover" src={article.featured_image} alt={article.featured_image_alt} loading="lazy" /></div> : <div aria-hidden="true" className="grid aspect-[16/9] place-items-center bg-[radial-gradient(circle_at_70%_30%,var(--accent-soft),transparent_50%),var(--bg-subtle)]"><span className="eyebrow">{t("GridHub Journal")}</span></div>}
      <div className="flex flex-1 flex-col p-4"><p className="eyebrow">{localized?.category_name ?? t(article.category?.name ?? "Journal")}</p><h2 className="mt-2 text-lg font-semibold leading-snug group-hover:text-[var(--accent)]">{localized?.title ?? article.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fg-muted">{localized?.excerpt ?? article.excerpt}</p><div className="mt-auto flex gap-2 pt-4 text-[11px] text-fg-subtle"><time dateTime={article.published_at ?? undefined}>{dateLabel}</time><span aria-hidden="true">·</span><span>{t("{count} min read", { count: readTime(localized?.body_markdown ?? article.revision?.body_markdown ?? "") })}</span></div></div>
    </Card>
  </Link>;
}
