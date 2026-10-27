import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { flattenOver } from "@/lib/color";

/*
 * `--chrome-solid` and `--nav-solid` exist so that three things agree:
 *
 *   1. the colour the scrims paint at the very top / bottom of each bar,
 *   2. the colour `theme-color` reports to the platform, and
 *   3. the colour the bar actually composites to where nothing is scrolled under it.
 *
 * If (1) and (3) drift, the scrim becomes a visible band. If (2) and (1) drift, the seam under
 * the status bar comes back — which is the exact bug this token was introduced to fix. These
 * are hard-coded hex values in CSS, so nothing else would catch a stale one.
 */

const ROOT = process.cwd();
const CSS = readFileSync(join(ROOT, "app/globals.css"), "utf8");

/** Extract the declaration block for a selector, matching braces. */
function block(selector: string): string {
  const at = CSS.indexOf(selector);
  if (at === -1) throw new Error(`selector not found: ${selector}`);
  const start = CSS.indexOf("{", at) + 1;
  let depth = 1;
  let i = start;
  while (i < CSS.length && depth > 0) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") depth--;
    i++;
  }
  if (depth !== 0) throw new Error(`unbalanced braces after ${selector}`);
  return CSS.slice(start, i - 1);
}

function token(source: string, name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(source);
  if (!match) throw new Error(`token not found: --${name}`);
  return match[1].trim();
}

describe("chrome solid tokens", () => {
  const light = block(":root");
  const dark = block(".dark {");

  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s: --chrome-solid is the header composited over the canvas", (_label, src) => {
    expect(flattenOver(token(src, "header"), token(src, "bg"))).toBe(
      token(src, "chrome-solid").toLowerCase(),
    );
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s: --nav-solid is the bottom bar composited over the canvas", (_label, src) => {
    expect(flattenOver(token(src, "bottom-nav-bg"), token(src, "bg"))).toBe(
      token(src, "nav-solid").toLowerCase(),
    );
  });

  it("reports the light chrome colour as the first-paint theme-color", () => {
    // The server-rendered default has to match the token, or the PWA flashes the wrong colour
    // until the effect runs.
    const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
    const expected = token(light, "chrome-solid").toLowerCase();
    expect(layout.toLowerCase()).toContain(`themecolor: "${expected}"`);
  });

  it("keeps the manifest theme_color in step with the token", () => {
    const manifest = readFileSync(join(ROOT, "app/manifest.ts"), "utf8");
    const expected = token(light, "chrome-solid").toLowerCase();
    expect(manifest.toLowerCase()).toContain(`theme_color: "${expected}"`);
  });
});
