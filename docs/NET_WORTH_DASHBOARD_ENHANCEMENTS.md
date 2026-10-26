# Net Worth Dashboard Enhancements

## Current dashboard

`components/tools/net-worth-dashboard.tsx` renders the wealth summary with six KPIs grouped in one card on the right and the asset allocation donut on the left. The dashboard then shows net worth growth, liabilities allocation, portfolio allocation, portfolio value history, assets versus liabilities, investment gains and losses, and allocation drift.

The underlying asset, holding, snapshot, and target records remain in the existing offline-first `net-worth` collections. The existing editable ledger tabs remain available. New fields are additive JSON record properties, so no database migration is required.

## Data rules

- Only records in the selected display currency contribute to totals. Other currencies are called out and excluded because the app has no verified FX rate provider.
- Holdings linked to an asset record are treated as account detail and are not added to assets a second time. Their market value remains visible in portfolio value.
- An asset record's category is its primary asset grouping. A holding's saved asset class is its primary investment grouping.
- Charts use recorded valuations and snapshots. Current values are not backfilled into earlier dates.
- The dashboard does not fetch market prices or generate investment recommendations.

## Limitations

Automatic links to the Budget, Savings, Debt, and Property tools are not currently available. Users should not enter the same cash or debt balance in multiple tools. Manual asset records with identical names are not automatically deduplicated because they may represent distinct accounts.
