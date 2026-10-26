# Savings dashboard verification

Run the focused calculation, reporting, and widget tests:

```sh
npx vitest run tests/savings-dashboard.test.ts tests/calculations.test.ts tests/chart-widgets.test.ts
```

Coverage includes contributions, withdrawals, opening balances, zero targets, overfunding, trajectory requirements, required monthly amount with and without interest, projected completion and month-end clamping, negative record normalization, date-filtered activity, and balance trends carrying earlier movements into the selected range.

Manual checks: select different goals and verify the donut and detail panel change; check no-goal and no-history empty states; enter an emergency baseline and change the coverage preset; add and edit a contribution and withdrawal; use trend date ranges and the all-goals filter; inspect both themes and mobile layout; and confirm the existing Goals and Contributions tables and export remain available.

No Supabase schema migration is needed because new plan fields are optional properties on existing synced goal JSON records.

