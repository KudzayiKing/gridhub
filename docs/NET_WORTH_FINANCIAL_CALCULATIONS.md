# Net Worth Financial Calculations

- **Total assets** = positive asset records in the selected currency + market value of unlinked holdings in that currency.
- **Total liabilities** = outstanding liability records in the selected currency.
- **Net worth** = total assets − total liabilities.
- **Holding market value** = quantity × manually entered unit price.
- **Portfolio value** = sum of holding market values, including holdings linked to parent brokerage assets.
- **Unrealized gain/loss** is calculated only for holdings with a positive entered cost basis: market value − cost basis. Holdings without cost basis are unavailable, not treated as zero-cost investments.
- **Asset-to-debt ratio** = assets ÷ liabilities. Zero liabilities display “No tracked debt.”
- **Net worth change** = current net worth − most recent earlier snapshot in the selected currency. Percentage change is omitted when the baseline is zero or negative, or current net worth is negative.
- **Allocation drift** = actual holding percentage − user-defined target percentage. Targets are shown only when they total 100% within 0.5 percentage points.
- **Money-weighted return (XIRR)** uses dated contributions (negative investor cash flows), withdrawals and non-reinvested distributions (positive investor cash flows), external fees (negative), and the current manually valued portfolio as the ending value. Internal reinvestments and fees already reflected in portfolio value are excluded.
- **Time-weighted return (TWR)** compounds changes between dated investment valuation snapshots. It is withheld when any period contains an external cash flow because the app does not have valuations immediately before and after that flow. Duplicate dates and non-positive starting valuations are also unavailable.

Money totals use the existing decimal-safe helpers. No currency conversion or live price is inferred. Returns depend on complete, accurate transaction and valuation history; unavailable results are explained instead of being guessed.
