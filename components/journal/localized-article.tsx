"use client";

import * as React from "react";
import Link from "next/link";
import { ArticleBody } from "@/components/journal/article-body";
import { ArticleToolCtas } from "@/components/journal/article-tool-ctas";
import { JournalArticleAnalytics } from "@/components/journal/journal-analytics";
import { useI18n } from "@/lib/i18n";

type ArticleTranslation = {
  title: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  category_name: string;
  body_markdown: string;
};

type LocalizedArticleProps = {
  articleId: string;
  revisionId: string;
  slug: string;
  title: string;
  excerpt: string;
  category: { name: string; slug: string } | null;
  authorName: string;
  publishedAt: string;
  updatedAt: string;
  bodyMarkdown: string;
  calculator?: { href: string; label: string };
  tool?: { href: string; label: string };
};

function getContents(markdown: string) {
  return markdown.split("\n").flatMap((line) => {
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (!heading) return [];
    const title = heading[1].trim();
    return [{ title, id: title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") }];
  });
}

function readTime(markdown: string) {
  const words = markdown.replace(/[#>*_`\[\]()!-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function localeFor(language: string) {
  return ({ en: "en-US", es: "es-ES", "zh-CN": "zh-CN", "pt-BR": "pt-BR", fr: "fr-FR", ar: "ar", ru: "ru-RU" } as Record<string, string>)[language] ?? "en-US";
}

function PracticeCta({ articleId, calculator, tool }: Pick<LocalizedArticleProps, "articleId" | "calculator" | "tool">) {
  const { t } = useI18n();
  return <section className="rounded-2xl border border-line bg-[var(--surface)] p-5"><p className="eyebrow">{t("Keep going with GridHub")}</p><h2 className="mt-2 text-lg font-semibold">{t("Put this guide into practice")}</h2><p className="mt-1 text-sm text-fg-muted">{t("Use a relevant GridHub tool to put these ideas into action.")}</p><ArticleToolCtas articleId={articleId} calculator={calculator ? { ...calculator, label: t(calculator.label) } : undefined} tool={tool ? { ...tool, label: t(tool.label) } : undefined}/></section>;
}

export function LocalizedArticle({ articleId, revisionId, slug, title, excerpt, category, authorName, publishedAt, updatedAt, bodyMarkdown, calculator, tool }: LocalizedArticleProps) {
  const { language, t } = useI18n();
  const [translation, setTranslation] = React.useState<{ language: string; value: ArticleTranslation } | null>(null);
  const [translationState, setTranslationState] = React.useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const current = language === "en" || translation?.language !== language ? null : translation.value;
  const renderedTitle = current?.title ?? title;
  const renderedExcerpt = current?.excerpt ?? excerpt;
  const renderedBody = current?.body_markdown ?? bodyMarkdown;
  const contents = React.useMemo(() => getContents(renderedBody), [renderedBody]);

  React.useEffect(() => {
    if (language === "en") {
      setTranslation(null);
      setTranslationState("idle");
      return;
    }
    let active = true;
    const cacheKey = `gridhub-journal-translation:${articleId}:${revisionId}:${language}:full`;
    const cachedText = window.localStorage.getItem(cacheKey);
    if (cachedText) {
      try {
        setTranslation({ language, value: JSON.parse(cachedText) as ArticleTranslation });
        setTranslationState("ready");
        return () => { active = false; };
      } catch { window.localStorage.removeItem(cacheKey); }
    }
    setTranslationState("loading");
    void fetch(`/api/journal/articles/${encodeURIComponent(slug)}/translation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Translation unavailable");
      return await response.json() as { translation: ArticleTranslation };
    }).then(({ translation: result }) => {
      if (!active) return;
      setTranslation({ language, value: result });
      setTranslationState("ready");
      try { window.localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* Storage may be full; the server cache still works. */ }
    }).catch(() => {
      if (active) setTranslationState("unavailable");
    });
    return () => { active = false; };
  }, [articleId, language, revisionId, slug]);

  React.useEffect(() => {
    if (language === "en") return;
    document.title = current?.seo_title || renderedTitle;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description && current?.seo_description) description.content = current.seo_description;
  }, [current, language, renderedTitle]);

  const publishedDate = new Intl.DateTimeFormat(localeFor(language), { dateStyle: "long", timeZone: "UTC" }).format(new Date(publishedAt));
  const updatedDate = new Intl.DateTimeFormat(localeFor(language), { dateStyle: "long", timeZone: "UTC" }).format(new Date(updatedAt));

  return <>
    <div className="mb-6 text-xs text-fg-subtle"><Link href="/journal" className="hover:text-fg">{t("Journal")}</Link>{category && <> / <Link href={`/journal/${category.slug}`} className="hover:text-fg">{current?.category_name ?? t(category.name)}</Link></>}</div>
    <header className="mx-auto max-w-3xl">
      <p className="eyebrow">{current?.category_name ?? t(category?.name ?? "GridHub Journal")}</p>
      <h1 className="display-xl mt-3 text-4xl leading-tight sm:text-5xl">{renderedTitle}</h1>
      <p className="mt-4 text-lg leading-relaxed text-fg-muted">{renderedExcerpt}</p>
      <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle"><span>{authorName}</span><span>·</span><time dateTime={publishedAt}>{t("Published")} {publishedDate}</time>{updatedAt !== publishedAt && <><span>·</span><time dateTime={updatedAt}>{t("Updated")} {updatedDate}</time></>}<span>·</span><span>{t("{count} min read", { count: readTime(renderedBody) })}</span></div>
      {translationState === "loading" && <p role="status" className="mt-3 text-xs text-fg-subtle">{t("Translating this article…")}</p>}
      {translationState === "unavailable" && <p role="status" className="mt-3 text-xs text-fg-subtle">{t("Automatic translation is unavailable right now. Showing the original article.")}</p>}
    </header>
    <div className="mx-auto mt-9 grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="mx-auto w-full max-w-3xl">
        <ArticleBody markdown={renderedBody}/>
        <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-fg-subtle">{t("This guide is general information for educational purposes. Verify details that depend on your personal circumstances, jurisdiction, or current product terms.")}</p>
        {(calculator || tool) && <div className="mt-8"><PracticeCta articleId={articleId} calculator={calculator} tool={tool}/></div>}
        <JournalArticleAnalytics articleId={articleId}/>
      </div>
      {contents.length > 2 && <aside className="order-first lg:order-last"><div className="sticky top-24 space-y-4"><div className="rounded-2xl border border-line bg-[var(--surface)] p-4"><p className="eyebrow">{t("On this page")}</p><ul className="mt-3 space-y-2">{contents.map((item) => <li key={item.id}><a className="text-xs leading-relaxed text-fg-muted hover:text-fg" href={`#${item.id}`}>{item.title}</a></li>)}</ul></div>{(calculator || tool) && <PracticeCta articleId={articleId} calculator={calculator} tool={tool}/>}</div></aside>}
    </div>
  </>;
}
