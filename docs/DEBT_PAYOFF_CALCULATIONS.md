# Debt payoff calculation assumptions

Projections reuse `simulateDebt` from `lib/calc/money.ts` and are estimates, not lender payoff quotes.

- Interest accrues monthly on the opening balance at APR ÷ 12. Monthly interest is rounded to cents.
- The simulator applies the same total minimum payment budget and additional monthly amount to both strategies.
- Snowball allocates released funds to the smallest balance; Avalanche targets the highest APR.
- Final payments are capped at the remaining balance. Balances never fall below zero; freed payments roll to the next strategy target.
- The simulation uses a 720-month horizon and flags a plan as non-amortizing when the overall budget does not exceed the initial monthly interest estimate.
- Biweekly minimum payments are annualized as 26 payments divided by 12 for monthly projections. Calendar due dates remain every 14 days from the entered anchor.
- Fees, promotional rate periods, daily interest accrual, lender-specific compounding, payment posting delays, and variable rates are not modeled.
- Currency values use the application's decimal arithmetic and two-decimal rounding.

Payment history reports only user-recorded amounts. Principal-vs-interest charts show only explicitly entered splits. Progress estimated as current balance plus recorded principal is labeled as an estimate and can be inaccurate after new borrowing, fees, refinancing, or balance corrections.
