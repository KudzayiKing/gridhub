-- Country-level usage for aggregate market reporting. Never store IP addresses.
create table if not exists public.user_country_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_seen_date date not null default (now() at time zone 'UTC')::date,
  visit_days bigint not null default 1 check (visit_days > 0),
  primary key (user_id, country_code)
);

alter table public.user_country_activity enable row level security;
revoke all on public.user_country_activity from anon, authenticated;
grant all on public.user_country_activity to service_role;

create or replace function public.record_country_activity(
  p_user_id uuid,
  p_country_code text
)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  insert into public.user_country_activity (
    user_id, country_code, first_seen_at, last_seen_at, last_seen_date, visit_days
  )
  values (p_user_id, upper(p_country_code), now(), now(), (now() at time zone 'UTC')::date, 1)
  on conflict (user_id, country_code) do update
    set last_seen_at = now(),
        last_seen_date = (now() at time zone 'UTC')::date,
        visit_days = public.user_country_activity.visit_days + 1
    where public.user_country_activity.last_seen_date < (now() at time zone 'UTC')::date;
$$;

revoke all on function public.record_country_activity(uuid, text) from public, anon, authenticated;
grant execute on function public.record_country_activity(uuid, text) to service_role;

create or replace function public.admin_country_activity_summary()
returns table (
  country_code text,
  account_count bigint,
  visit_days bigint,
  last_seen_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select a.country_code,
         count(*)::bigint as account_count,
         sum(a.visit_days)::bigint as visit_days,
         max(a.last_seen_at) as last_seen_at
    from public.user_country_activity a
   group by a.country_code
   order by count(*) desc, a.country_code asc;
$$;

revoke all on function public.admin_country_activity_summary() from public, anon, authenticated;
grant execute on function public.admin_country_activity_summary() to service_role;
