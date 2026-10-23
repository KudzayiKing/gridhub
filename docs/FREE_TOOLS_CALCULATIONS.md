# Free Tools calculation conventions

All calculator functions are pure functions in `lib/free-tools.ts`; money totals use the shared `decimal.js` helpers and round half-up to two decimal places at calculation/presentation boundaries. Inputs are clamped to nonnegative values where a negative value has no valid meaning. Percentage denominators of zero return `null` (`N/A` in the UI).

- **Debt:** reuses `simulateDebt` from `lib/calc/money.ts`. Monthly interest is APR/12 on opening balance, rounded to cents monthly. Minimums are paid first; extra is allocated to the snowball or avalanche target. Final payment is capped. Simulation horizon is 720 months. Comparison uses the existing minimum-only estimate.
- **Budget:** totals the supplied income amounts and nonnegative planned expenses. Category share is expense / all expenses. 50/30/20 is a comparison guideline only; no actual transactions are implied.
- **Rental:** monthly and annual operating costs are converted to monthly values. Vacancy reduces rent. NOI excludes debt service; cash flow subtracts standard fixed-rate amortizing debt service. Cap rate is annual NOI / price. Cash-on-cash is annual pre-tax cash flow / upfront cash invested. No appreciation or tax benefit is modeled.
- **Savings:** annual rate is nominal and divided by 12; monthly compounding and end-of-month contributions are assumed. Zero rate uses a straight-line contribution. Estimates are capped to a 1,200-month input horizon.
- **Profit:** margin = gross profit / net selling price; markup = gross profit / unit cost. Gross profit excludes unentered overhead and tax. Target-price solving is only defined for margins below 100%.
- **Invoice:** line discounts apply before invoice discount. Invoice discount is subtracted before tax; all discounted subtotal is treated as taxable. Fees are added after tax. Tax convention is illustrative and jurisdiction-dependent. Final totals use half-up cent rounding.

These estimates are for planning, not lender quotes, tax advice, guaranteed returns, or jurisdiction-specific compliance.
