#!/usr/bin/env node
/**
 * i18n audit.
 *
 * Two questions, because the failure modes are different:
 *
 *   A. Which files render user-visible English but never call `t()` at all?
 *      (This is how the Quick add dialog shipped with zero translations.)
 *   B. Which `t("…")` literals are missing from the catalog for some language?
 *      (This is "partially missing" — the call is there, the entry is not.)
 *
 * Output is JSON so it can be diffed between runs.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DIRS = ["app", "components"];
const SKIP = /(^|\/)(node_modules|\.next|__tests__|tests)(\/|$)/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP.test(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(join(ROOT, d)));

// A file "uses i18n" if it imports the hook or the raw function.
const usesI18n = (src) => /\buseI18n\b|\btranslate\s*\(/.test(src);

// Strings that are never user-visible copy.
const IGNORE_PROPS = new Set([
  "className", "id", "htmlFor", "key", "href", "src", "alt", "type", "name", "value",
  "role", "variant", "size", "icon", "as", "to", "from", "target", "rel", "method",
  "accept", "inputMode", "autoComplete", "pattern", "fill", "stroke", "d", "viewBox",
  "transform", "xmlns", "strokeWidth", "strokeLinecap", "strokeLinejoin", "style",
]);

// Props whose value is user-visible.
const COPY_PROPS = new Set([
  "title", "description", "label", "placeholder", "aria-label", "ariaLabel",
  "submitLabel", "emptyLabel", "caption", "helperText", "hint", "text", "message",
  "confirmLabel", "cancelLabel", "heading", "subtitle", "tooltip", "eyebrow",
]);

const WORDISH = /^[A-Z][A-Za-z0-9'’,.!?&%/·—–-]*(?: [^\s<>{}=]{1,40}){1,}/;

const results = [];
const literalCalls = new Set();

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);

  // ---- B: collect t("…") / translate("…") literals -------------------------
  for (const m of src.matchAll(/\b(?:t|translate)\(\s*(?:"([^"\\]{2,300})"|'([^'\\]{2,300})'|`([^`$\\]{2,300})`)/g)) {
    const value = m[1] ?? m[2] ?? m[3];
    if (value) literalCalls.add(value);
  }

  if (usesI18n(src)) continue;

  // ---- A: visible English in a file that never translates ------------------
  const hits = [];

  // JSX text nodes: >Some visible words<
  for (const m of src.matchAll(/>\s*([A-Z][^<>{}\n]{2,120}?)\s*</g)) {
    const text = m[1].trim();
    if (!WORDISH.test(text)) continue;
    if (/^[A-Z_]+$/.test(text)) continue; // constants
    hits.push({ kind: "jsx", text });
  }

  // String props that are copy.
  for (const m of src.matchAll(/([A-Za-z-]+)\s*=\s*"([^"]{2,200})"/g)) {
    const [, prop, val] = m;
    if (IGNORE_PROPS.has(prop)) continue;
    if (!COPY_PROPS.has(prop)) continue;
    if (!WORDISH.test(val)) continue;
    hits.push({ kind: `prop:${prop}`, text: val });
  }

  if (hits.length) {
    // De-duplicate, keep order.
    const seen = new Set();
    const unique = hits.filter((h) => {
      const k = h.kind + "|" + h.text;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    results.push({ file: rel, count: unique.length, hits: unique });
  }
}

results.sort((a, b) => b.count - a.count);

const out = {
  filesWithoutI18n: results,
  filesWithoutI18nTotal: results.length,
  literalsUsed: [...literalCalls].sort(),
  literalsUsedTotal: literalCalls.size,
};

writeFileSync(join(ROOT, ".i18n-audit.json"), JSON.stringify(out, null, 2));

console.log(`files with visible English but no i18n: ${results.length}`);
console.log(`distinct t() literals in source: ${literalCalls.size}`);
console.log("\ntop offenders:");
for (const r of results.slice(0, 25)) console.log(`  ${String(r.count).padStart(3)}  ${r.file}`);
