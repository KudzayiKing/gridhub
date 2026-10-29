import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { translate, UI_LANGUAGES } from "@/lib/i18n";
import { BILLING_FAQ, FAQ_GROUPS, PLAN_INCLUDES } from "@/lib/marketing/faq";

/*
 * Coverage guard for the interface catalog.
 *
 * The existing i18n test checks that catalog *entries* translate. It cannot catch the opposite
 * failure, which is the one that actually shipped: a component renders English in every
 * language because it never calls `t()` at all (the Quick add dialog), or it calls `t()` with a
 * string nobody added to the catalog ("partially missing" screens).
 *
 * This test closes both holes from the source side: every string literal passed to `t()` or
 * `translate()` must resolve to a real translation in every supported language.
 *
 * `IDENTICAL_OK` is not an escape hatch, it is a decision log. A handful of strings are
 * correctly unchanged in some language — brand names, and cognates that are the same word
 * (French "Journal", Spanish "Legal"). Listing one here is a claim that the identical text is
 * right; anything not listed must be translated.
 */

const LANGS = UI_LANGUAGES.filter((item) => item.code !== "en").map((item) => item.code);

const IDENTICAL_OK: Record<string, { langs: string[]; why: string }> = {
  "Gridhub AI": { langs: ["es", "zh-CN", "pt-BR", "fr", "ar"], why: "product name" },
  "GridHub AI": { langs: ["es", "zh-CN", "pt-BR", "fr", "ru", "ar"], why: "product name" },
  Collection: { langs: ["fr"], why: "French cognate" },
  "Popular": { langs: ["es", "pt-BR"], why: "cognate" },
  "Questions": { langs: ["fr", "ar"], why: "French cognate" },
  Admin: { langs: ["pt-BR"], why: "cognate" },
  Journal: { langs: ["fr"], why: "French word is Journal" },
  Illustration: { langs: ["fr"], why: "French cognate" },
  Collections: { langs: ["fr"], why: "French cognate" },
  Contact: { langs: ["fr"], why: "French cognate" },
  Legal: { langs: ["es"], why: "Spanish cognate" },
  Nutrition: { langs: ["fr"], why: "French cognate" },
  Calories: { langs: ["fr"], why: "French word is Calories" },
  Transactions: { langs: ["fr"], why: "French word is Transactions" },
  "{date} · transactions": { langs: ["fr"], why: "French word is transactions" },
  kcal: { langs: ["es", "pt-BR", "fr"], why: "SI unit symbol" },
  "{grams} g": { langs: ["es", "pt-BR", "fr"], why: "SI unit symbol" },
  "{count} transactions": { langs: ["fr"], why: "French word is transactions" },
  "RevPAN {amount}": {
    langs: ["es", "zh-CN", "pt-BR", "fr", "ru", "ar"],
    why: "industry metric abbreviation plus a placeholder — no translatable words",
  },
  Assistant: { langs: ["fr"], why: "French word is Assistant" },
  WebAssembly: { langs: ["es", "zh-CN", "pt-BR", "fr", "ru", "ar"], why: "platform name" },
  WebGPU: { langs: ["es", "zh-CN", "pt-BR", "fr", "ru", "ar"], why: "platform name" },
  Android: { langs: ["es", "zh-CN", "pt-BR", "fr", "ru", "ar"], why: "platform name" },
  Supabase: { langs: ["es", "zh-CN", "pt-BR", "fr", "ru", "ar"], why: "vendor name" },
  Stripe: { langs: ["es", "zh-CN", "pt-BR", "fr", "ru", "ar"], why: "vendor name" },
  "{date} · {status} {amount}": {
    langs: ["es", "zh-CN", "pt-BR", "fr", "ru", "ar"],
    why: "separator and placeholders only — nothing but punctuation and substituted values",
  },
};

const ROOT = process.cwd();
const DIRS = ["app", "components"];
const SKIP = /(^|\/)(node_modules|\.next|tests)(\/|$)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP.test(full)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every literal first argument to `t()` / `translate()`, with where it came from. */
function literals(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of DIRS.flatMap((dir) => walk(join(ROOT, dir)))) {
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(
      /\b(?:t|translate)\(\s*(?:"([^"\\]{2,300})"|'([^'\\]{2,300})'|`([^`$\\]{2,300})`)/g,
    )) {
      const value = match[1] ?? match[2] ?? match[3];
      if (!value) continue;
      const rel = relative(ROOT, file);
      found.set(value, [...(found.get(value) ?? []), rel]);
    }
  }
  return found;
}

describe("interface translation coverage", () => {
  it("finds the strings the interface actually translates", () => {
    // Sanity check on the extractor itself: if the regex ever stops matching, every assertion
    // below would pass vacuously against an empty set.
    expect(literals().size).toBeGreaterThan(150);
  });

  it("translates every t() literal into every supported language", () => {
    const gaps: string[] = [];
    for (const [literal, files] of literals()) {
      const allowed = IDENTICAL_OK[literal]?.langs ?? [];
      const untranslated = LANGS.filter(
        (lang) => translate(literal, lang) === literal && !allowed.includes(lang),
      );
      if (untranslated.length) {
        gaps.push(`${JSON.stringify(literal)} — ${untranslated.join(", ")} (${files[0]})`);
      }
    }
    expect(gaps, `untranslated literals:\n${gaps.join("\n")}`).toEqual([]);
  });

  it("never returns an empty string for a translated key", () => {
    const blanks: string[] = [];
    for (const literal of literals().keys()) {
      for (const lang of LANGS) {
        if (!translate(literal, lang).trim()) blanks.push(`${JSON.stringify(literal)} — ${lang}`);
      }
    }
    expect(blanks, `blank translations:\n${blanks.join("\n")}`).toEqual([]);
  });

  it("keeps placeholders intact in every translation", () => {
    // A dropped {count} or {type} silently renders a sentence with a hole in it.
    const broken: string[] = [];
    for (const literal of literals().keys()) {
      const placeholders = literal.match(/\{[a-zA-Z]+\}/g) ?? [];
      if (!placeholders.length) continue;
      for (const lang of LANGS) {
        const out = translate(literal, lang);
        for (const token of placeholders) {
          if (!out.includes(token)) broken.push(`${JSON.stringify(literal)} — ${lang} lost ${token}`);
        }
      }
    }
    expect(broken, `broken placeholders:\n${broken.join("\n")}`).toEqual([]);
  });
});

/*
 * The second way English leaks past the guard above.
 *
 * `<Prose>` translates its own children at runtime (`localizeTextNodes` in
 * components/marketing/page-parts.tsx), so the legal pages never call `t()` and the literal
 * scanner cannot see them. That path is real but fragile: the key is the *rendered* text node,
 * so anything the JSX compiler folds into it — a stray em dash, a non-breaking space, an
 * `&apos;` entity — silently stops matching and the paragraph reverts to English.
 *
 * That is not hypothetical: the processors list on /privacy rendered English in every language
 * because `— authentication, …` was one text node while the catalogue held the sentence alone.
 *
 * So scan the prose bodies the same way the browser receives them: split on tags and
 * expressions, collapse whitespace, decode entities, then require a translation.
 */
const PROSE_BLOCK = /<Prose>([\s\S]*?)<\/Prose>/g;

function decodeEntities(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Collapse a raw JSX text run exactly as the JSX compiler does. */
function collapse(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function proseStrings(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of DIRS.flatMap((dir) => walk(join(ROOT, dir)))) {
    const src = readFileSync(file, "utf8");
    for (const block of src.matchAll(PROSE_BLOCK)) {
      for (const piece of block[1].split(/<[^>]*>|\{[^}]*\}/)) {
        const text = collapse(decodeEntities(piece));
        if (!text || !/[a-zA-Z]/.test(text)) continue;
        const rel = relative(ROOT, file);
        found.set(text, [...(found.get(text) ?? []), rel]);
      }
    }
  }
  return found;
}

describe("prose body coverage", () => {
  it("finds the text nodes the prose renderer translates", () => {
    // Guards against the extractor silently matching nothing, which would make the next
    // assertion pass without checking anything.
    expect(proseStrings().size).toBeGreaterThan(40);
  });

  it("translates every rendered prose text node into every supported language", () => {
    const gaps: string[] = [];
    for (const [text, files] of proseStrings()) {
      const allowed = IDENTICAL_OK[text]?.langs ?? [];
      const untranslated = LANGS.filter(
        (lang) => translate(text, lang) === text && !allowed.includes(lang),
      );
      if (untranslated.length) {
        gaps.push(`${JSON.stringify(text)} — ${untranslated.join(", ")} (${files[0]})`);
      }
    }
    expect(gaps, `untranslated prose:\n${gaps.join("\n")}`).toEqual([]);
  });
});

/*
 * Copy that lives in a data module rather than in JSX.
 *
 * The literal scanner only sees `t("…")` written at the call site; a list rendered as `t(item.q)`
 * is invisible to it, and so is anything the FAQ JSON-LD emits. These exports are the single
 * source for /faq and /pricing, so checking them directly is both precise and cheaper than
 * adding another regex pass.
 */
describe("marketing data coverage", () => {
  const strings = [
    ...FAQ_GROUPS.flatMap((group) => [group.title, ...group.items.flatMap((i) => [i.q, i.a])]),
    ...BILLING_FAQ.flatMap((item) => [item.q, item.a]),
    ...PLAN_INCLUDES,
  ];

  it("has a translation for every marketing string", () => {
    const gaps: string[] = [];
    for (const text of strings) {
      const allowed = IDENTICAL_OK[text]?.langs ?? [];
      const untranslated = LANGS.filter(
        (lang) => translate(text, lang) === text && !allowed.includes(lang),
      );
      if (untranslated.length) gaps.push(`${JSON.stringify(text)} — ${untranslated.join(", ")}`);
    }
    expect(gaps, `untranslated marketing copy:\n${gaps.join("\n")}`).toEqual([]);
  });
});
