# gridhub.

**One hub. Everything organized.**

Sixteen focused applications for money, business, life and work — sharing one design system, one data layer, one dashboard and one subscription. Local-first, offline-capable, installable.

---

## Status — read this first

The application source is complete: 16 tools, the calculation engines, the local-first data layer, the sync engine, billing, the marketing site, the authenticated workspace, the operator surface, and the SQL schema with row-level security.

The build chain now runs green on Node 22:

| Check | Result |
| --- | --- |
| `npm install` | Clean |
| `npm run typecheck` | **Pass** — zero errors |
| `npm run lint` | **Pass** — 0 errors, 24 warnings (unused imports, one `useCallback` suggestion) |
| `npm run build` | **Pass** — 56/56 routes, Turbopack, ~9s compile |
| `npm test` | **Pass** — 68/68 assertions |
| Runtime smoke | `next start` serves `/`, `/pricing`, `/tools`, `/app`, `/admin`, `/login`, `/collections` with 200 |
| Playwright E2E | Config and specs written; browsers installed, **suite not yet executed** |
| Supabase migrations | Authored, **not applied** to the project |
| Stripe | Code complete, **no products or price IDs created** |
| Google OAuth | **Not configured** in the Supabase dashboard |

What that does and does not mean. Compiling, type-checking, linting and unit-testing prove the code is internally consistent and that the calculation engines behave as specified. They prove nothing about the integrations: no migration has been applied, no webhook has been received, no OAuth round trip has happened, and no two-device sync has been observed. `docs/RELEASE_CHECKLIST.md` lists exactly what still must pass before launch.

Where the app cannot do something, it says so in the UI instead of pretending: an unconfigured Stripe shows "checkout is not configured", an unconfigured Supabase falls back to documented local-only mode, and the operator pages render a dash rather than a fabricated count.

---

## The sixteen tools

| Collection | Tools |
| --- | --- |
| **Money** | Budget · Paycheck · Debt · Savings · Net worth |
| **Business** | Bookkeeping · Inventory · Sales · Invoicing · Cash flow |
| **Life** | Wedding · Property · Nutrition |
| **Work** | Projects · Habits · Content |

Every tool stores real records, computes from them with decimal-safe arithmetic, supports search / filter / sort / CSV export, and works with the network off.

---

## Stack

- **Next.js 16.4** App Router, React 19.3, TypeScript strict
- **Tailwind CSS 4** via the Turbopack loader (`@tailwindcss/turbopack`), class-based dark mode
- **Radix UI** primitives wrapped in local `components/ui/*`
- **AnimateIcons** (`@animateicons/react/lucide`) for every interactive icon, behind one abstraction
- **Dexie / IndexedDB** as the system of record on the client
- **decimal.js** for all money arithmetic — no binary floats touch a currency amount
- **Supabase** for auth, Postgres and row-level security
- **Stripe** for subscriptions, Checkout, the customer portal and verified webhooks
- **Vitest** + Testing Library for the calculation suite

---

## Getting started

```bash
cp .env.example .env.local     # then fill in the values you actually have
npm install
npm run dev                    # http://localhost:3000
```

The app runs with **no** environment variables at all. In that mode it is a local-only
PWA: data lives in IndexedDB, sign-in is skipped, and billing is disabled with an explicit
notice. That is the fastest way to evaluate the tools.

To enable accounts, sync and billing, follow:

1. [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) — project, migration, RLS
2. [`docs/GOOGLE_AUTH.md`](docs/GOOGLE_AUTH.md) — OAuth client and redirect allowlist
3. [`docs/STRIPE_SETUP.md`](docs/STRIPE_SETUP.md) — products, prices, webhook endpoint

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest calculation suite |
| `npm run test:e2e` | Playwright (config included; specs are a starting point, see `docs/TESTING.md`) |

---

## Project layout

```
app/
  (marketing)            /, /tools, /collections, /pricing, /how-it-works, /offline,
                         /about, /faq, /contact, /privacy, /terms, /refund-policy
  app/                   authenticated workspace: dashboard, tools, explore, billing, settings
  app/[...slug]/         resolves a tool route from the catalog to its view
  admin/                 operator surface: overview, users, tools, subscriptions,
                         billing events, system, support
  api/                   sync, entitlements, account deletion, Stripe checkout/portal/webhook
  login/, onboarding/    auth entry and the five-step setup
components/
  icons/                 the AnimateIcons abstraction — every icon goes through here
  ui/                    buttons, fields, cards, overlays
  data/                  the generic table and schema-driven form
  tools/                 the shared tool shell and per-tool overviews
  shell/, marketing/, admin/, charts/, brand/
lib/
  catalog.ts             single source of truth for the 16 tools and 4 collections
  plans.ts               the 5 tiers and their Stripe env keys
  money.ts               decimal helpers, formatting, currency list
  calc/                  the calculation engines, one module per collection
  tools/                 per-tool field and column definitions
  db.ts, store.ts        Dexie schema, repository, pub/sub, React bindings
  sync.ts                outbox flush and cursor pull
  types.ts               every domain record interface
supabase/migrations/     schema, RLS policies, triggers, seed data
tests/                   calculation tests
docs/                    architecture and operations
```

---

## Design

Charcoal `#171A18` · Ivory `#F7F7F2` · Sage `#C0D4BC` · Slate `#6D756D` · Mist `#E9EBE4`.

Manrope for headings, Inter for body, tabular numerals on every figure. Glassmorphism is
restrained — a soft surface, a hairline sheen, a blurred backdrop that degrades to a solid
surface when the user prefers reduced transparency or the browser lacks `backdrop-filter`.
Light, dark and system themes are all supported.

See [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

---

## Documentation

| Document | Covers |
| --- | --- |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Layers, data flow, why local-first |
| [DATABASE](docs/DATABASE.md) | Tables, relationships, RLS model |
| [SUPABASE_SETUP](docs/SUPABASE_SETUP.md) | Project, migration, keys |
| [GOOGLE_AUTH](docs/GOOGLE_AUTH.md) | OAuth client, redirect URLs |
| [STRIPE_SETUP](docs/STRIPE_SETUP.md) | Products, prices, webhook |
| [BILLING_ENTITLEMENTS](docs/BILLING_ENTITLEMENTS.md) | Plans, tool limits, grants |
| [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) | Tokens, type, surfaces, motion |
| [ANIMATED_ICONS](docs/ANIMATED_ICONS.md) | The icon abstraction and its rules |
| [DASHBOARD_WIDGETS](docs/DASHBOARD_WIDGETS.md) | Widget model and dashboard rules |
| [TOOL_REGISTRY](docs/TOOL_REGISTRY.md) | How a tool is defined and routed |
| [TOOL_SPECIFICATIONS](docs/TOOL_SPECIFICATIONS.md) | What each of the 16 tools does |
| [SHARED_DATA_MODELS](docs/SHARED_DATA_MODELS.md) | Record shapes and conventions |
| [PWA_OFFLINE](docs/PWA_OFFLINE.md) | Service worker, caching, install |
| [SYNC_ENGINE](docs/SYNC_ENGINE.md) | Outbox, versions, conflicts |
| [SECURITY](docs/SECURITY.md) | Trust boundaries, RLS, secrets |
| [TESTING](docs/TESTING.md) | What is tested and what is not |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Build, host, migrate, monitor |
| [RELEASE_CHECKLIST](docs/RELEASE_CHECKLIST.md) | The gate before launch |

---

## Honesty rules this codebase follows

1. No fabricated testimonials, user counts, revenue figures or benchmarks — anywhere, including marketing previews, which are labelled "Example".
2. No simulated payment success. Checkout fails closed when a price is not configured.
3. No "all changes saved" while the outbox is non-empty.
4. No migration marked applied unless it ran.
5. No feature marked complete unless it works; unfinished items are listed in the release checklist.
