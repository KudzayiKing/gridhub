# Animated icons

Every interactive icon in Gridhub is an official
[AnimateIcons](https://animateicons.in/icons/lucide) Lucide icon from
`@animateicons/react/lucide` (v0.12.1). No `lucide-react`, no hand-drawn SVG icons in
interactive positions, no static icon fonts.

## The package's real API

Verified against `node_modules/@animateicons/react/dist/lucide.d.ts`, because guessing here
produces a broken build:

| Fact | Detail |
| --- | --- |
| Export shape | Named `*Icon` components, e.g. `HouseIcon`, `ChartLineIcon`, `WalletIcon` |
| What it renders | A `<div>` wrapper containing the animated SVG |
| Props | `size?: number`, `duration?: number`, `isAnimated?: boolean`, `color?: string` |
| Everything else | Standard `HTMLAttributes<HTMLDivElement>`, minus `color`/drag/animation handlers |
| Ref handle | `{ startAnimation(): void; stopAnimation(): void }` |
| Per-icon import | `@animateicons/react/lucide/<kebab-name>-icon` |
| Peer deps | `react`, `react-dom`. `motion` is bundled as a dev dep — it must exist in your app |

Two consequences that are easy to get wrong:

1. **There is no `strokeWidth` prop.** The stroke geometry is baked into each icon. Passing
   one is silently ignored, which is why `AnimatedIcon` accepts it for call-site
   compatibility but deliberately does not forward it.
2. **It renders a `div`, not an `svg`.** Nesting one inside a `<p>` is invalid HTML. Use it
   inside a button, a span, or a flex container.

## The abstraction

`components/icons/animated-icon.tsx` is the only place that talks to the package.

```tsx
<AnimatedIcon name="wallet" size={20} trigger="both" />
<AnimatedIcon name="trash" label="Delete record" />
```

Props:

| Prop | Default | Purpose |
| --- | --- | --- |
| `name` | — | Logical key resolved by the registry |
| `size` | `20` | Pixel size |
| `duration` | `1` | Animation seconds |
| `color` | `currentColor` | Inherits the text colour by default |
| `trigger` | `both` | `hover` · `click` · `both` · `mount` · `none` |
| `label` | — | When set, the icon becomes `role="img"` with an `aria-label`; otherwise `aria-hidden` |
| `disabled` | — | Suppresses animation without blocking the click |

Behavioural guarantees:

- **Never blocks the action.** Handlers call the caller's handler *after* starting the
  animation, and the whole animation call is wrapped in `try/catch`. An icon that throws must
  not eat a click.
- **Keyboard parity.** `onFocus` plays the animation for `hover`, `both` and `click` triggers,
  so a keyboard user sees the same feedback as a mouse user. Relying on `mouseenter` alone
  makes the feature invisible to anyone not using a pointer.
- **`mount` actually fires on mount.** It runs in an effect after the ref is attached, not on
  `pointerdown` (the original bug: `trigger="mount"` was wired to pointer events and therefore
  never animated on appearance).
- **Reduced motion respected twice.** The CSS layer collapses transitions, and the component
  checks `isReducedMotion()` before calling `startAnimation()` so the animation is not even
  queued.

## The registry

`components/icons/icon-registry.ts` maps a logical key to candidate export names and resolves
at runtime:

```ts
wallet:      ["WalletIcon", "WalletMinimalIcon", "WalletCardsIcon"]
line-chart:  ["ChartLineIcon", "LineChartIcon", "ChartSplineIcon"]
home:        ["HouseIcon", "HomeIcon"]
```

Why runtime resolution instead of direct named imports:

- Lucide renames icons between major versions (`Home` → `House`, `LineChart` → `ChartLine`,
  `KanbanSquare` → `SquareKanban`). A direct import breaks the build on upgrade; an alias
  chain degrades to the next candidate.
- The module is imported as a namespace (`import * as AnimateLucide`), so a missing export
  becomes a `undefined` lookup rather than a module-resolution failure.
- There is deliberately **no catch-all**. An unresolved key resolves to `null`, `AnimatedIcon`
  renders an empty correctly-sized span, and a single `console.error` names the key. This used to
  fall back to `SparklesIcon`, which meant a typo'd key looked like a design choice and hid five
  broken keys at once. The sparkle is now banned from the UI outright: `sparkles` is not a
  registered key.

The cost is that a genuinely wrong key fails quietly in production (an empty gap, not a broken
build). That is why the diagnostic below exists and why it should be run before release.

## Verifying the registry

`missingIconKeys(keys)` returns every logical key with no resolvable candidate, and
`availableIconCount()` reports how many icons the installed package exposes. Run both against
`Object.keys(ICON_ALIASES)`:

```ts
import { ICON_ALIASES, missingIconKeys, availableIconCount } from "@/components/icons/icon-registry";

console.log(availableIconCount());                    // sanity: should be in the hundreds
console.log(missingIconKeys(Object.keys(ICON_ALIASES))); // must be []
```

**This has not been run for this build** — the shell was unavailable. Until it returns `[]`, treat
an empty icon slot as an unresolved key rather than a design choice. (`tests/icon-registry.test.ts`
now enforces this automatically: it scans the source for every icon key actually used and fails the
suite if any of them has no resolvable component.)

## Tool icons

`components/icons/tool-icons.tsx` holds `TOOL_ICON: Record<ToolId, string>`, so all sixteen
tools are guaranteed to have an icon by the type system — a new `ToolId` without an entry is
a compile error, not a runtime blank.

## Rules for contributors

1. Never import from `@animateicons/react` directly in a component. Go through
   `AnimatedIcon`.
2. Never use `lucide-react`, an emoji, or an inline `<svg>` for an interactive icon.
3. Add new keys to `ICON_ALIASES`, not to a component.
4. Icon-only buttons need an `aria-label` on the *button*; use `label` on the icon only when
   the icon is the accessible name.
5. If an icon is purely decorative next to text, leave `label` off so it stays `aria-hidden`.
6. Prefer `trigger="hover"` inside a button that already animates on click, to avoid two
   animations competing.
