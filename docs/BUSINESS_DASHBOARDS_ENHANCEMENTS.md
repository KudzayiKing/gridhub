# Business dashboard enhancements

Bookkeeping, Inventory, Sales, Invoice Manager, and Cash Flow now use a shared desktop composition with the primary chart on the left and a single KPI card on the right. The card contains up to six values calculated from existing local-first records.

- Bookkeeping uses the existing cash-basis transaction model. Revenue and expenses are not accrual estimates. Uncategorized activity is exposed for cleanup.
- Inventory valuation uses the existing moving weighted-average cost selector; top-selling product performance is not inferred from stock reductions.
- Sales uses saved sale records, with discounts and returns applied by the existing sale totals function.
- Invoice status slices are disjoint; only linked payment records count as collections. Issued invoices are not treated as cash received.
- Cash Flow reuses the saved scenario and existing certainty weights. Forecast values remain clearly projected.

Supporting panels reuse trend, ranking, aging, and forecast visualizations. Current ledger tables and forms remain below the dashboard.

Limitations: this enhancement does not add automatic bank reconciliation, supplier demand forecasts, payment-provider ingestion, cash-flow scenario controls, or platform integrations.
