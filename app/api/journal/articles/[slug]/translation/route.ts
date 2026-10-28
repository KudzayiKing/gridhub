import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TARGET_LANGUAGES = new Set(["es", "zh-CN", "pt-BR", "fr", "ar", "ru"]);
const MAX_ARTICLE_CHARS = 60_000;
const MAX_TEXTS_PER_REQUEST = 100;
const MAX_CHARS_PER_REQUEST = 25_000;
const rateWindow = new Map<string, { startedAt: number; count: number }>();

type Translation = {
  title: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  category_name: string;
  body_markdown: string;
};

function tooManyRequests(request: Request) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const entry = rateWindow.get(ip);
  if (!entry || now - entry.startedAt > 60 * 60 * 1000) {
    rateWindow.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 20;
}

function protectMarkdown(text: string) {
  const protectedValues: string[] = [];
  let value = text.replace(/\]\(([^)]+)\)/g, (_match, destination: string) => {
    const token = `ZXQGHDEST${protectedValues.length}QXZ`;
    protectedValues.push(destination);
    return `](${token})`;
  });
  value = value.replace(/`[^`]*`|https?:\/\/[^\s)]+/g, (match) => {
    const token = `ZXQGHCODE${protectedValues.length}QXZ`;
    protectedValues.push(match);
    return token;
  });
  return { value, protectedValues };
}

function restoreMarkdown(text: string, protectedValues: string[]) {
  return protectedValues.reduce((value, original, index) => value
    .replaceAll(`ZXQGHDEST${index}QXZ`, original)
    .replaceAll(`ZXQGHCODE${index}QXZ`, original), text);
}

function decodeTranslatedText(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|#39);/gi, (entity, value: string) => {
    if (value.toLowerCase() === "amp") return "&";
    if (value.toLowerCase() === "lt") return "<";
    if (value.toLowerCase() === "gt") return ">";
    if (value.toLowerCase() === "quot") return '"';
    if (value === "#39") return "'";
    const codePoint = value.toLowerCase().startsWith("#x") ? Number.parseInt(value.slice(2), 16) : Number.parseInt(value.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
  });
}

async function translateStrings(values: string[], language: string, apiKey: string) {
  const protectedValues = values.map(protectMarkdown);
  const result = [...values];
  const indexes = protectedValues.flatMap((entry, index) => entry.value.trim() ? [index] : []);

  for (let offset = 0; offset < indexes.length;) {
    const batchIndexes: number[] = [];
    let batchChars = 0;
    while (offset < indexes.length && batchIndexes.length < MAX_TEXTS_PER_REQUEST) {
      const index = indexes[offset];
      const length = protectedValues[index].value.length;
      if (batchIndexes.length && batchChars + length > MAX_CHARS_PER_REQUEST) break;
      if (length > MAX_CHARS_PER_REQUEST) throw new Error("Article text segment is too long to translate.");
      batchIndexes.push(index);
      batchChars += length;
      offset += 1;
    }

    const response = await fetch("https://translation.googleapis.com/language/translate/v2", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ q: batchIndexes.map((index) => protectedValues[index].value), source: "en", target: language, format: "text" }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error("The translation provider rejected the request.");
    const payload = await response.json() as { data?: { translations?: { translatedText: string }[] } };
    const translated = payload.data?.translations;
    if (!translated || translated.length !== batchIndexes.length) throw new Error("The translation provider returned an incomplete response.");
    translated.forEach((item, resultIndex) => {
      const index = batchIndexes[resultIndex];
      result[index] = restoreMarkdown(decodeTranslatedText(item.translatedText), protectedValues[index].protectedValues);
    });
  }
  return result;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (tooManyRequests(request)) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "3600" } });
  let body: { language?: unknown; scope?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_request" }, { status: 400 }); }
  const language = typeof body.language === "string" ? body.language : "";
  const scope = body.scope === "summary" ? "summary" : "full";
  if (!TARGET_LANGUAGES.has(language)) return NextResponse.json({ error: "unsupported_language" }, { status: 400 });

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "translation_not_configured" }, { status: 503 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "journal_unavailable" }, { status: 503 });

  const { slug } = await params;
  const { data: article, error } = await service.from("journal_articles")
    .select("id,title,excerpt,seo_title,seo_description,published_revision_id,status,published_at,journal_categories(name)")
    .eq("slug", slug).eq("status", "published").not("published_revision_id", "is", null)
    .not("published_at", "is", null).lte("published_at", new Date().toISOString()).maybeSingle();
  if (error || !article) return NextResponse.json({ error: "article_not_found" }, { status: 404 });

  const { data: revision } = await service.from("journal_article_revisions")
    .select("id,body_markdown").eq("id", article.published_revision_id).eq("article_id", article.id).maybeSingle();
  if (!revision || revision.body_markdown.length > MAX_ARTICLE_CHARS) return NextResponse.json({ error: "article_unavailable" }, { status: 404 });

  const { data: cached } = await service.from("journal_article_translations")
    .select("translation").eq("article_id", article.id).eq("revision_id", revision.id).eq("language", language).maybeSingle();
  if (cached?.translation && (scope === "summary" || typeof cached.translation.body_markdown === "string" && cached.translation.body_markdown.length > 0)) return NextResponse.json({ translation: cached.translation, cached: true });

  const markdownLines = revision.body_markdown.replace(/\r\n/g, "\n").split("\n");
  const categoryName = (article.journal_categories as { name?: string } | null)?.name || "GridHub Journal";
  const sourceStrings = scope === "summary"
    ? [article.title, article.excerpt, categoryName]
    : [article.title, article.excerpt, article.seo_title || article.title, article.seo_description || article.excerpt, categoryName, ...markdownLines];
  try {
    const translated = await translateStrings(sourceStrings, language, apiKey);
    const translation: Translation = scope === "summary" ? {
      title: translated[0], excerpt: translated[1], seo_title: translated[0], seo_description: translated[1], category_name: translated[2], body_markdown: "",
    } : {
      title: translated[0], excerpt: translated[1], seo_title: translated[2], seo_description: translated[3], category_name: translated[4],
      body_markdown: translated.slice(5).join("\n"),
    };
    const { error: saveError } = await service.from("journal_article_translations").upsert({
      article_id: article.id, revision_id: revision.id, language, translation, provider: "google-cloud-translation-v2", translated_at: new Date().toISOString(),
    }, { onConflict: "article_id,revision_id,language" });
    return NextResponse.json({ translation, cached: false, persisted: !saveError });
  } catch {
    return NextResponse.json({ error: "translation_failed" }, { status: 502 });
  }
}
