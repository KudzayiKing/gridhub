import Link from "next/link";
import type { JournalArticle } from "@/lib/journal/types";
import { readingMinutes } from "@/lib/journal/data";
import { Card } from "@/components/ui/card";

export function ArticleCard({ article }: { article: JournalArticle }) {
  return <Link href={`/journal/${article.slug}`} className="group block h-full">
    <Card className="flex h-full flex-col overflow-hidden p-0 transition-transform group-hover:-translate-y-0.5">
      {article.featured_image ? <div className="aspect-[16/9] overflow-hidden bg-[var(--bg-subtle)]"><img className="h-full w-full object-cover" src={article.featured_image} alt={article.featured_image_alt} loading="lazy" /></div> : <div aria-hidden="true" className="grid aspect-[16/9] place-items-center bg-[radial-gradient(circle_at_70%_30%,var(--accent-soft),transparent_50%),var(--bg-subtle)]"><span className="eyebrow">GridHub Journal</span></div>}
      <div className="flex flex-1 flex-col p-4"><p className="eyebrow">{article.category?.name ?? "Journal"}</p><h2 className="mt-2 text-lg font-semibold leading-snug group-hover:text-[var(--accent)]">{article.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fg-muted">{article.excerpt}</p><div className="mt-auto flex gap-2 pt-4 text-[11px] text-fg-subtle"><time dateTime={article.published_at ?? undefined}>{article.published_at ? new Date(article.published_at).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" }) : ""}</time><span aria-hidden="true">·</span><span>{readingMinutes(article.revision?.body_markdown ?? "")} min read</span></div></div>
    </Card>
  </Link>;
}
