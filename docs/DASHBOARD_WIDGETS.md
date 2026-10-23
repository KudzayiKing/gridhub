# Dashboard and widgets

## What the dashboard is for

Sixteen tools produce sixteen sets of numbers. A dashboard that shows all of them shows
nothing. Gridhub's dashboard answers three questions in order:

1. **Is anything wrong right now?** — overdue invoices, bills due, a debt that is not
   amortising, a habit streak about to break.
2. **Where do I stand?** — net cash flow this month, savings progress, task completion.
3. **What should I do next?** — one-tap actions into the tool that needs attention.

A static grid of sixteen cards answers none of them, which is why there isn't one.

## The widget data model

The schema supports a configurable widget system:

```sql
dashboard_layouts   (id, user_id, name, is_default, layout jsonb)
dashboard_widgets   (id, user_id, layout_id, widget_id, tool_id,
                     position, size, hidden, pinned, config jsonb)
```

| Field | Meaning |
| --- | --- |
| `widget_id` | Which widget type, e.g. `budget.monthly-spend`, `debt.payoff-date` |
| `tool_id` | Which tool owns it — used to hide widgets when a tool is deactivated |
| `position` | Sort order within the layout |
| `size` | `sm` / `md` / `lg` grid span |
| `hidden` | Kept but not rendered |
| `pinned` | Survives layout resets |
| `config` | Per-widget options (period, account filter, currency) |

## What is actually implemented

The dashboard at `app/app/page.tsx` is **composed**, not widget-driven:

- `lib/use-dashboard.ts` (`useDashboardData`) subscribes to the collections of the user's
  **active** tools only, and derives a single aggregate: cash flow, savings, invoicing,
  task counts, habit streaks, content queue, bills due, nutrition today.
- The page renders fixed sections in a deliberate order: greeting → vital metrics →
  "Needs your attention" → quick actions → my tools → spending trend → top categories →
  savings goals → recent activity.
- Every section is conditional. If a tool is not active, its section does not render. With no
  tools active the page shows an empty state that links to the catalog, not a wall of zeroes.

The reason is honesty about state: a widget engine that cannot yet be configured would be a
worse experience than a dashboard that is well-composed and correct.

## Adding / removing / reordering widgets — not implemented

The tables exist and are empty. There is no UI to add, remove, reorder or pin a widget, and
the dashboard does not read `dashboard_layouts`.

To finish it, the work is:

1. A `useDashboardLayout()` hook reading `dashboard_layouts` + `dashboard_widgets` (local
   first, synced like any other record).
2. A widget registry: `widget_id → { title, toolId, size, render(data, config) }`.
3. Drag-to-reorder with keyboard equivalents (arrow keys + a "move" mode), because a
   pointer-only reorder is unusable for keyboard and switch users.
4. A widget picker that only offers widgets whose `toolId` is active.
5. Persistence on drop, debounced, through the normal outbox.

Until then, treat the widget tables as reserved schema, and say so rather than implying a
customisation feature exists.

## Rules any widget must follow

These apply to the current composed sections too:

1. **No invented data.** A widget with no records shows an empty state, never a sample value.
   Marketing previews are labelled "Example"; the product never pretends.
2. **No fabricated trends.** A delta is shown only when two comparable periods exist.
   `avgMonthlySpending` excludes the current partial month for exactly this reason.
3. **Currency is explicit.** Multi-currency users see per-currency totals, not a sum of
   different currencies. `groupByCurrency` exists because adding USD to NGN is meaningless.
4. **Attention beats information.** An overdue invoice outranks a nice chart. The
   "Needs your attention" list is capped and ordered by consequence.
5. **Every widget links to its source.** A number you cannot act on is trivia.
6. **N/A is a valid value.** A ratio with a zero denominator renders "N/A", not `0%` and not
   `Infinity`.

## The attention model

`useDashboardData().attention` produces typed items with a severity and a link. Sources:

| Source | Trigger |
| --- | --- |
| Invoicing | Invoice past `dueDate` and not fully paid |
| Budget | Category over budget, or projected overspend |
| Debt | A debt whose payment does not cover interest (`nonAmortizing`) |
| Savings | Goal past its target date and short of target |
| Habits | Streak at risk — scheduled today, not yet done |
| Content | Scheduled date passed but status is not `published` |

Each item carries the reason, not just the label: "Invoice #1042 is 6 days overdue", not
"Invoice overdue". The specific number is what makes it actionable.
