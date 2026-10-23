import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { missingIconKeys } from "@/components/icons/icon-registry";
import { TOOL_ICON } from "@/components/icons/tool-icons";

/**
 * Guard against the "silent broken icon" failure mode.
 *
 * Historically the icon resolver had a catch-all fallback that rendered a decorative
 * sparkle for any unknown key — so a typo'd or renamed key looked fine in dev (one
 * console.warn) and shipped as a sparkle or, worse, an empty gap. That hid five broken
 * keys at once, including the `pin`/`pinOff` pair that powers the pin-to-dashboard control.
 *
 * This test statically scans the source for every icon key actually used by the app and
 * asserts each one resolves to a real component in the installed `@animateicons/react/lucide`
 * package. If someone adds `icon="frobnicate"` or renames `PinIcon` without updating
 * ICON_ALIASES, the build's type check won't catch it but this test will — loudly, with the
 * offending keys listed.
 */

const SOURCE_ROOTS = ["components", "app", "lib"].map((dir) => join(process.cwd(), dir));

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

function collect(re: RegExp): Set<string> {
  const found = new Set<string>();
  for (const root of SOURCE_ROOTS) {
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) found.add(m[1]);
    }
  }
  return found;
}

// <AnimatedIcon name="x" ... /> and <IconLabel name="x" ... /> — the direct consumers.
const NAME_RE = /(?:AnimatedIcon|IconLabel)\b[^>]*?\bname="([^"]+)"/g;
// icon="x" / iconRight="x" on any tag — covers Button, MetricCard, DropdownItem, Card*,
// EmptyState, InlineAlert, Panel, ChartContainer, etc. All of these funnel into AnimatedIcon.
const ICON_RE = /(?<![\w-])(?:icon|iconRight)="([^"]+)"/g;

describe("icon registry guard", () => {
  const used = new Set<string>([
    ...collect(NAME_RE),
    ...collect(ICON_RE),
    // Tool -> icon map and its fallback.
    ...Object.values(TOOL_ICON),
    "blocks",
  ]);

  const keys = [...used].sort();

  it(`found ${keys.length} distinct icon keys in use`, () => {
    // Sanity check so an empty scan (e.g. wrong cwd) fails loudly instead of passing vacuously.
    expect(keys.length, "no icon keys were found — check the scan roots / cwd").toBeGreaterThan(10);
  });

  it("every icon key used in the app resolves to a real AnimateIcons component", () => {
    const missing = missingIconKeys(keys);
    expect(missing, `Missing / unresolvable icon keys: ${missing.join(", ")}`).toEqual([]);
  });
});
