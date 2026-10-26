# Savings goal calculations

## Current balance and goal progress

For each goal:

`current balance = max(0, opening balance + contributions - withdrawals)`

`remaining = max(0, target amount - current balance)`

`funding percentage = current balance / target amount × 100`

The hero donut caps its saved and remaining segments at the target (0–100%), while the labels show the true funding percentage and disclose overfunding.

## Monthly contribution required

The dashboard uses the selected goal's remaining amount and whole calendar months until its target date. If the target date has passed and the goal is incomplete, the required monthly value is unavailable and the goal is marked behind schedule.

With the default no-interest assumption, monthly need is remaining divided by months. If a user explicitly enters an annual rate, the calculation uses a monthly rate of APR/12 and the standard end-of-month annuity payment formula. This is an estimate, not an investment return promise.

## Progress status

A schedule comparison requires both an explicit start date and target date. Expected progress is a straight-line trajectory from opening balance on the start date to the target amount on the target date. A tolerance of 1% of target (minimum one currency unit) avoids noisy status changes. Without enough dates, the status says insufficient data. Withdrawals and changed balances can move a goal behind schedule.

## Projected completion

The optional completion date uses the explicit planned contribution and frequency, current balance, and optional monthly APR/12 assumption. If no contribution is entered, the plan cannot reach the target, or the simulation exceeds 1,200 months, no date is shown. Monthly dates clamp to the final valid day of short months.

Only actual recorded movements affect current balances and historical charts. Planned contributions do not change a goal balance.

