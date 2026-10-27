/**
 * Colour maths for OS chrome.
 *
 * The status bar and the home-indicator strip are painted by the platform, above our content —
 * no CSS can blur them. The most a web app can do is make their colour *equal* the glass band
 * sitting next to them, so the seam disappears. That band is translucent, so the colour the eye
 * sees is the composite of the glass over the page, which is what these helpers compute.
 */

export type Rgba = [number, number, number, number];

/**
 * Parse a CSS colour as reported by `getComputedStyle`.
 *
 * Both serialisations must be handled. `getPropertyValue("--header")` returns the token as the
 * engine chose to write it: Chromium hands back `#ffffffa1` for `rgba(255,255,255,.63)`
 * (8-digit hex), WebKit tends to return `rgba(…)`. A parser that knows only one form fails
 * silently — the caller falls back to the page colour and the chrome keeps a mismatched tint.
 */
export function parseColor(input: string): Rgba | null {
  const value = input.trim();
  if (!value) return null;

  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const digits =
      hex[1].length <= 4 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    if (digits.length !== 6 && digits.length !== 8) return null;
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
      digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
    ];
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgb) return null;
  const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  const alpha = parts.length > 3 && !Number.isNaN(parts[3]) ? parts[3] : 1;
  return [parts[0], parts[1], parts[2], Math.min(1, Math.max(0, alpha))];
}

/** Flatten a translucent colour onto an opaque one, as `#rrggbb`. */
export function flattenOver(foreground: string, backdrop: string): string | null {
  const fg = parseColor(foreground);
  const bg = parseColor(backdrop);
  if (!fg || !bg) return null;
  const channel = (i: number) => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3]));
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, "0")).join("")}`;
}

/** Two colours as the browser would report them, for tests and for `getComputedStyle` input. */
export function toRgbString(color: Rgba): string {
  const [r, g, b, a] = color;
  return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}
