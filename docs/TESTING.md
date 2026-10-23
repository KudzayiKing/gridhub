# Testing

## Status

`tests/calculations.test.ts` contains 68 assertions covering all sixteen tools' calculation
engines plus the money primitives. **All 68 pass** (`npm test`, ~1s, Node 22).

The suite earned its keep on its first real run — it caught three genuine defects that
compiling and type-checking both missed:

| Failure | Verdict |
| --- | --- |
| `variancePct` returned 20, test expected 25 | **Test was wrong.** Variance is expressed against the category budget (300/1500), which is the reading a user expects. Test corrected to 20 with a comment. |
| `avgMonthlySpending` returned `0` for a user with no records | **Code was wrong.** Dividing zero expenses by one complete month produced a confident "$0", which says "you spend nothing" rather than "there is nothing to average". Now `null` when there is no expense data. |
| `contentSummary().ideas` returned `0` with one idea present | **Code was wrong.** The period filter keyed on `scheduledDate ?? publishedDate`, and an idea has neither — so every idea and undated draft was invisible in a period view. Undated pipeline items now always count. |

That last one is the kind of bug a type checker cannot find: the types were satisfied, the
number was simply wrong. It is the argument for having the tests at all.

### A dependency note

`vitest` needs `vite` as a *direct* dependency in this project (it is not hoisted), and
`vitest@5` requires `@types/node@^22`. `package.json` pins both. `vitest.config.mts` uses an
`.mts` extension because Vite loads a `.ts` config as CommonJS unless the package is
`"type": "module"`.

## What the suite covers

| Area | Assertions |
| --- | --- |
| Money primitives | `round2(0.1 + 0.2) === 0.3`, `round2(1.005) === 1.01`, `pct` returns `null` on a zero denominator, `sum` over decimals |
| Budget | Transfers and savings excluded from income/expense; posted-only; category variance; savings rate |
| Paycheck | A bill counted once, not twice; daily allowance floor; next pay date |
| Debt | Snowball vs avalanche ordering; non-amortising detection; balance never negative; final payment exact |
| Savings | Progress, required monthly, `null` when no target date |
| Net worth | Holdings at market; per-currency grouping; no delta without a prior snapshot |
| Bookkeeping | Owner draws excluded from expenses; loan proceeds excluded from revenue |
| Inventory | Moving weighted average; stock never negative; low-stock threshold inclusive |
| Sales | AOV null on zero orders; invoiced vs collected separated |
| Invoicing | Line-level rounding; discount before tax; partial payments; overdue days |
| Cash flow | Certainty weights; shortfall week; runway |
| Wedding | Seats not rows; committed vs actual vs paid; seating warnings |
| Property | Occupancy, ADR, RevPAN; overlap detection with checkout-day semantics |
| Nutrition | Scaling; recipe servings floor; macro split sums to 100 |
| Projects | Progress, overdue, dependency cycle detection |
| Habits | Streak skips unscheduled days; engagement rate uses expected occurrences |
| Content | Awaiting-confirmation detection; counts by status |

The assertions are chosen for the cases that are usually wrong: zero denominators, empty
arrays, negative-safe arithmetic, and the off-by-one in date ranges.

## Running

```bash
npm test              # vitest run
npm run test:watch    # watch mode
npm run typecheck     # tsc --noEmit
npm run lint
npm run build
```

`vitest.config.ts` sets `jsdom`, `globals: true`, the `@` alias, and loads
`vitest.setup.ts` (which adds `@testing-library/jest-dom` matchers and a `matchMedia`
polyfill — `AnimatedIcon` and `next-themes` both read it).

## What is not tested

This is the more useful list.

| Gap | Risk |
| --- | --- |
| No component tests | `DataTable`, `RecordForm`, `AnimatedIcon` behaviour is unverified |
| E2E never executed | `playwright.config.ts` and `tests/e2e/public.spec.ts` exist and Chromium is installed, but the suite has not been run to completion. The spec's slug list was corrected to the real marketing slugs (`annual-budget-planner`, not `budget`) — untested specs rot quickly |
| No cross-user authorisation tests | RLS is believed correct; it has not been proven by a second account |
| No database integration tests | The migration has never been applied |
| No accessibility automation | `axe` is not wired up |
| No offline/sync integration test | The outbox has not been exercised against a live endpoint |
| No Stripe webhook test | No signature fixture, no replay test |

## Manual verification procedure

When a shell is available, this is the order that finds the most bugs per minute:

1. `npm install` — confirm it completes cleanly. `@hookform/resolvers` is pinned to `^5`
   because v6 pulls a peer (`effect@^4`) that conflicts.
2. `npm run typecheck` — fix errors before anything else. An un-compiled codebase of this size
   will have some; the highest-risk areas are the `lib/tools/*` column generics, the metric
   switch in `tool-view.tsx`, and the Stripe webhook's object shapes.
3. `npm run build` — catches server/client boundary mistakes that `tsc` cannot.
4. `npm test` — report the actual pass/fail count. Do not report "tests pass" from a run that
   errored during collection.
5. `npm run dev` and walk each of the sixteen tools: create a record, edit it, delete it,
   export CSV, reload, confirm persistence.
6. DevTools → Offline. Repeat. Confirm the indicator reads "pending", not "synced".
7. Two browsers, one account: create a record in A, confirm it appears in B after sync.
8. Apply the migration, then verify RLS with a second account: attempt to read the first
   account's rows through the anon key and confirm zero results.
9. Stripe test-mode checkout, then check `/admin/billing` for a processed event.

Step 8 is the one people skip. It is also the one where a mistake is a data breach.

## Conventions for new tests

- Test the calculation, not the component. Calculations are pure and cheap; components need a
  DOM and a store.
- Every `null`-returning function needs a zero-denominator case.
- Every date range needs a boundary case: same day, adjacent day, reversed order.
- Money assertions compare rounded values, never raw floats.
- A test that would pass with the function returning `0` for everything is not a test.
