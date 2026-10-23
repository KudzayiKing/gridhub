-- ============================================================================
-- Gridhub — initial schema
--
-- Apply with:  supabase db push
--          or: psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
--
-- Conventions
--   * uuid primary keys
--   * user_id on every customer-owned row, enforced by RLS
--   * numeric(18,2) for money; numeric(18,4) for rates/quantities
--   * soft deletion via deleted_at / deleted
--   * version integer for optimistic concurrency during sync
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Identity & workspace
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Personal workspace',
  kind text not null default 'personal' check (kind in ('personal','business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'USD',
  locale text not null default 'en-US',
  date_format text not null default 'MM/DD/YYYY',
  time_zone text not null default 'UTC',
  business_name text,
  theme text not null default 'system',
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default',
  is_default boolean not null default true,
  layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  layout_id uuid references public.dashboard_layouts(id) on delete cascade,
  widget_id text not null,
  tool_id text not null,
  position integer not null default 0,
  size text not null default 'md',
  hidden boolean not null default false,
  pinned boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tool_catalog (
  id text primary key,
  name text not null,
  collection text not null check (collection in ('money','business','life','work')),
  description text,
  free_tier boolean not null default false,
  visible boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.tool_activations (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null references public.tool_catalog(id) on delete cascade,
  active boolean not null default true,
  activated_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);

-- ---------------------------------------------------------------------------
-- Billing (written only by verified webhooks / server routes)
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  monthly_price numeric(10,2) not null,
  annual_price numeric(10,2) not null,
  tool_limit integer not null,
  stripe_price_monthly text,
  stripe_price_annual text,
  active boolean not null default true
);

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text,
  plan text not null default 'free',
  interval text not null default 'monthly',
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_tool_selections (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null,
  active boolean not null default true,
  changed_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);

create table if not exists public.billing_events (
  stripe_event_id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  tools text[] not null default array['budget'],
  status text not null default 'free',
  current_period_end timestamptz,
  grace_until timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shared Money domain
-- ---------------------------------------------------------------------------

create table if not exists public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'checking',
  opening_balance numeric(18,2) not null default 0,
  currency text not null default 'USD',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('income','expense')),
  category_group text,
  monthly_budget numeric(18,2) not null default 0,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.money_accounts(id) on delete set null,
  to_account_id uuid references public.money_accounts(id) on delete set null,
  category_id uuid references public.money_categories(id) on delete set null,
  goal_id uuid,
  debt_id uuid,
  tx_date date not null default current_date,
  description text not null,
  -- positive magnitude; direction comes from type
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null default 'USD',
  type text not null check (type in ('income','expense','transfer','savings')),
  status text not null default 'posted' check (status in ('posted','pending')),
  notes text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.money_categories(id) on delete cascade,
  month text not null,
  amount numeric(18,2) not null default 0,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create table if not exists public.money_recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(18,2) not null default 0,
  due_day integer not null default 1 check (due_day between 1 and 31),
  category_id uuid references public.money_categories(id) on delete set null,
  account_id uuid references public.money_accounts(id) on delete set null,
  frequency text not null default 'monthly',
  active boolean not null default true,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_pay_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  frequency text not null default 'monthly',
  next_pay_date date not null,
  expected_amount numeric(18,2) not null default 0,
  currency text not null default 'USD',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_paychecks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid references public.money_pay_schedules(id) on delete set null,
  pay_date date not null,
  expected_amount numeric(18,2) not null default 0,
  actual_amount numeric(18,2),
  savings_allocation numeric(18,2) not null default 0,
  notes text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_paycheck_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paycheck_id uuid not null references public.money_paychecks(id) on delete cascade,
  label text not null,
  amount numeric(18,2) not null default 0,
  kind text not null default 'bill' check (kind in ('bill','spending','savings')),
  paid boolean not null default false,
  paid_transaction_id uuid references public.money_transactions(id) on delete set null,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  opening_principal numeric(18,2) not null default 0,
  annual_rate numeric(8,4) not null default 0,
  minimum_payment numeric(18,2) not null default 0,
  extra_payment numeric(18,2) not null default 0,
  frequency text not null default 'monthly',
  currency text not null default 'USD',
  notes text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.money_debts(id) on delete cascade,
  payment_date date not null,
  amount numeric(18,2) not null default 0,
  principal numeric(18,2),
  interest numeric(18,2),
  fees numeric(18,2) not null default 0,
  transaction_id uuid references public.money_transactions(id) on delete set null,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(18,2) not null default 0,
  target_date date,
  opening_balance numeric(18,2) not null default 0,
  kind text not null default 'goal',
  monthly_essentials numeric(18,2),
  currency text not null default 'USD',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_goal_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.money_savings_goals(id) on delete cascade,
  movement_date date not null,
  amount numeric(18,2) not null default 0,
  kind text not null default 'contribution' check (kind in ('contribution','withdrawal')),
  note text,
  transaction_id uuid references public.money_transactions(id) on delete set null,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  value numeric(18,2) not null default 0,
  currency text not null default 'USD',
  valuation_date date not null default current_date,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  value numeric(18,2) not null default 0,
  currency text not null default 'USD',
  valuation_date date not null default current_date,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_investment_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  symbol text,
  quantity numeric(18,6) not null default 0,
  unit_price numeric(18,4) not null default 0,
  cost_basis numeric(18,2) not null default 0,
  currency text not null default 'USD',
  price_source text not null default 'manual',
  valuation_date date not null default current_date,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_assets numeric(18,2) not null default 0,
  total_liabilities numeric(18,2) not null default 0,
  currency text not null default 'USD',
  note text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shared Business domain
-- ---------------------------------------------------------------------------

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  currency text not null default 'USD',
  fiscal_year_start integer not null default 1,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  kind text not null default 'bank',
  opening_balance numeric(18,2) not null default 0,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'customer' check (kind in ('customer','supplier','both')),
  email text,
  phone text,
  notes text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'expense',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  account_id uuid references public.business_accounts(id) on delete set null,
  category_id uuid references public.business_categories(id) on delete set null,
  contact_id uuid references public.business_contacts(id) on delete set null,
  tx_date date not null default current_date,
  description text not null,
  amount numeric(18,2) not null default 0,
  type text not null check (type in ('revenue','expense','owner_contribution','owner_draw','loan_proceeds','loan_repayment','transfer')),
  source_type text,
  source_id uuid,
  notes text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sku text not null,
  unit text not null default 'unit',
  unit_cost numeric(18,4) not null default 0,
  sale_price numeric(18,2) not null default 0,
  reorder_threshold numeric(18,2) not null default 0,
  supplier_id uuid references public.business_contacts(id) on delete set null,
  category text,
  quantity numeric(18,2) not null default 0,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sku)
);

create table if not exists public.business_suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.business_products(id) on delete cascade,
  movement_date date not null default current_date,
  type text not null check (type in ('receipt','dispatch','return','adjustment_positive','adjustment_negative','writeoff')),
  quantity numeric(18,2) not null check (quantity >= 0),
  unit_cost numeric(18,4),
  reference text,
  note text,
  -- posted movements are immutable; corrections are new compensating rows
  posted boolean not null default true,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_inventory_cost_state (
  product_id uuid primary key references public.business_products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity numeric(18,2) not null default 0,
  average_cost numeric(18,4) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.business_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sale_date date not null default current_date,
  customer_id uuid references public.business_contacts(id) on delete set null,
  product_id uuid references public.business_products(id) on delete set null,
  description text not null,
  quantity numeric(18,2) not null default 1,
  unit_price numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  returned numeric(18,2) not null default 0,
  tax_rate numeric(8,4) not null default 0,
  status text not null default 'order' check (status in ('order','invoiced','paid')),
  invoice_id uuid,
  currency text not null default 'USD',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.business_sales(id) on delete cascade,
  description text not null,
  quantity numeric(18,2) not null default 1,
  unit_price numeric(18,2) not null default 0
);

create table if not exists public.business_sales_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  target numeric(18,2) not null default 0,
  currency text not null default 'USD',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

create table if not exists public.business_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.business_contacts(id) on delete set null,
  number text not null,
  issue_date date not null default current_date,
  due_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft','sent','partial','paid','void')),
  tax_rate numeric(8,4) not null default 0,
  discount numeric(18,2) not null default 0,
  currency text not null default 'USD',
  notes text,
  sent_at timestamptz,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);

create table if not exists public.business_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.business_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(18,2) not null default 1,
  unit_price numeric(18,2) not null default 0
);

create table if not exists public.business_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.business_invoices(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(18,2) not null default 0,
  method text not null default 'bank',
  reference text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.business_payments(id) on delete cascade,
  invoice_line_id uuid references public.business_invoice_lines(id) on delete set null,
  amount numeric(18,2) not null default 0
);

create table if not exists public.business_cash_forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('inflow','outflow')),
  amount numeric(18,2) not null default 0,
  week integer not null default 0,
  certainty text not null default 'likely',
  category text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Base',
  opening_cash numeric(18,2) not null default 0,
  minimum_cash numeric(18,2) not null default 0,
  optimistic_factor numeric(6,3) not null default 1,
  conservative_factor numeric(6,3) not null default 0.6,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Life domain
-- ---------------------------------------------------------------------------

create table if not exists public.life_weddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple text not null,
  event_date date not null,
  total_budget numeric(18,2) not null default 0,
  currency text not null default 'USD',
  venue text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_wedding_guests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid references public.life_weddings(id) on delete cascade,
  name text not null,
  household text,
  seats integer not null default 1,
  rsvp text not null default 'invited' check (rsvp in ('invited','accepted','declined','tentative')),
  table_id uuid,
  email text,
  dietary text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_wedding_rsvps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid not null references public.life_wedding_guests(id) on delete cascade,
  status text not null,
  responded_at timestamptz not null default now(),
  note text
);

create table if not exists public.life_wedding_vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid references public.life_weddings(id) on delete cascade,
  name text not null,
  category text,
  contracted_amount numeric(18,2) not null default 0,
  phone text,
  notes text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_wedding_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid references public.life_weddings(id) on delete cascade,
  category text not null,
  label text not null,
  committed numeric(18,2) not null default 0,
  actual numeric(18,2) not null default 0,
  paid numeric(18,2) not null default 0,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_wedding_seating (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid references public.life_weddings(id) on delete cascade,
  name text not null,
  capacity integer not null default 8,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_wedding_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid references public.life_weddings(id) on delete cascade,
  title text not null,
  due_date date,
  owner text,
  done boolean not null default false,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  context text not null default 'personal' check (context in ('personal','business')),
  purchase_price numeric(18,2),
  currency text not null default 'USD',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_property_units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.life_properties(id) on delete cascade,
  name text not null,
  nightly_rate numeric(18,2) not null default 0,
  cleaning_fee numeric(18,2) not null default 0,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_property_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.life_properties(id) on delete cascade,
  unit_id uuid not null references public.life_property_units(id) on delete cascade,
  guest text not null,
  check_in date not null,
  check_out date not null,
  nights integer not null default 1,
  accommodation numeric(18,2) not null default 0,
  platform_fee numeric(18,2) not null default 0,
  cleaning_fee numeric(18,2) not null default 0,
  status text not null default 'booked' check (status in ('booked','stayed','cancelled')),
  paid boolean not null default false,
  channel text not null default 'direct',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_dates_valid check (check_out > check_in)
);

create table if not exists public.life_property_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.life_properties(id) on delete cascade,
  booking_id uuid references public.life_property_bookings(id) on delete set null,
  income_date date not null default current_date,
  amount numeric(18,2) not null default 0,
  kind text not null default 'accommodation',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_property_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.life_properties(id) on delete cascade,
  unit_id uuid references public.life_property_units(id) on delete set null,
  expense_date date not null default current_date,
  category text not null,
  amount numeric(18,2) not null default 0,
  note text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_property_maintenance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.life_properties(id) on delete cascade,
  maintenance_date date not null default current_date,
  title text not null,
  cost numeric(18,2) not null default 0,
  done boolean not null default false,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nutrition -----------------------------------------------------------------

create table if not exists public.nutrition_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  kcal numeric(10,2) not null default 0,
  protein numeric(10,2) not null default 0,
  carbs numeric(10,2) not null default 0,
  fat numeric(10,2) not null default 0,
  fiber numeric(10,2),
  serving_grams numeric(10,2),
  source text not null default 'custom',
  fdc_id bigint,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references public.nutrition_foods(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  food_id uuid references public.nutrition_foods(id) on delete set null,
  name text not null,
  grams numeric(10,2) not null default 0,
  kcal numeric(10,2) not null default 0,
  protein numeric(10,2) not null default 0,
  carbs numeric(10,2) not null default 0,
  fat numeric(10,2) not null default 0,
  fiber numeric(10,2),
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  servings numeric(6,2) not null default 1,
  notes text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.nutrition_recipes(id) on delete cascade,
  food_id uuid references public.nutrition_foods(id) on delete set null,
  name text not null,
  grams numeric(10,2) not null default 0,
  kcal numeric(10,2) not null default 0,
  protein numeric(10,2) not null default 0,
  carbs numeric(10,2) not null default 0,
  fat numeric(10,2) not null default 0
);

create table if not exists public.nutrition_meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  meal text not null,
  recipe_id uuid references public.nutrition_recipes(id) on delete set null,
  note text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Grocery list',
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid references public.nutrition_grocery_lists(id) on delete cascade,
  name text not null,
  quantity text,
  done boolean not null default false,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nutrition_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  units text not null default 'metric',
  show_macros boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Work domain
-- ---------------------------------------------------------------------------

create table if not exists public.work_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active','paused','done')),
  color text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.work_projects(id) on delete cascade,
  milestone_id uuid,
  title text not null,
  status text not null default 'todo' check (status in ('todo','in_progress','review','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  estimate_hours numeric(8,2),
  sort_order integer not null default 0,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.work_projects(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.work_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.work_tasks(id) on delete cascade,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  constraint no_self_dependency check (task_id <> depends_on_task_id)
);

create table if not exists public.work_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  days integer[] not null default array[0,1,2,3,4,5,6],
  frequency text not null default 'daily',
  start_date date not null default current_date,
  target_per_week integer,
  archived boolean not null default false,
  note text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_habit_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.work_habits(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6)
);

create table if not exists public.work_habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.work_habits(id) on delete cascade,
  completed_on date not null,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

create table if not exists public.work_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  platform text not null,
  content_type text not null default 'post',
  status text not null default 'idea' check (status in ('idea','draft','scheduled','published')),
  scheduled_date date,
  published_date date,
  campaign_id uuid,
  notes text,
  reach integer,
  engagements integer,
  metric_basis text default 'reach',
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_content_platforms (
  id text primary key,
  label text not null
);

create table if not exists public.work_content_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  goal text,
  deleted boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_content_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.work_content(id) on delete cascade,
  measured_on date not null default current_date,
  reach integer,
  engagements integer,
  basis text default 'reach',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Synchronisation & audit
-- ---------------------------------------------------------------------------

create table if not exists public.sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  tool_id text not null,
  collection text not null,
  data jsonb not null,
  deleted boolean not null default false,
  version integer not null default 1,
  client_mutation_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.sync_mutations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  applied_at timestamptz not null default now()
);

create table if not exists public.sync_cursors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cursor timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.record_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  version integer not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor text,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_money_tx_user_date on public.money_transactions(user_id, tx_date desc);
create index if not exists idx_money_tx_category on public.money_transactions(user_id, category_id);
create index if not exists idx_money_tx_type on public.money_transactions(user_id, type);
create index if not exists idx_money_budgets_month on public.money_budgets(user_id, month);
create index if not exists idx_biz_tx_user_date on public.business_transactions(user_id, tx_date desc);
create index if not exists idx_biz_invoices_status on public.business_invoices(user_id, status);
create index if not exists idx_biz_payments_invoice on public.business_payments(invoice_id);
create index if not exists idx_inv_movements_product on public.business_inventory_movements(product_id, movement_date);
create index if not exists idx_property_bookings_unit on public.life_property_bookings(unit_id, check_in);
create index if not exists idx_nutrition_logs_user_date on public.nutrition_food_logs(user_id, log_date desc);
create index if not exists idx_work_tasks_project on public.work_tasks(project_id, status);
create index if not exists idx_work_completions_habit on public.work_habit_completions(habit_id, completed_on desc);
create index if not exists idx_sync_records_cursor on public.sync_records(user_id, updated_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','workspaces','user_preferences','dashboard_layouts','dashboard_widgets',
    'billing_subscriptions','billing_entitlements','money_accounts','money_categories',
    'money_transactions','money_budgets','money_recurring_bills','money_pay_schedules',
    'money_paychecks','money_paycheck_allocations','money_debts','money_debt_payments',
    'money_savings_goals','money_goal_movements','money_assets','money_liabilities',
    'money_investment_holdings','money_valuation_snapshots','businesses','business_accounts',
    'business_contacts','business_categories','business_transactions','business_products',
    'business_inventory_movements','business_sales','business_sales_targets','business_invoices',
    'business_payments','business_cash_forecasts','business_forecast_scenarios','life_weddings',
    'life_wedding_guests','life_wedding_vendors','life_wedding_expenses','life_wedding_seating',
    'life_wedding_tasks','life_properties','life_property_units','life_property_bookings',
    'life_property_income','life_property_expenses','life_property_maintenance','nutrition_foods',
    'nutrition_food_logs','nutrition_recipes','nutrition_grocery_items','work_projects',
    'work_tasks','work_milestones','work_habits','work_content','work_content_campaigns'
  ] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$I', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$I for each row execute function public.touch_updated_at()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Every customer-owned table is isolated by auth.uid() = user_id.
-- Billing tables are read-only for the owner: only the service role (used by the
-- verified Stripe webhook) may write them.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'workspace_members','dashboard_layouts','dashboard_widgets','tool_activations',
    'money_accounts','money_categories','money_transactions','money_budgets','money_recurring_bills',
    'money_pay_schedules','money_paychecks','money_paycheck_allocations','money_debts',
    'money_debt_payments','money_savings_goals','money_goal_movements','money_assets',
    'money_liabilities','money_investment_holdings','money_valuation_snapshots','businesses',
    'business_accounts','business_contacts','business_categories','business_transactions',
    'business_products','business_suppliers','business_inventory_movements',
    'business_inventory_cost_state','business_sales','business_sales_targets',
    'business_invoices','business_payments',
    'business_cash_forecasts','business_forecast_scenarios','life_weddings','life_wedding_guests',
    'life_wedding_rsvps','life_wedding_vendors','life_wedding_expenses','life_wedding_seating',
    'life_wedding_tasks','life_properties','life_property_units','life_property_bookings',
    'life_property_income','life_property_expenses','life_property_maintenance','nutrition_foods',
    'nutrition_custom_foods','nutrition_food_logs','nutrition_recipes','nutrition_recipe_ingredients',
    'nutrition_meal_plans','nutrition_grocery_lists','nutrition_grocery_items','work_projects',
    'work_tasks','work_milestones','work_task_dependencies','work_habits','work_habit_schedules',
    'work_habit_completions','work_content','work_content_campaigns','work_content_metrics',
    'sync_records','sync_mutations','sync_cursors','record_versions'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "owner_select" on public.%I', t);
    execute format('drop policy if exists "owner_insert" on public.%I', t);
    execute format('drop policy if exists "owner_update" on public.%I', t);
    execute format('drop policy if exists "owner_delete" on public.%I', t);

    execute format('create policy "owner_select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "owner_insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "owner_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "owner_delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Tables that do NOT fit the uniform auth.uid() = user_id assumption.
-- ---------------------------------------------------------------------------

-- workspaces is owned by owner_id, not user_id.
alter table public.workspaces enable row level security;
drop policy if exists "owner_select" on public.workspaces;
drop policy if exists "owner_insert" on public.workspaces;
drop policy if exists "owner_update" on public.workspaces;
drop policy if exists "owner_delete" on public.workspaces;
create policy "owner_select" on public.workspaces for select using (auth.uid() = owner_id);
create policy "owner_insert" on public.workspaces for insert with check (auth.uid() = owner_id);
create policy "owner_update" on public.workspaces for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owner_delete" on public.workspaces for delete using (auth.uid() = owner_id);

-- business_sale_lines has no owner column; ownership resolves through its parent sale.
alter table public.business_sale_lines enable row level security;
drop policy if exists "owner_select" on public.business_sale_lines;
drop policy if exists "owner_insert" on public.business_sale_lines;
drop policy if exists "owner_update" on public.business_sale_lines;
drop policy if exists "owner_delete" on public.business_sale_lines;
create policy "owner_select" on public.business_sale_lines for select using (
  exists (select 1 from public.business_sales s where s.id = business_sale_lines.sale_id and s.user_id = auth.uid())
);
create policy "owner_insert" on public.business_sale_lines for insert with check (
  exists (select 1 from public.business_sales s where s.id = business_sale_lines.sale_id and s.user_id = auth.uid())
);
create policy "owner_update" on public.business_sale_lines for update using (
  exists (select 1 from public.business_sales s where s.id = business_sale_lines.sale_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from public.business_sales s where s.id = business_sale_lines.sale_id and s.user_id = auth.uid())
);
create policy "owner_delete" on public.business_sale_lines for delete using (
  exists (select 1 from public.business_sales s where s.id = business_sale_lines.sale_id and s.user_id = auth.uid())
);

-- business_invoice_lines has no owner column; ownership resolves through its parent invoice.
alter table public.business_invoice_lines enable row level security;
drop policy if exists "owner_select" on public.business_invoice_lines;
drop policy if exists "owner_insert" on public.business_invoice_lines;
drop policy if exists "owner_update" on public.business_invoice_lines;
drop policy if exists "owner_delete" on public.business_invoice_lines;
create policy "owner_select" on public.business_invoice_lines for select using (
  exists (select 1 from public.business_invoices i where i.id = business_invoice_lines.invoice_id and i.user_id = auth.uid())
);
create policy "owner_insert" on public.business_invoice_lines for insert with check (
  exists (select 1 from public.business_invoices i where i.id = business_invoice_lines.invoice_id and i.user_id = auth.uid())
);
create policy "owner_update" on public.business_invoice_lines for update using (
  exists (select 1 from public.business_invoices i where i.id = business_invoice_lines.invoice_id and i.user_id = auth.uid())
) with check (
  exists (select 1 from public.business_invoices i where i.id = business_invoice_lines.invoice_id and i.user_id = auth.uid())
);
create policy "owner_delete" on public.business_invoice_lines for delete using (
  exists (select 1 from public.business_invoices i where i.id = business_invoice_lines.invoice_id and i.user_id = auth.uid())
);

-- business_payment_allocations has no owner column; ownership resolves through its parent payment.
alter table public.business_payment_allocations enable row level security;
drop policy if exists "owner_select" on public.business_payment_allocations;
drop policy if exists "owner_insert" on public.business_payment_allocations;
drop policy if exists "owner_update" on public.business_payment_allocations;
drop policy if exists "owner_delete" on public.business_payment_allocations;
create policy "owner_select" on public.business_payment_allocations for select using (
  exists (select 1 from public.business_payments p where p.id = business_payment_allocations.payment_id and p.user_id = auth.uid())
);
create policy "owner_insert" on public.business_payment_allocations for insert with check (
  exists (select 1 from public.business_payments p where p.id = business_payment_allocations.payment_id and p.user_id = auth.uid())
);
create policy "owner_update" on public.business_payment_allocations for update using (
  exists (select 1 from public.business_payments p where p.id = business_payment_allocations.payment_id and p.user_id = auth.uid())
) with check (
  exists (select 1 from public.business_payments p where p.id = business_payment_allocations.payment_id and p.user_id = auth.uid())
);
create policy "owner_delete" on public.business_payment_allocations for delete using (
  exists (select 1 from public.business_payments p where p.id = business_payment_allocations.payment_id and p.user_id = auth.uid())
);

-- Profiles: a user may read/update only their own row.
alter table public.profiles enable row level security;
drop policy if exists "profile_self" on public.profiles;
create policy "profile_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Preferences keyed by user_id.
alter table public.user_preferences enable row level security;
drop policy if exists "prefs_self" on public.user_preferences;
create policy "prefs_self" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.nutrition_preferences enable row level security;
drop policy if exists "nutrition_prefs_self" on public.nutrition_preferences;
create policy "nutrition_prefs_self" on public.nutrition_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Billing: read-only for the owner. Writes come from the service role only.
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.subscription_tool_selections enable row level security;

drop policy if exists "billing_customers_read" on public.billing_customers;
create policy "billing_customers_read" on public.billing_customers
  for select using (auth.uid() = user_id);

drop policy if exists "billing_subs_read" on public.billing_subscriptions;
create policy "billing_subs_read" on public.billing_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "billing_entitlements_read" on public.billing_entitlements;
create policy "billing_entitlements_read" on public.billing_entitlements
  for select using (auth.uid() = user_id);

drop policy if exists "tool_selection_read" on public.subscription_tool_selections;
create policy "tool_selection_read" on public.subscription_tool_selections
  for select using (auth.uid() = user_id);

-- billing_events is service-role only: no policies at all, RLS denies everyone else.
alter table public.billing_events enable row level security;

-- Catalog tables are public read.
alter table public.tool_catalog enable row level security;
drop policy if exists "catalog_read" on public.tool_catalog;
create policy "catalog_read" on public.tool_catalog for select using (visible);

alter table public.subscription_plans enable row level security;
drop policy if exists "plans_read" on public.subscription_plans;
create policy "plans_read" on public.subscription_plans for select using (active);

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.workspaces (owner_id, name)
  select new.id, 'Personal workspace'
  where not exists (select 1 from public.workspaces where owner_id = new.id);

  insert into public.workspace_members (workspace_id, user_id, role)
  select w.id, new.id, 'owner'
  from public.workspaces w
  where w.owner_id = new.id
  on conflict do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.billing_entitlements (user_id, plan, tools, status)
  values (new.id, 'free', array['budget'], 'free')
  on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seed the tool catalog and plans (idempotent)
-- ---------------------------------------------------------------------------

insert into public.tool_catalog (id, name, collection, free_tier, sort_order) values
  ('budget','Ultimate Annual Budget Planner','money',true,1),
  ('paycheck','Monthly & Paycheck Budget Planner','money',false,2),
  ('debt','Debt Snowball & Avalanche Tracker','money',false,3),
  ('savings','Savings Goals & Emergency Fund','money',false,4),
  ('net-worth','Net Worth & Investment Tracker','money',false,5),
  ('bookkeeping','Small Business Bookkeeping','business',false,6),
  ('inventory','Inventory Management','business',false,7),
  ('sales','Sales & Revenue Tracker','business',false,8),
  ('invoicing','Invoice & Payment Manager','business',false,9),
  ('cash-flow','Cash Flow Forecast','business',false,10),
  ('wedding','Ultimate Wedding Planner','life',false,11),
  ('property','Rental Property & Airbnb Manager','life',false,12),
  ('nutrition','Gridhub Nutrition','life',false,13),
  ('projects','Project Management Dashboard','work',false,14),
  ('habits','Habit & Productivity Tracker','work',false,15),
  ('content','Social Media Content Planner','work',false,16)
on conflict (id) do update set
  name = excluded.name,
  collection = excluded.collection,
  free_tier = excluded.free_tier,
  sort_order = excluded.sort_order;

insert into public.subscription_plans (id, name, monthly_price, annual_price, tool_limit) values
  ('free','Free',0,0,1),
  ('single','Single',3,29,1),
  ('plus','Plus',7,69,3),
  ('pro','Pro',11,109,6),
  ('unlimited','Unlimited',15,149,16)
on conflict (id) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  tool_limit = excluded.tool_limit;
