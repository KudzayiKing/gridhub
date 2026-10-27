import { describe, expect, it } from "vitest";
import { flattenOver, parseColor } from "@/lib/color";

/*
 * These functions decide the colour of the OS status bar. They run once, in an effect, and
 * produce no error when they fail — they just return null and the caller silently keeps the
 * page colour. That is exactly how a "make the status bar match" change shipped as a no-op:
 * Chromium reports `--header` as `#ffffffa1`, the first parser only knew `#rgb`/`#rrggbb`, and
 * the fallback quietly did nothing.
 */

describe("parseColor", () => {
  it("reads the serialisations getComputedStyle actually returns", () => {
    // Chromium: rgba(255,255,255,.63) comes back as 8-digit hex.
    expect(parseColor("#ffffffa1")).toEqual([255, 255, 255, 161 / 255]);
    // WebKit: the same token as rgba().
    expect(parseColor("rgba(255, 255, 255, 0.63)")).toEqual([255, 255, 255, 0.63]);
    // Opaque tokens come back as 6-digit hex.
    expect(parseColor("#f7f7f2")).toEqual([247, 247, 242, 1]);
    expect(parseColor("rgb(18, 18, 20)")).toEqual([18, 18, 20, 1]);
  });

  it("expands shorthand hex", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255, 1]);
    expect(parseColor("#0000")).toEqual([0, 0, 0, 0]);
  });

  it("returns null rather than a wrong colour", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("not-a-colour")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
  });
});

describe("flattenOver", () => {
  it("matches the composite the header actually paints", () => {
    // 0.63 white over the light canvas #f7f7f2 — verified against a rendered pixel.
    expect(flattenOver("rgba(255, 255, 255, 0.63)", "#f7f7f2")).toBe("#fcfcfa");
    // Dark: the wash is the canvas colour, so the composite is the canvas itself.
    expect(flattenOver("rgba(18, 18, 20, 0.66)", "#121214")).toBe("#121214");
  });

  it("accepts the 8-digit hex Chromium reports", () => {
    expect(flattenOver("#ffffffa1", "#f7f7f2")).toBe("#fcfcfa");
    expect(flattenOver("#121214a8", "#121214")).toBe("#121214");
  });

  it("is a no-op for an opaque foreground", () => {
    expect(flattenOver("#00d587", "#f7f7f2")).toBe("#00d587");
  });

  it("returns null when either colour is unparseable", () => {
    expect(flattenOver("nope", "#f7f7f2")).toBeNull();
    expect(flattenOver("#ffffff", "nope")).toBeNull();
  });
});
