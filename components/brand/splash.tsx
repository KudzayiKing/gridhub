"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/*
 * The Gridhub splash.
 *
 * The mark is the Geometric G — eight rounded tiles separated by thin gaps, with the bottom-right
 * tile in brand green. The geometry below was *measured* from
 * /public/icons/gridhub-mark-on-light.png (128×128) by connected-component analysis: each tile's
 * box and each corner's radius is the value found in the artwork, not an approximation. So the
 * splash is the same mark, just vector.
 *
 * Why the tiles are inline rather than <img src="/icons/gridhub-mark.svg">: an SVG loaded through
 * <img> is isolated — CSS and SMIL inside it never run — so the tiles could not be lit one at a
 * time. The identical geometry also ships as a real vector at /icons/gridhub-mark.svg for uses
 * that do not need per-tile animation.
 *
 * Ink is `currentColor`, which is near-black in light mode and near-white in dark mode — the
 * "black G for light, white G for dark" rule — so the mark needs no separate asset per theme.
 */

/** Per-corner radius, clockwise from top-left. */
type Corners = [number, number, number, number];

interface Tile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: Corners;
}

/* Measured from the 128×128 artwork. The outer corners are heavily rounded, the inner joins are
 * essentially square (1–2), and the green tile is the least rounded of the four. The artwork's
 * outer corners are superelliptical, so a circular arc is capped at half the short side — the
 * values below are the ones that render, verified against the PNG at 97% area overlap with no
 * missing ink. The remaining difference is a 1–2px sliver along each corner arc. */
const TILES: Tile[] = [
  { id: "A1", x: 2, y: 0, w: 38, h: 36, r: [18, 1, 1, 2] },
  { id: "B1", x: 43, y: 0, w: 41, h: 36, r: [1, 1, 1, 1] },
  { id: "C1", x: 87, y: 0, w: 39, h: 36, r: [1, 18, 2, 1] },
  { id: "A2", x: 2, y: 40, w: 38, h: 49, r: [1, 1, 1, 1] },
  /* The G's chin: the only tile not on the outer ring. */
  { id: "C2", x: 67, y: 57, w: 59, h: 32, r: [2, 3, 2, 2] },
  { id: "A3", x: 2, y: 93, w: 38, h: 35, r: [2, 1, 1, 18] },
  { id: "B3", x: 43, y: 93, w: 41, h: 35, r: [1, 1, 1, 1] },
  { id: "C3", x: 88, y: 93, w: 38, h: 35, r: [1, 2, 13, 1] },
];

/** Rounded rect with a different radius per corner — `<rect rx>` only takes one. */
function tilePath({ x, y, w, h, r }: Tile): string {
  const cap = Math.min(w, h) / 2;
  const clamp = (v: number) => Math.max(0, Math.min(v, cap));
  const tl = clamp(r[0]);
  const tr = clamp(r[1]);
  const br = clamp(r[2]);
  const bl = clamp(r[3]);
  const arc = (radius: number, toX: number, toY: number) =>
    radius > 0 ? `A${radius},${radius} 0 0 1 ${toX},${toY}` : "";

  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`,
    arc(tr, x + w, y + tr),
    `V${y + h - br}`,
    arc(br, x + w - br, y + h),
    `H${x + bl}`,
    arc(bl, x, y + h - bl),
    `V${y + tl}`,
    arc(tl, x + tl, y),
    "Z",
  ].join("");
}

/*
 * The ring the light travels, in the order the brief describes: start at the top-right tile, move
 * grid by grid to the left along the top, down the left side, then right along the bottom to the
 * green corner. Light mode walks the same ring backwards ("vice versa").
 */
const RING = ["C1", "B1", "A1", "A2", "A3", "B3", "C3"];

/** The tile that is green at rest — the mark's fixed accent, not part of the sweep. */
const ACCENT = "C3";

const STEP_MS = 170;

/*
 * Reduced motion is an external store, not effect-managed state: subscribing to the media query
 * keeps it correct if the OS setting changes while the splash is on screen, and it avoids the
 * set-state-in-effect pattern (a render, then a second render, for a value known at mount).
 */
function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (!mq) return () => {};
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const readReducedMotion = () =>
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** The server has no media queries; the client re-reads on hydration. */
const serverReducedMotion = () => false;

export function Splash({ minDuration = 3400 }: { minDuration?: number }) {
  const { resolvedTheme } = useTheme();
  const [step, setStep] = React.useState(0);
  const [phase, setPhase] = React.useState<"in" | "out" | "gone">("in");
  const reduceMotion = React.useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    serverReducedMotion,
  );

  const reversed = resolvedTheme === "light";
  const ringLength = RING.length;

  React.useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % ringLength);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [ringLength, reduceMotion]);

  // Auto-dismiss after the light has made a couple of laps.
  React.useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("out"), minDuration);
    const t2 = window.setTimeout(() => setPhase("gone"), minDuration + 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [minDuration]);

  if (phase === "gone") return null;

  const ring = reversed ? [...RING].reverse() : RING;
  // Reduced motion parks on the mark at rest: only the green corner lit.
  const lit = reduceMotion ? ACCENT : ring[step];

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center bg-[var(--bg)] transition-opacity duration-[420ms] ease-out",
        phase === "out" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <svg
        viewBox="0 0 128 128"
        width={200}
        height={200}
        role="presentation"
        className="block text-fg"
      >
        {TILES.map((tile) => {
          const green = tile.id === lit || tile.id === ACCENT;
          return (
            <path
              key={tile.id}
              d={tilePath(tile)}
              fill={green ? "var(--brand)" : "currentColor"}
              style={{ transition: reduceMotion ? "none" : `fill ${STEP_MS + 90}ms ease` }}
            />
          );
        })}
      </svg>
    </div>
  );
}
