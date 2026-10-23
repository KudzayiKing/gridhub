# Design system

Everything visual is driven by tokens in `app/globals.css`. There are no hard-coded hex
values in components except where a token genuinely cannot express the intent.

## Brand

| Token | Value | Use |
| --- | --- | --- |
| `--gp-ink` | `#171A18` | Charcoal — primary text, dark surfaces |
| `--gp-ivory` | `#F7F7F2` | Ivory — light background |
| `--gp-sage` | `#C0D4BC` | Sage — the accent, in its most literal form |
| `--gp-slate` | `#6D756D` | Slate — secondary text |
| `--gp-mist` | `#E9EBE4` | Mist — subtle fills, dividers |

The wordmark is the supplied **Gridhub** artwork — a solid `#00d587` tile behind "Grid" with
"hub" set beside it on the bare surface — rendered from
`gridhub-wordmark-on-light.png` (charcoal ink for the ivory surface) and
`gridhub-wordmark-on-dark.png` (white ink for the dark surface), swapped by the `.dark` class
because the tile has to survive the theme change. WebP leads and PNG is the `<picture>`
fallback; both live under `/icons/` so the service worker caches them verbatim offline. It is
deliberately artwork and not Inter ExtraBold text: the tile-behind-a-substring lockup cannot be
rebuilt in CSS without absolute positioning inside a text run.

The logo mark is supplied artwork too, not a drawn glyph: `gridhub-mark-on-light.png`
(charcoal) and `gridhub-mark-on-dark.png` (white) are swapped the same way, because the mark
contains a solid brand-green tile that has to survive the theme change. The same mark is the
favicon and the PWA app icon (`icon-192`, `icon-512`, `maskable-512`, `app/icon.png`,
`app/apple-icon.png`).

`components/brand/logo.tsx` exposes three levels, and the difference matters:

| Export | Renders | Use it for |
| --- | --- | --- |
| `Logo` | G mark **+** wordmark | Every brand lockup in the UI — headers, footer, sign-in, 404 |
| `Wordmark` | wordmark only | Where the mark would be redundant (e.g. next to an existing mark) |
| `LogoMark` | G mark only | Where only the glyph is wanted (favicon-like spots, compact rows) |

`Logo` is the default for any new brand surface. The mark is sized as `height × 1.15` rather
than through its own size table, so the two halves cannot be paired at mismatched sizes — the
wordmark height already encodes the intended optical size.

Earlier revisions set the wordmark in lowercase with a sage full stop. The dot was a typographic
crutch for a lowercase wordmark; with a real mark and a capital G it read as stray punctuation,
especially at phone size.

## Semantic tokens

Components never reference brand tokens directly. They use semantic ones, which swap between
light and dark:

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `--bg` | `#F7F7F2` | `#121214` | Page |
| `--bg-elevated` | `#FDFDFA` | `#17171A` | Raised surface |
| `--bg-subtle` | `#EEF0E9` | `#1D1D21` | Inset fill, hover |
| `--surface` | `rgba(255,255,255,.74)` | `rgba(24,24,28,.76)` | Glass base |
| `--surface-strong` | `rgba(255,255,255,.92)` | `rgba(29,29,34,.94)` | Dialog / sheet |
| `--header` | `rgba(255,255,255,.63)` | `#121214` | Sticky header |
| `--border` | `rgba(23,26,24,.09)` | `rgba(255,255,255,.09)` | Hairline |
| `--fg` | `#171A18` | `#F3F3F5` | Text |
| `--fg-muted` | `#5C645C` | `#B1B1B9` | Secondary text |
| `--fg-subtle` | `#8A918A` | `#86868F` | Labels, captions |
| `--accent` | `#3F5C46` | `#C0D4BC` | Primary action |
| `--accent-fg` | `#FFFFFF` | `#14180F` | Text on accent |
| `--positive` | `#2F6B45` | `#8FD0A4` | Gain, success |
| `--negative` | `#A4442F` | `#E79C88` | Loss, destructive |
| `--warning` | `#8A6A1F` | `#D9BD7A` | Attention |

The dark scale is neutral, not sage-tinted. An earlier palette (`#10130F` / `#171B16` /
`#1C211B`) was derived from the accent colour, so every dark surface carried a green cast. The
green now lives only in `--accent` and its derived tokens, where it is a highlight rather than
the room. `--header` is opaque and exactly the page colour in dark mode, so the sticky bar reads
as part of the canvas with only its hairline separating it; in light mode it keeps the
translucent wash it always had.

These are exposed to Tailwind through `@theme inline` as `bg-bg`, `text-fg`,
`text-fg-muted`, `border-line`, `bg-accent`, `text-positive` and so on. `--border` is
aliased to `--color-line` because `border-border` reads badly.

**Sign convention.** Positive and negative colours are used for *state*, not for stock-market
direction. Gridhub reports a user's own money, so "income up" is green. A market-data
feature would need the opposite convention (red for up) in Chinese markets; that is a
per-view decision, not a token.

## Typography

| Role | Family | Notes |
| --- | --- | --- |
| Display / headings | Manrope | `letter-spacing: -0.02em`, weight 600 |
| Body / UI | Inter | 13–15px is the working range |
| Numerals | Inter, `tabular-nums` | Applied to tables, `.tnum`, and number inputs |

Tabular numerals are not decoration. In a column of currency values, proportional digits
make the decimal points jump, which makes scanning for the large number slower. `table`,
`.tnum` and `input[type=number]` all get `font-variant-numeric: tabular-nums`.

Type scale in practice: `display-xl` for the hero, `text-2xl` for page titles, `text-[14px]`
for card headings, `text-[13px]` for body, `text-[11px]` for labels. The 11px floor exists
because financial tables need density without becoming illegible.

## Glass

Four surfaces, in increasing opacity:

| Class | Blur | Use |
| --- | --- | --- |
| `.glass` | 18px | Cards, panels |
| `.glass-strong` | 26px | Dialogs, sheets, dropdowns, popovers |
| `.glass-panel` | 14px | Inline panels inside a card |
| `.gp-card` | 18px + sheen | The default card, with a hairline top highlight |

`.glass-sheen` adds a 1px gradient highlight along the top edge, which is what makes a flat
translucent rectangle read as a physical surface.

Glass degrades in three documented ways, all automatic:

```css
@media (prefers-reduced-transparency: reduce) { /* solid elevated background */ }
@supports not (backdrop-filter: blur(1px)) { /* solid elevated background */ }
@media print { /* white, no shadow */ }
```

A translucent surface over an unknown backdrop is a legibility risk, so the fallback is a
solid colour rather than a weaker blur.

### Liquid glass — parked

`.liquid-btn` (`components/ui/liquid-button.tsx`) is a heavy, iOS-style treatment, ported from an
external reference. **It is currently applied nowhere.** It was trialled on the dashboard's quick
actions and removed at the request of the product owner; the component and its CSS are left in
place, unused, so the experiment can be resumed without a rebuild. It is opt-in, not the default
for `Button`, and it is **not** the same thing as the `.glass` surfaces above — those are flat
translucent panes; this one has an edge that catches light.

Four ingredients, in order of how much they matter:

1. **The conic rim.** A masked pseudo-element (`::after`, `mask-composite: exclude`) draws a
   1px frame: a conic gradient of dark arcs on a white base. On hover the whole rim rotates
   (`--angle-1` from `-75deg` to `-125deg`), which is the animation people notice first.
2. **The travelling specular.** A second pseudo on the label paints a wide diagonal highlight
   that sweeps across the face on hover. `mix-blend-mode: screen`, so it only brightens.
3. **The fill and inset shadows.** Two `farthest-corner` radial speculars anchored at the
   top-left and bottom-right corners plus `inset` shadows top and bottom — the bottom inset is
   what makes the pane look thick rather than painted on.
4. **The blur.** `blur(clamp(1px, 0.125em, 4px))`, which collapses to almost nothing on hover so
   the button feels like it settles onto the surface.

Everything is sized in `em` against a font-size set on the shell, so `size="sm" | "md" | "lg"` is
the only sizing decision in the component and proportions never drift. That is also what makes it
responsive: the whole button scales with type.

Dark mode swaps the rim's arcs from black to white. That single swap is the entire adaptation —
a black rim on `#121214` is invisible, and the rest of the treatment (inset highlights, the
screen-blended sweep) works unchanged on a dark surface.

Anatomy, because three nested elements are required rather than stylistic:

```
.liquid-btn            positioning shell, pointer-events: none (also the :has() hover proxy)
  .liquid-btn__shadow  contact shadow behind the pill
  .liquid-btn__core    the interactive element: fill, insets, conic rim
    .liquid-btn__label text, and the travelling highlight
```

The shell cannot receive hover itself — it is `pointer-events: none` so the oversized shadow area
is not a ring of dead clickable space — so every stateful rule hangs off
`:has(.liquid-btn__core:hover)`. That is also what lets the shadow tighten and the rim rotate in
sync with the button.

Touch devices pin both angles (`@media (hover: none) and (pointer: coarse)`) and drop the 3D press:
a rotating rim under a thumb reads as jitter.

```tsx
<LiquidButton href="/app/money/budget" icon="plus" size="sm">Add expense</LiquidButton>
```

Renders a `next/link` when given `href`, a `<button>` otherwise. `Button` and `LiquidButton` are
deliberately separate — `Button` covers the whole product, `LiquidButton` is a statement control
for calls to action.

**Two things tried and reverted:**

- **The travelling highlight at rest.** Sized `200% 200%` with `background-position: 0% 50%`, its
  band sat at 70% of a `-45deg` gradient line — and that lands inside the *visible* left half of
  the image, so it lit the middle of every pill while idle. Fixed by parking the band outside the
  window by construction: the image is `300% 300%`, the resting position shows only the top-left
  ninth, and the 42%–58% stop range cannot be sampled by any resting pixel. Verified by sampling
  the pill's face: 23–27 across the middle (the page colour) against 112 top-left and 132
  bottom-right.
- **A `.glass-liquid` card treatment** (masked gradient rim, 152° fill, 26px blur, with a `glass`
  prop on `Card`/`MetricCard`) was applied across the dashboard first. It read as a *slightly*
  nicer card rather than as glass — with a flat canvas behind it there is nothing to refract, so
  the blur was inert and the rim was the only thing carrying the effect. It was removed in favour
  of this button. If it ever comes back, the lesson is that glass needs something behind it; the
  reference component ships with a dotted-grid backdrop for exactly that reason.

Quick actions now render with `Button variant="secondary" size="sm"` and an `iconTrigger="hover"`
icon, which keeps the strip's rhythm without the glass.

## Motion

| Class | Behaviour |
| --- | --- |
| `.press` | `scale(0.97)` on `:active`, 140ms |
| `.lift` | `translateY(-2px)` + shadow on hover, 220ms, only where `hover: hover` |
| `.shimmer` | Loading skeleton sweep |

Timing curve: `cubic-bezier(0.22, 1, 0.36, 1)` — a fast start with a long settle, which reads
as responsive rather than floaty.

`@media (prefers-reduced-motion: reduce)` collapses all animation and transition durations to
`0.001ms` globally. This is belt-and-braces: `AnimatedIcon` also checks
`isReducedMotion()` in JavaScript before calling `startAnimation()`, and the settings page
exposes an in-app "Reduce motion" switch for users whose OS setting they cannot change.

## Dark mode

Class-based, driven by `next-themes` writing `.dark` on `<html>`. Tailwind v4 defaults `dark:`
to a media query, so the variant is rebound explicitly:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Without that line the in-app toggle would be ignored whenever the OS preference disagreed
with it — a subtle bug that only shows up on a machine whose OS is set opposite to the user's
choice.

## Layout

- Max content width: `max-w-6xl` for the workspace, `max-w-3xl` for prose.
- Card radius: `20px` (`--gp-card-radius`); controls use `8–12px`; pills use `rounded-full`.
- Spacing follows a 4px base; the working gaps are `gap-2` (8px), `gap-3` (12px), `gap-4`
  (16px), `gap-5` (20px).
- Mobile: bottom navigation with `env(safe-area-inset-bottom)` padding; tables become card
  lists below `sm`.
- Touch targets are at least 40px on mobile; icon buttons use `size="icon-sm"` (32px) only in
  desktop-density toolbars.

## Accessibility

- `:focus-visible` gets a 2px outline in `--ring` with 2px offset, globally.
- Every icon-only control carries an `aria-label`; decorative icons are `aria-hidden`.
- Dialogs use Radix, which handles focus trapping and `Esc`. Every dialog has a title, and a
  `sr-only` description when none is visible.
- `InlineAlert` uses `role="status"`, escalating to `role="alert"` for destructive tones.
- Colour is never the only signal: variance shows a sign and a label, not just red text.

## Anti-patterns

- No gradient buttons, no purple, no drop shadows on text.
- No icon-only destructive action without a confirmation dialog.
- No animation on data values — a number that counts up is a number you cannot read.
- No glass on top of glass more than two levels deep; the blur stack destroys legibility.
