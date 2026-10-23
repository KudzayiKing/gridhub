-- Anonymous, opt-in public funnel counts. No user IDs, IP addresses, referrers,
-- financial inputs, or arbitrary payloads are stored.
create table if not exists public.marketing_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in ('calculator_view', 'signup_click')),
  tool_id text not null check (tool_id in ('debt-payoff-calculator', 'monthly-budget-calculator', 'rental-property-calculator', 'savings-goal-calculator', 'profit-margin-calculator', 'invoice-total-calculator')),
  anonymous_session_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_events_summary_idx on public.marketing_events (created_at, event_name, tool_id);
create unique index if not exists marketing_events_once_per_session_idx on public.marketing_events (event_name, tool_id, anonymous_session_id);
alter table public.marketing_events enable row level security;
revoke all on public.marketing_events from public, anon, authenticated;
grant insert on public.marketing_events to service_role;

create or replace function public.admin_marketing_event_summary()
returns table (event_name text, tool_id text, event_count bigint, unique_sessions bigint)
language sql security definer set search_path = public
as $$
  select e.event_name, e.tool_id, count(*)::bigint, count(distinct e.anonymous_session_id)::bigint
  from public.marketing_events e
  where e.created_at >= now() - interval '90 days'
  group by e.event_name, e.tool_id
  order by e.tool_id, e.event_name;
$$;
revoke all on function public.admin_marketing_event_summary() from public, anon, authenticated;
grant execute on function public.admin_marketing_event_summary() to service_role;
