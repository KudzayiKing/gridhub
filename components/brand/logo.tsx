import Image from "next/image";
import { cn } from "@/lib/utils";

/*
 * Two crops of the same artwork, not one recoloured glyph: the mark has a solid brand-green
 * tile that has to survive the theme switch. The charcoal tiles would disappear on the dark
 * surface and the white tiles would disappear on the light one, so each theme gets the cut
 * that was drawn for it.
 *
 * `dark:hidden` / `dark:block` is deliberate. Swapping the `src` from React state would need a
 * `mounted` guard (the server does not know the resolved theme) and would therefore flash the
 * wrong mark on first paint. CSS resolves it before the first frame instead. Both files are
 * ~14 kB, and the hidden one is display:none, so the cost is one extra request.
 *
 * `unoptimized` matters for offline: the service worker caches by path under /icons/, and an
 * optimiser URL (/_next/image?url=…&w=…&q=…) would never match that rule, so the logo would be
 * a broken image the moment the app went offline. The files are already sized and tiny.
 */
const MARK = {
  onLight: "/icons/gridhub-mark-on-light.png", // charcoal artwork
  onDark: "/icons/gridhub-mark-on-dark.png", // white artwork
} as const;

export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src={MARK.onLight}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="size-full object-contain dark:hidden"
      />
      <Image
        src={MARK.onDark}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="hidden size-full object-contain dark:block"
      />
    </span>
  );
}

/*
 * The wordmark is the brand artwork the designer supplied, not typeset text.
 *
 * Why the artwork and not an Inter ExtraBold recreation: the lockup is a solid #00d587 tile
 * sitting behind "Grid" with "hub" set beside it on the bare surface. Rebuilding that in CSS
 * means absolutely positioning a green block under a substring of a text node — it breaks the
 * moment the text wraps, reflows at a different font metric, or is read by a screen reader as
 * one run. The artwork is 658×153 with transparency where the surface shows through, so it
 * composites cleanly on both themes and scales without redrawing.
 *
 * WebP first, PNG as the fallback inside <picture>: the WebP is ~4 kB against ~10 kB for the
 * PNG, and every browser that can install this PWA decodes WebP. A plain <img> inside
 * <picture> is used rather than next/image because (a) next/image cannot express a format
 * fallback without its optimiser, and (b) the optimiser URL would never match the service
 * worker's /icons/ cache rule, breaking the logo offline — the same reason LogoMark is
 * unoptimized. Both variants are pre-cached in the shell, so first paint offline is correct.
 *
 * Height, not width, drives the lockup: the artwork is a fixed 658:153 aspect, so the width
 * follows from the height and there is no layout shift between the two theme variants.
 */
const WORDMARK = {
  onLight: "/icons/gridhub-wordmark-on-light", // charcoal "hub", white-free artwork for ivory
  onDark: "/icons/gridhub-wordmark-on-dark", // white "hub" artwork for the dark surface
} as const;

const WORDMARK_ASPECT = 658 / 153;

function WordmarkArt({
  variant,
  height,
  visibility,
}: {
  variant: keyof typeof WORDMARK;
  height: number;
  visibility: string;
}) {
  const base = WORDMARK[variant];
  return (
    <picture className={cn("block", visibility)}>
      <source srcSet={`${base}.webp`} type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element -- <picture> format fallback plus a verbatim /icons/ path the service worker caches; next/image supports neither without its optimiser. */}
      <img
        src={`${base}.png`}
        alt="Gridhub"
        width={Math.round(height * WORDMARK_ASPECT)}
        height={height}
        className="block h-auto w-full"
      />
    </picture>
  );
}

/* Heights are tuned to the lockups they replace: `md` matches the old mark-plus-text header,
 * `xl` is the phone header bar, `lg` is the sign-in card. The tile in the artwork is
 * full-bleed, so the rendered height is also the height of the green block. */
const SIZES = {
  sm: 16,
  md: 22,
  lg: 30,
  xl: 26,
} as const;

export type LogoSize = keyof typeof SIZES;

/*
 * The full brand lockup: the Geometric G mark, then the "Grid hub" wordmark.
 *
 * The mark is a separate asset from the wordmark rather than one combined image, so the two
 * are joined with flex alignment. `align-items: center` is deliberate — the wordmark canvas is
 * full-bleed on its green tile while the letters sit inside it, so top-aligning would make the
 * mark ride high against the tile and bottom-aligning would drop it below the baseline.
 *
 * The mark is sized as a multiple of the wordmark height instead of carrying its own size
 * table. The wordmark height already encodes the intended optical size, so deriving the mark
 * from it makes it impossible for a caller to pair, say, an `lg` wordmark with an `sm` mark.
 * The 1.15 factor and 0.42em-ish gap are set from the measured artwork: the mark's ink runs
 * x2..125 of a 128px canvas (near full-bleed) while the wordmark's cap height is 117 of 153,
 * so the mark needs a small multiplier to optically match the letters.
 */
export function Logo({ className, size = "md" }: { className?: string; size?: LogoSize }) {
  const height = SIZES[size];
  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: Math.round(height * 0.42) }}
    >
      <LogoMark size={Math.round(height * 1.15)} />
      <Wordmark size={size} />
    </span>
  );
}

export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: keyof typeof SIZES;
}) {
  const height = SIZES[size];
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ height, width: Math.round(height * WORDMARK_ASPECT) }}
    >
      <WordmarkArt variant="onLight" height={height} visibility="dark:hidden" />
      <WordmarkArt variant="onDark" height={height} visibility="hidden dark:block" />
    </span>
  );
}
