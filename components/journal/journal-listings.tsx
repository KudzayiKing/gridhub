"use client";

import Link from "next/link";
import { ArticleCard } from "@/components/journal/article-card";
import { useI18n } from "@/lib/i18n";
import type { JournalArticle, JournalCategory } from "@/lib/journal/types";

export function JournalLanding({ categories, articles, query }: { categories: JournalCategory[]; articles: JournalArticle[]; query: string }) {
  const { t } = useI18n();
  const featured = articles[0];
  const rest = featured ? articles.slice(1) : [];
  const heading = query ? t("Search results") : featured ? t("Latest articles") : t("The Journal");
  return <div className="mx-auto max-w-6xl px-4 pb-16 pt-10">
    <section className="rounded-[28px] border border-line bg-[var(--surface)] p-6 sm:p-10">
      <p className="eyebrow">{t("GridHub Journal")}</p>
      <h1 className="display-xl mt-2 text-4xl sm:text-5xl">{t("Ideas for a more organized life.")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">{t("Practical guides and insights to help you manage your money, grow your business, organize your life, and get more done.")}</p>
      <form className="mt-5 flex max-w-xl gap-2" action="/journal"><input name="q" aria-label={t("Search Journal")} placeholder={t("Search practical guides…")} defaultValue={query} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-[var(--surface-strong)] px-3 text-sm"/><button className="rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-fg)]">{t("Search")}</button></form>
      <div className="mt-5 flex flex-wrap gap-2"><Link className="rounded-full border border-line px-3 py-1.5 text-xs" href="/journal">{t("All articles")}</Link>{categories.map((category) => <Link key={category.id} className="rounded-full border border-line px-3 py-1.5 text-xs text-fg-muted hover:text-fg" href={`/journal/${category.slug}`}>{t(category.name)}</Link>)}</div>
    </section>
    {featured && !query && <section className="mt-8"><p className="eyebrow mb-3">{t("Featured guide")}</p><ArticleCard article={featured}/></section>}
    <section className="mt-9">
      <div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">{heading}</p><h2 className="mt-1 text-2xl font-semibold">{query ? t("Results for “{query}”", { query }) : t("Practical ideas, clearly explained")}</h2></div><span className="text-xs text-fg-subtle">{articles.length} {t(articles.length === 1 ? "article" : "articles")}</span></div>
      {articles.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(query ? articles : rest).map((article) => <ArticleCard key={article.id} article={article}/>)}</div> : <div className="rounded-2xl border border-dashed border-line p-8 text-center"><h2 className="font-semibold">{query ? t("No matching published articles") : t("New guides are on the way")}</h2><p className="mt-2 text-sm text-fg-muted">{query ? t("Try a different search term.") : t("We’re preparing practical, researched guides for each part of life and work.")}</p></div>}
    </section>
    <section className="mt-10"><p className="eyebrow">{t("Browse by collection")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category) => <Link key={category.id} href={`/journal/${category.slug}`} className="rounded-2xl border border-line bg-[var(--surface)] p-4 hover:border-[var(--accent)]"><h3 className="font-semibold">{t(category.name)}</h3><p className="mt-1 text-xs leading-relaxed text-fg-muted">{t(category.description)}</p></Link>)}</div></section>
    <section className="mt-10 rounded-2xl border border-line bg-[var(--surface)] p-5"><h2 className="text-lg font-semibold">{t("Try a free calculator")}</h2><p className="mt-1 text-sm text-fg-muted">{t("Explore six quick tools for budgeting, debt, savings, property, business margins, and invoices.")}</p><Link href="/free-tools" className="mt-3 inline-flex text-sm font-medium text-[var(--accent)]">{t("Browse free calculators →")}</Link></section>
  </div>;
}

export function JournalCategoryListing({ category, articles }: { category: JournalCategory; articles: JournalArticle[] }) {
  const { t } = useI18n();
  return <div className="mx-auto max-w-6xl px-4 pb-16 pt-10"><Link href="/journal" className="text-xs text-fg-muted hover:text-fg">← {t("GridHub Journal")}</Link><section className="mt-4 rounded-[28px] border border-line bg-[var(--surface)] p-6 sm:p-9"><p className="eyebrow">{t("Journal collection")}</p><h1 className="mt-2 text-4xl font-semibold">{t(category.name)}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{t(category.description)}</p></section>{articles.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{articles.map((article) => <ArticleCard key={article.id} article={article}/>)}</div> : <p className="mt-7 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-fg-muted">{t("No published articles in this collection yet.")}</p>}</div>;
}

export function RelatedGuides({ articles }: { articles: JournalArticle[] }) {
  const { t } = useI18n();
  return <section className="mx-auto mt-12 max-w-6xl"><h2 className="text-2xl font-semibold">{t("Related guides")}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{articles.map((item) => <ArticleCard key={item.id} article={item}/>)}</div></section>;
}
