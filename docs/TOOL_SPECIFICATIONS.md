# Tool specifications

Sixteen tools. For each: the question it answers, the records it holds, and the calculation
that must be right.

---

## Money

### 1. Budget Planner — `/app/money/budget`

**Answers:** Where did this month's money actually go, and am I over in any category?

Records: `accounts`, `categories`, `transactions`, `budgets`.

Key calculation — `budgetSummary()`:
- Only `status: "posted"` counts. Pending rows are visible but excluded from totals.
- `transfer` and `savings` are **not** income and **not** expense. Moving $500 to savings is
  not spending, and counting it as such makes every month look worse than it was.
- `savingsRate = savingsTransfers / income`, `null` when income is zero (renders "N/A").
- Category variance is `budget − spent`, positive meaning under budget.
- `avgMonthlySpending` excludes the current partial month, otherwise every month looks like a
  spending collapse on the 2nd.

### 2. Paycheck Planner — `/app/money/paycheck`

**Answers:** Of this paycheck, what is already committed, and what is safe to spend per day?

Records: `schedules`, `paychecks`, `allocations`, `bills`.

Key calculation — `paycheckSummary()`:
- A recurring bill is counted **once** per period: paid if a matching allocation exists,
  otherwise planned. Counting both double-books the rent.
- `remaining = available − planned − paid`, floored at zero for the daily allowance.
- `dailyAllowance = remaining / days until next pay date`, using `nextPayDate()` which handles
  semi-monthly and bi-weekly schedules rather than assuming monthly.

### 3. Debt Payoff — `/app/money/debt`

**Answers:** When am I actually debt-free, and which order gets me there soonest?

Records: `debts`, `payments`.

Key calculation — `simulateDebt(strategy)`:
- Deterministic monthly simulation, `snowball` (smallest balance first) or `avalanche`
  (highest rate first).
- Monthly rate = annual / 12; interest rounded to 2dp each month so the schedule matches what
  a lender would bill.
- The final payment is reduced to the exact remaining balance — a payoff schedule that
  overpays by $0.01 is wrong.
- Balances never go negative.
- **Non-amortising detection:** if the payment does not cover the monthly interest, the
  balance grows forever. The simulation caps at 720 months and returns
  `nonAmortizing: true`, and the UI says "this payment does not cover interest" instead of
  showing a payoff date in 2154.
- Cascading: when a debt is cleared its payment rolls into the next, which is the whole point
  of a snowball.

### 4. Savings Goals — `/app/money/savings`

**Answers:** Am I on track, and how much do I need to put aside each month?

Records: `goals`, `movements`.

Key calculation — `goalSummary()`:
- Balance = sum of movements (contributions positive, withdrawals negative).
- `requiredMonthly` = remaining / months to target; `null` if no target date.
- `overdue` when the target date has passed and the goal is unmet.
- `monthsOfCover` at the current contribution rate; `null` if the rate is zero rather than
  `Infinity`.

### 5. Net Worth — `/app/money/net-worth`

**Answers:** What am I worth today, and which direction is it moving?

Records: `assets`, `liabilities`, `holdings`, `snapshots`.

Key calculation — `netWorthSummary()`:
- Holdings are valued at **market price**, not cost, and unrealised gain is reported
  separately from realised value.
- `byCurrency` groups rather than sums: adding USD to NGN produces a number that is not money.
- Change is measured against the previous snapshot, and only shown when one exists. With no
  history there is no delta — not a zero.

---

## Business

### 6. Bookkeeping — `/app/business/bookkeeping`

**Answers:** What did the business actually earn and spend?

Records: `accounts`, `categories`, `contacts`, `transactions`.

Key calculation — `bookkeepingSummary()`, cash basis:
- Owner contributions, owner draws, loan proceeds and loan repayments are **excluded** from
  revenue and expenses. They move cash but are not trading performance. Mixing them is the
  most common small-business bookkeeping error.
- Net = revenue − expenses, reported separately from cash movement.

### 7. Inventory — `/app/business/inventory`

**Answers:** What is stock worth, what is running low, and what did each unit cost?

Records: `products`, `movements`.

Key calculation — `valuationForProduct()`:
- Replays movements in date order with a **moving weighted average** cost.
- Inbound updates `(oldQty × oldCost + inQty × inCost) / newQty`; outbound consumes at the
  current average.
- There is no stored `quantity_on_hand`. Stock and cost are derived, so they cannot drift from
  the movement history.
- Stock never goes negative; an over-issue is clamped and surfaced rather than silently
  creating negative inventory.
- `lowStock` triggers at `qty <= reorderPoint` (inclusive — at the reorder point you are out
  of buffer).

### 8. Sales — `/app/business/sales`

**Answers:** What am I selling, at what average order value, and am I hitting target?

Records: `sales`, `targets`.

Key calculation — `salesSummary()`:
- AOV = revenue / order count, `null` on zero orders.
- Target progress is against the target covering the period, not a hard-coded month.
- Invoiced and collected are reported **separately** — revenue recognised is not cash received.
- Growth compares like periods and returns `null` when there is no prior period.

### 9. Invoicing — `/app/business/invoicing`

**Answers:** Who owes me, how much, and for how long?

Records: `invoices`, `payments`, `contacts`.

Key calculation — `invoiceTotals()`:
- Line amounts are rounded **per line** first, then summed. Summing raw floats and rounding
  the total produces invoices whose lines do not add up.
- Discount applies **before** tax, which is the correct order and the one clients check.
- Partial payments reduce the balance; status is derived from the balance, not set by hand.
- `overdueDays` is computed from `dueDate` and only when the balance is non-zero.

### 10. Cash Flow — `/app/business/cash-flow`

**Answers:** Will I run out of money in the next thirteen weeks?

Records: `forecastItems`, `scenarios`.

Key calculation — `forecastCashFlow()`:
- 13-week horizon, weekly buckets.
- Each item carries a certainty: `committed` (1.0), `likely` (0.9), `possible` (0.6). Weighting
  is what makes a forecast honest instead of a wish.
- Reports the **shortfall week** and runway, not just an end balance. An end balance can be
  healthy while the account goes negative in week 4.
- Scenarios (best / expected / worst) are computed from the same items with different weights,
  so they cannot silently disagree with the base case.

---

## Life

### 11. Wedding Planner — `/app/life/wedding`

**Answers:** What is committed versus spent, and does the seating actually fit?

Records: `weddings`, `guests`, `vendors`, `payments`, `expenses`, `tables`, `tasks`.

Key calculation — `weddingSummary()`:
- **Seats, not rows.** A guest row with `partySize: 2` occupies two seats. Counting rows
  under-counts every couple and makes the seating plan wrong.
- Committed (contracted) / actual / paid are three separate figures; conflating them hides
  deposits not yet paid.
- Acceptance rate = accepted / invited, `null` when nobody was invited.
- `seatingWarnings` flags a table over capacity and guests with no table.
- `daysUntil` is calendar days, not a duration in milliseconds.

### 12. Property — `/app/life/property`

**Answers:** Is this property earning its keep?

Records: `properties`, `units`, `bookings`, `expenses`, `maintenance`.

Key calculation — `propertySummary()`:
- Occupancy = booked nights / available nights in the window.
- ADR = accommodation revenue / booked nights.
- **RevPAN** = revenue per available night = total revenue / available nights. This is the
  number that compares a cheap-always-full unit against an expensive-half-empty one; ADR
  alone misleads.
- NOI = revenue − operating expenses, excluding mortgage principal.
- `findOverlaps()` detects double bookings by date range intersection, treating checkout day
  as free for the next check-in.

### 13. Nutrition — `/app/life/nutrition`

**Answers:** What have I eaten today, and does it fit my targets?

Records: `foods`, `logs`, `recipes`, `groceries`.

Key calculation:
- `scaleFood()` scales per-100g values to grams actually eaten.
- `dailyTotals()` sums by meal and day.
- `recipeMacros()` divides by `servings` with a floor of 1 — a recipe with `servings: 0`
  must not produce `Infinity` calories.
- `macroSplit()` returns percentages that sum to 100 by construction (largest-remainder
  rounding), because a pie chart that reads 99.9% looks broken.

---

## Work

### 14. Projects — `/app/work/projects`

**Answers:** What is in flight, what is blocked, and what is late?

Records: `projects`, `tasks`, `milestones`, `dependencies`.

Key calculation:
- `projectProgress()` counts completed tasks, not elapsed time.
- `isOverdue()` compares `dueDate` to today, ignoring tasks already `done`.
- `findDependencyCycles()` walks the graph depth-first and returns any cycle.
  `wouldCreateCycle(a, b)` is the guard the form uses before saving an edge, so a cycle is
  refused at the point of entry rather than discovered later.

### 15. Habits — `/app/work/habits`

**Answers:** Am I keeping this up, and is my streak real?

Records: `habits`, `completions`.

Key calculation — `habitStats()`:
- A habit has a schedule (`days: [1,3,5]`). **Unscheduled days do not break a streak.** A
  Mon/Wed/Fri habit is not "broken" on Tuesday. Walking back day by day and skipping
  unscheduled days is the only way the number matches the user's mental model.
- `expectedOccurrences()` counts scheduled days in a range, so engagement rate is
  `completed / expected`, not `completed / calendar days`.
- A habit with no schedule is treated as daily.

### 16. Content — `/app/work/content`

**Answers:** What is drafted, what is scheduled, what went out, and what did it do?

Records: `posts`, `campaigns`.

Key calculation — `contentSummary()`:
- Pipeline counts by status: idea → draft → scheduled → published.
- `awaitingConfirmation` = scheduled date in the past but status is not `published`. These are
  the posts that silently did not go out, and they are the most useful number on the page.
- `postsByDay()` powers the calendar; it counts posts, not impressions.
- Metrics are optional and never imputed. A post with no recorded reach contributes nothing
  rather than a guess.
