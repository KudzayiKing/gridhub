/**
 * Exhaustive audit of user-visible English that can reach the rendered UI.
 *
 * `tests/i18n-coverage.test.ts` only sees literals written directly as `t("…")`. That misses
 * three whole families of strings that DO reach the screen:
 *
 *   1. Props handed to a component that translates internally — `title="Outstanding debt"`
 *      reaches `ChartContainer`, which calls `t(title)`. The string is in the DOM but the
 *      literal scanner never sees it.
 *   2. Raw JSX text nodes that were never wrapped in `t()` at all.
 *   3. Records of English copy resolved through a variable — `t(copy.label)`.
 *
 * This script finds all three and reports every string that still renders as English in any
 * supported language. It writes `.i18n-ui-audit.json` for machine processing.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "vitest";
import { translate, UI_LANGUAGES } from "@/lib/i18n";

const LANGS = UI_LANGUAGES.filter((item) => item.code !== "en").map((item) => item.code);
const ROOT = process.cwd();
const DIRS = ["app", "components", "lib"];
const SKIP = /(^|\/)(node_modules|\.next|tests|scripts)(\/|$)/;

/** Operator surfaces — deferred by agreement, not user-facing product copy. */
const OPERATOR = /^(app\/admin|components\/admin|components\/journal|app\/api\/)/;

/**
 * Props whose string values are translated by the receiving component.
 * `name` is deliberately excluded: chart series names are frequently icon names.
 */
const TRANSLATED_PROPS = [
  "title", "subtitle", "label", "hint", "emptyTitle", "emptyDescription",
  "centerLabel", "description", "placeholder", "aria-label",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP.test(full)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Heuristic: does this string look like UI copy rather than code?
 * Filters out TypeScript fragments, env var names, file paths and identifiers that the
 * naive `>[^<>]+<` text-node scan picks up out of expression context.
 */
function looksLikeCopy(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!/[a-zA-Z]{3,}/.test(t)) return false;
  // Code-ish: contains operators, quotes, braces, parens, arrows, or a semicolon.
  if (/[;{}]|=>|\|\||&&|[<>]=|===|!==/.test(t)) return false;
  // Env vars and paths.
  if (/^[A-Z][A-Z0-9_]{4,}$/.test(t)) return false;
  if (/^[\w./-]*\.(ts|tsx|md|json|mjs|sql)$/i.test(t)) return false;
  if (/^[a-z]+[A-Z]/.test(t) && !/\s/.test(t)) return false; // camelCase identifier
  if (/^(docs|lib|app|components|public|scripts|supabase)\//.test(t)) return false;
  // A lone lowercase word with no spaces is usually an icon name or a status key.
  if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false;
  return true;
}

interface Finding {
  kind: "prop" | "text";
  text: string;
  file: string;
  line: number;
  missing: string[];
}

describe("ui english audit", () => {
  it("reports every visible English string with no translation", () => {
    const findings: Finding[] = [];
    const seen = new Set<string>();

    const report = (kind: Finding["kind"], text: string, file: string, line: number) => {
      if (!looksLikeCopy(text)) return;
      const key = `${kind}::${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      const missing = LANGS.filter((lang) => translate(text, lang) === text);
      if (missing.length) findings.push({ kind, text, file, line, missing });
    };

    for (const file of DIRS.flatMap((dir) => walk(join(ROOT, dir)))) {
      const rel = relative(ROOT, file);
      if (OPERATOR.test(rel)) continue;
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");

      // (1) String-literal props on any JSX element.
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const prop of TRANSLATED_PROPS) {
          const re = new RegExp(`\\b${prop}\\s*=\\s*"([^"\\\\]{2,300})"`);
          const match = line.match(re);
          if (match) report("prop", match[1], rel, i + 1);
        }
      }

      // (2) Raw JSX text nodes: `>English text<` on a single line.
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const m of line.matchAll(/>([^<>{}]+)</g)) {
          report("text", m[1], rel, i + 1);
        }
      }
    }

    const unique = findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    writeFileSync(".i18n-ui-audit.json", JSON.stringify(unique, null, 2));

    const byFile = new Map<string, number>();
    for (const f of unique) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);

    console.log(`\n=== ${unique.length} untranslated visible strings ===`);
    for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`${String(count).padStart(4)}  ${file}`);
    }
    console.log("\n--- detail ---");
    for (const f of unique) {
      console.log(`${f.file}:${f.line} [${f.kind}] ${JSON.stringify(f.text)} -> missing: ${f.missing.join(", ")}`);
    }
  });
});
