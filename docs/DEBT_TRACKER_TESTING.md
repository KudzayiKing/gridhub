# Debt Tracker verification

Run focused reporting and calculator tests:

```sh
npx vitest run tests/debt-tracker.test.ts tests/reporting-paycheck.test.ts
```

The debt reporting tests cover monthly month-end and leap-year dates, missing dates, biweekly recurrence, paid/partial/overdue statuses, actual-only history, estimated progress, payment split validation, and in-app reminder lead times.

For manual verification, create monthly and biweekly debts with known dates, add a planned occurrence, record a full and partial payment, change a paycheck assignment, and compare Snowball with Avalanche. Confirm a recorded payment does not change the debt balance by itself. Check calendar views on desktop and mobile widths and verify the Overview donut stays left of the six-metric summary card on wide layouts.
