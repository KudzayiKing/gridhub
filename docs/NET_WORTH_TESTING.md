# Net Worth Testing

The calculation test suite covers assets minus liabilities, holding value and cost basis, dated snapshot comparisons, zero-baseline percentage handling, negative-to-positive percentage handling, currency isolation, missing cost basis, and linked brokerage holdings that must not be double counted.

Focused validation commands:

```sh
npx vitest run tests/calculations.test.ts
npm run typecheck
npx eslint components/tools/net-worth-dashboard.tsx components/tools/tool-view.tsx lib/calc/money.ts lib/tools/money.tsx lib/chart-widgets.tsx
```

UI behavior should also be checked in light/dark themes and at mobile width: summary placement, donut interactions, snapshot duplicate prevention, chart range controls, holding filters, target validation, and export output. No market-price or FX integration is present to test.
