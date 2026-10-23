# Database

The authoritative definition is `supabase/migrations/0001_init.sql`. This document explains
the model and the decisions behind it; the SQL wins any disagreement.

## Conventions

| Convention | Rule |
| --- | --- |
| Primary keys | `uuid` with `gen_random_uuid()`, except catalogue tables which use `text` ids |
| Ownership | every customer-owned row has `user_id uuid not null references auth.users(id) on delete cascade` |
| Money | `numeric(18,2)` — never `float`, never `double precision` |
| Rates and quantities | `numeric(18,4)` / `numeric(10,2)` |
| Soft delete | `deleted boolean not null default false` |
| Concurrency | `version integer not null default 1`, incremented on every write |
| Timestamps | `created_at`, `updated_at` as `timestamptz`, maintained by `touch_updated_at()` |
| Naming | `<domain>_<entity>`; nutrition and work use their own prefixes rather than nesting under `life_` |

`numeric` is not a performance choice — it is a correctness one. A cent that drifts is a
bug a user can see.

## Table map

### Identity and workspace

| Table | Purpose |
| --- | --- |
| `profiles` | One row per auth user, created by the `handle_new_user` trigger |
| `workspaces` | Container owned by `owner_id`; personal by default, `kind` allows `business` |
| `workspace_members` | Membership and role. Modelled, but no UI invites anyone yet |
| `user_preferences` | Currency, locale, date format, time zone, theme, reduced motion |
| `dashboard_layouts` | Named dashboard arrangements, one default |
| `dashboard_widgets` | Widget instances: `widget_id`, `tool_id`, `position`, `size`, `hidden`, `pinned`, `config` |
| `tool_catalog` | The sixteen tools, seeded by the migration; `visible` and `sort_order` drive marketing |
| `tool_activations` | Which tools an account has switched on; `(user_id, tool_id)` primary key |

### Billing

| Table | Purpose | Writable by |
| --- | --- | --- |
| `subscription_plans` | Plan catalogue mirror, seeded | service role |
| `billing_customers` | `user_id → stripe_customer_id` | service role |
| `billing_subscriptions` | Plan, interval, status, period end | service role (webhook) |
| `subscription_tool_selections` | Which tools a paid plan selected | service role |
| `billing_events` | Webhook log, `stripe_event_id` primary key = idempotency | service role only |
| `billing_entitlements` | **Authoritative** access record: plan, `tools text[]`, status, grace | service role |

`billing_events` being keyed on `stripe_event_id` is what makes webhook replay safe: a
second delivery violates the primary key (Postgres `23505`), the handler treats that as
"already processed", and nothing is applied twice.

### Money

`money_accounts`, `money_categories`, `money_transactions`, `money_budgets`,
`money_recurring_bills`, `money_pay_schedules`, `money_paychecks`,
`money_paycheck_allocations`, `money_debts`, `money_debt_payments`,
`money_savings_goals`, `money_goal_movements`, `money_assets`, `money_liabilities`,
`money_investment_holdings`, `money_valuation_snapshots`.

`money_transactions.amount` carries a `check (amount >= 0)` constraint. Direction lives in
`type ∈ {income, expense, transfer, savings}`. This is the single most important schema
decision in the money domain: it makes "negative expense" unrepresentable.

### Business

`businesses`, `business_accounts`, `business_contacts`, `business_categories`,
`business_transactions`, `business_products`, `business_inventory_movements`,
`business_sales`, `business_sales_targets`, `business_invoices`, `business_payments`,
`business_cash_forecasts`, `business_forecast_scenarios`.

Inventory is **movement-based**, not balance-based: stock and cost are derived by replaying
`business_inventory_movements` in date order with a moving weighted average. There is no
`quantity_on_hand` column to fall out of sync with history.

### Life

`life_weddings`, `life_wedding_guests`, `life_wedding_rsvps`, `life_wedding_vendors`,
`life_wedding_expenses`, `life_wedding_seating`, `life_wedding_tasks`,
`life_properties`, `life_property_units`, `life_property_bookings`,
`life_property_income`, `life_property_expenses`, `life_property_maintenance`.

`life_property_bookings` enforces `check (check_out > check_in)` in the database, so a
zero-night booking cannot exist even if a client bug tries to create one.

### Nutrition

`nutrition_foods`, `nutrition_custom_foods`, `nutrition_food_logs`, `nutrition_recipes`,
`nutrition_recipe_ingredients`, `nutrition_meal_plans`, `nutrition_grocery_lists`,
`nutrition_grocery_items`, `nutrition_preferences`.

`nutrition_foods.user_id` is nullable: a row with `null` is a shared reference food (for
example imported from USDA FoodData Central), while a row with a `user_id` is private to
that account.

### Work

`work_projects`, `work_tasks`, `work_milestones`, `work_task_dependencies`,
`work_habits`, `work_habit_schedules`, `work_habit_completions`, `work_content`,
`work_content_platforms`, `work_content_campaigns`, `work_content_metrics`.

`work_habit_completions` has `unique (habit_id, completed_on)`, which makes double-ticking a
habit on the same day a no-op rather than a duplicate row.
`work_task_dependencies` has `check (task_id <> depends_on_task_id)`; longer cycles are
prevented in the application (`findDependencyCycles` / `wouldCreateCycle`).

### Synchronisation and audit

| Table | Purpose |
| --- | --- |
| `sync_records` | Server mirror of client records, `primary key (user_id, record_id)`, carries `version` and `client_mutation_id` |
| `sync_mutations` | Applied client mutation ids, for idempotency across retries |
| `sync_cursors` | Per-user pull cursor (`timestamptz`) |
| `record_versions` | Append-only history of previous record bodies |
| `audit_events` | `actor` (text), `action`, `entity`, `entity_id`, `metadata jsonb` |

## Row-level security

RLS is **enabled on every table** and policies are generated by a PL/pgSQL loop over the
table list, so a table added to the array cannot be forgotten. Each customer table gets
`owner_select`, `owner_insert`, `owner_update`, `owner_delete`, all of the form
`auth.uid() = user_id`.

Deliberate exceptions:

| Table | Policy |
| --- | --- |
| `profiles` | Owner may select and update; insert is the trigger's job |
| `user_preferences` | Owner read/write |
| `tool_catalog`, `subscription_plans`, `work_content_platforms` | Public read, no client write |
| `billing_*` | Owner may **read**; only the service role may write |
| `billing_events` | No client policy at all — service role only |

The billing rule matters: if a client could write `billing_entitlements`, a user could grant
themselves every tool by editing a row. Entitlements are therefore written exclusively by
the verified webhook, which runs with the service role.

## The new-user trigger

`handle_new_user()` fires after insert on `auth.users` and creates, in one transaction:

1. a `profiles` row (email, full name, avatar from the OAuth identity),
2. a personal `workspaces` row and its `workspace_members` entry,
3. a `user_preferences` row with defaults,
4. a `billing_entitlements` row at plan `free` with the free-tier tool,
5. a `billing_subscriptions` row at status `inactive`.

Consequence: the app never has to handle "user exists but has no preferences" as a normal
state. `app/auth/callback/route.ts` still checks, because a user created before this
migration would not have one.

## Indexes

Chosen for the queries the app actually makes, not speculatively:

```
money_transactions(user_id, tx_date desc)      -- ledger and monthly rollups
money_transactions(user_id, category_id)       -- category variance
money_transactions(user_id, type)              -- income/expense splits
money_budgets(user_id, month)
business_transactions(user_id, tx_date desc)
business_invoices(user_id, status)
business_payments(invoice_id)
business_inventory_movements(product_id, movement_date)  -- cost replay order
life_property_bookings(unit_id, check_in)      -- overlap detection
nutrition_food_logs(user_id, log_date desc)    -- daily diary
work_tasks(project_id, status)                 -- kanban columns
work_habit_completions(habit_id, completed_on desc)      -- streak walk
sync_records(user_id, updated_at)              -- cursor pull
```

## Applying the migration

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Or directly: `psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql`.

**This migration has not been applied to the supplied project.** Verify with the System page
in `/admin`, which reports whether a count against `public.profiles` succeeds.

## Deliberate gaps

- No `profiles.role`. Admin access is an env allowlist (`ADMIN_EMAILS`) because a
  self-writable role column is a privilege-escalation path.
- No full-text search indexes. Search runs client-side over the loaded collection, which is
  the right call while every record already lives in IndexedDB.
- No partitioning or archival. At personal-ledger scale it is unnecessary; at a scale where
  it matters, `sync_records` is the first table that will need it.
