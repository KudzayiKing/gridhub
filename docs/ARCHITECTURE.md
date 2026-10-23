# Architecture

## The shape of the problem

Gridhub is sixteen small applications that must feel like one product. A wedding budget
and an inventory ledger have almost nothing in common at the domain level, but they share
everything else: a record list with search, filter, sort and export; a form to add and edit;
a strip of computed metrics; an overview panel; persistence; offline behaviour; sync.

Building sixteen bespoke UIs would produce sixteen places to fix the same bug. So the
architecture separates **what a tool is** (declarative) from **how a tool behaves** (shared).

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│  Routes          app/**                                        │
│  Marketing, workspace, admin, API handlers                     │
├──────────────────────────────────────────────────────────────┤
│  Composition     components/tools/*                            │
│  LedgerTool shell, per-tool overview panels, metric strips      │
├──────────────────────────────────────────────────────────────┤
│  Declarations    lib/tools/*                                   │
│  Tabs = fields + columns + labels. Pure data, no behaviour.     │
├──────────────────────────────────────────────────────────────┤
│  Domain          lib/calc/*, lib/types.ts                      │
│  Pure functions over arrays of records. No React, no I/O.       │
├──────────────────────────────────────────────────────────────┤
│  Persistence     lib/db.ts, lib/store.ts                        │
│  Dexie schema, repository, pub/sub, React bindings             │
├──────────────────────────────────────────────────────────────┤
│  Transport       lib/sync.ts, app/api/*                        │
│  Outbox flush, cursor pull, entitlements, Stripe webhooks       │
├──────────────────────────────────────────────────────────────┤
│  Platform        lib/supabase/*, middleware.ts                 │
│  Auth session, RLS-enforced reads, service-role operations      │
└──────────────────────────────────────────────────────────────┘
```

Dependencies point downward only. `lib/calc/*` never imports React or Dexie, which is why
it is directly unit-testable and why the same function can run in the browser today and on
a server later.

## How a tool renders

1. `app/app/[...slug]/page.tsx` matches the URL path against `TOOLS[].route` in
   `lib/catalog.ts`. An unknown path is a 404 — there is no dynamic "any tool" fallback.
2. It renders `<ToolView toolId>`, which calls `useToolData(toolId)` to read every local
   record for that tool, grouped by collection.
3. `buildTabs(toolId, data)` returns the tool's tab definitions — pure data.
4. `LedgerTool` renders the header, the metric strip, the overview, the tab bar, and one
   `TabPanel` per active tab. Each panel owns its own `useCollection` subscription.
5. `TabPanel` hands the tab's `fields` to `RecordForm` and its `columns` to `DataTable`.

Adding a field to a tool is a one-line change in `lib/tools/*`. It appears in the form, the
table, the CSV export and the search index at once.

## Why local-first

A budgeting tool that stops working on a train is not a budgeting tool. IndexedDB is the
system of record on the client: a write is durable the moment it commits locally, and
synchronisation is a background concern rather than a precondition for using the app.

This inverts the usual failure modes in a way that matters for honesty:

- The UI can never be "empty because the network failed" — it reads from disk.
- A failed sync does not lose data; it leaves the outbox non-empty, which the UI shows.
- Conflicts are detectable, because every record carries a version.

The cost is that "saved" and "synced" are different states, and the product has to say
which one it means. `components/shell/sync-indicator.tsx` exists for exactly that reason.

## Money is not a float

`0.1 + 0.2` is `0.30000000000000004` in IEEE 754. A ledger that accumulates that error is
wrong, and a wrong ledger destroys trust faster than a missing feature.

Every monetary value goes through `decimal.js` (`lib/money.ts`), with a single rounding
policy (`ROUND_HALF_UP`, 2dp at the boundary). Percentages and ratios that would divide by
zero return `null`, and the UI renders "N/A" rather than `Infinity` or `NaN`.

Amounts are stored as **positive magnitudes** with an explicit `type`
(`income | expense | transfer | savings`). Direction is a property of the row, not the sign
of the number, which removes an entire class of "did I already negate this?" bugs.

## Server and client responsibilities

| Concern | Where | Why |
| --- | --- | --- |
| Reading the user's own data | Client, from IndexedDB | Must work offline |
| Deciding what a user may access | Server | A client check is a suggestion |
| Writing entitlements | Server (webhook) | Money must not be client-asserted |
| Signing offline grants | Server (HMAC) | A client-signed grant is forgeable |
| Cross-user reads | Server, service role, admin only | RLS would otherwise block them |
| Formatting money | Shared (`lib/money.ts`) | One formatter, one rounding rule |

The client is trusted to render. It is never trusted to authorise.

## Rendering strategy

`cacheComponents` is deliberately **off**. All user data is client-side; the only server
dynamic reads are the Supabase session cookie in `app/app/layout.tsx` and the auth callback.
Cache Components would require every `cookies()` read to sit inside `<Suspense>` or a
`'use cache'` scope, forcing an async-shell split with no benefit on these routes. See the
comment in `next.config.ts`.

Charts on the dashboard are hand-rolled SVG (`components/charts/trend.tsx`) rather than a
charting library. Recharts is a dependency for heavier in-tool charts, but the dashboard
renders on the server first and a library that measures the DOM in an effect produces
hydration mismatches. A `<path>` computed from numbers does not.

## Known architectural limits

- **Single-user workspaces.** The schema has `workspace_members`, but no UI invites anyone.
  Sharing is modelled, not implemented.
- **No server-side calculation.** Every figure is computed on the client from local records.
  Correct for a local-first app; wrong if a future feature needs authoritative server totals.
- **Conflict resolution is last-writer-wins with a version guard.** The server rejects a
  stale write; it does not merge fields. Merging is a design decision nobody has needed yet.
- **No background sync.** Sync runs on load, on reconnect and on visibility change. There is
  no service-worker background sync, so a closed tab does not upload.
