-- Phase 1 shared workspace foundation. Additive and retry-safe; do not run against
-- production until a backup, staging rehearsal, and explicit rollout approval.

alter table public.workspaces
  add column if not exists is_default boolean not null default false,
  add column if not exists archived_at timestamptz;

-- Ensure every existing account has a personal workspace, then deterministically
-- designate its oldest personal workspace as the default. No tool data is inferred.
insert into public.workspaces (owner_id, name, kind, is_default)
select u.id, 'Personal workspace', 'personal', true
from auth.users u
where not exists (select 1 from public.workspaces w where w.owner_id = u.id);

insert into public.workspaces (owner_id, name, kind, is_default)
select u.id, 'Personal workspace', 'personal', true
from auth.users u
where not exists (select 1 from public.workspaces w where w.owner_id = u.id and w.kind = 'personal');

with ranked as (
  select id, row_number() over (
    partition by owner_id
    order by (kind = 'personal') desc, created_at asc, id asc
  ) as position
  from public.workspaces
)
update public.workspaces w
set is_default = (ranked.position = 1), archived_at = null
from ranked
where ranked.id = w.id
  and (w.is_default is distinct from (ranked.position = 1) or w.archived_at is not null and ranked.position = 1);

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
on conflict (workspace_id, user_id) do nothing;

create unique index if not exists workspaces_one_default_per_owner
  on public.workspaces(owner_id) where is_default;
create index if not exists workspaces_owner_active
  on public.workspaces(owner_id, archived_at, created_at);

alter table public.sync_records
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

update public.sync_records sr
set workspace_id = w.id
from public.workspaces w
where sr.user_id = w.owner_id and w.is_default and sr.workspace_id is null;

alter table public.sync_records alter column workspace_id set not null;
create index if not exists sync_records_workspace_cursor
  on public.sync_records(user_id, workspace_id, updated_at);

-- A membership row is not an invitation or sharing mechanism in Phase 1.
alter table public.workspace_members enable row level security;
drop policy if exists owner_select on public.workspace_members;
drop policy if exists owner_insert on public.workspace_members;
drop policy if exists owner_update on public.workspace_members;
drop policy if exists owner_delete on public.workspace_members;
create policy workspace_owner_membership_select on public.workspace_members for select
  using (auth.uid() = user_id and exists (
    select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  ));
create policy workspace_owner_membership_insert on public.workspace_members for insert
  with check (auth.uid() = user_id and role = 'owner' and exists (
    select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  ));
create policy workspace_owner_membership_update on public.workspace_members for update
  using (auth.uid() = user_id and exists (
    select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  ))
  with check (auth.uid() = user_id and role = 'owner' and exists (
    select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  ));
create policy workspace_owner_membership_delete on public.workspace_members for delete
  using (auth.uid() = user_id and exists (
    select 1 from public.workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  ));

-- Tighten direct-table access to owner workspaces. Membership roles are intentionally
-- not accepted yet: collaborative sharing is disabled for this phase.
drop policy if exists owner_select on public.sync_records;
drop policy if exists owner_insert on public.sync_records;
drop policy if exists owner_update on public.sync_records;
drop policy if exists owner_delete on public.sync_records;
drop policy if exists sync_records_owner_select on public.sync_records;
drop policy if exists sync_records_owner_insert on public.sync_records;
drop policy if exists sync_records_owner_update on public.sync_records;
drop policy if exists sync_records_owner_delete on public.sync_records;
create policy sync_records_owner_select on public.sync_records for select
  using (auth.uid() = user_id and exists (
    select 1 from public.workspaces w where w.id = sync_records.workspace_id and w.owner_id = auth.uid()
  ));
create policy sync_records_owner_insert on public.sync_records for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.workspaces w where w.id = sync_records.workspace_id and w.owner_id = auth.uid()
  ));
create policy sync_records_owner_update on public.sync_records for update
  using (auth.uid() = user_id and exists (
    select 1 from public.workspaces w where w.id = sync_records.workspace_id and w.owner_id = auth.uid()
  ))
  with check (auth.uid() = user_id and exists (
    select 1 from public.workspaces w where w.id = sync_records.workspace_id and w.owner_id = auth.uid()
  ));
create policy sync_records_owner_delete on public.sync_records for delete
  using (auth.uid() = user_id and exists (
    select 1 from public.workspaces w where w.id = sync_records.workspace_id and w.owner_id = auth.uid()
  ));

-- Keep the legacy RPC signature usable for older app clients, but constrain all
-- legacy writes to the account's default Personal workspace.
create or replace function public.upsert_sync_record_if_newer(
  p_user_id uuid,
  p_record_id text,
  p_tool_id text,
  p_collection text,
  p_data jsonb,
  p_deleted boolean,
  p_version integer,
  p_client_mutation_id text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_applied boolean := false;
  v_workspace_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'not authorized'; end if;
  if p_version < 1 or p_version > 2147483647 then raise exception 'invalid version'; end if;

  select id into v_workspace_id from public.workspaces
  where owner_id = p_user_id and is_default and archived_at is null;
  if v_workspace_id is null then raise exception 'default workspace unavailable'; end if;

  insert into public.sync_records (
    user_id, workspace_id, record_id, tool_id, collection, data, deleted, version, client_mutation_id, updated_at
  ) values (
    p_user_id, v_workspace_id, p_record_id, p_tool_id, p_collection, p_data, p_deleted, p_version, p_client_mutation_id, now()
  )
  on conflict (user_id, record_id) do update set
    workspace_id = excluded.workspace_id,
    tool_id = excluded.tool_id,
    collection = excluded.collection,
    data = excluded.data,
    deleted = excluded.deleted,
    version = excluded.version,
    client_mutation_id = excluded.client_mutation_id,
    updated_at = now()
  where public.sync_records.workspace_id = v_workspace_id
    and (public.sync_records.version < excluded.version
      or (public.sync_records.version = excluded.version and public.sync_records.client_mutation_id = excluded.client_mutation_id))
  returning true into v_applied;
  return coalesce(v_applied, false);
end;
$$;

create or replace function public.upsert_workspace_sync_record_if_newer(
  p_user_id uuid,
  p_workspace_id uuid,
  p_record_id text,
  p_tool_id text,
  p_collection text,
  p_data jsonb,
  p_deleted boolean,
  p_version integer,
  p_client_mutation_id text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_applied boolean := false;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'not authorized'; end if;
  if p_version < 1 or p_version > 2147483647 then raise exception 'invalid version'; end if;
  if not exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.owner_id = p_user_id and w.archived_at is null) then
    raise exception 'workspace not authorized';
  end if;

  insert into public.sync_records (
    user_id, workspace_id, record_id, tool_id, collection, data, deleted, version, client_mutation_id, updated_at
  ) values (
    p_user_id, p_workspace_id, p_record_id, p_tool_id, p_collection, p_data, p_deleted, p_version, p_client_mutation_id, now()
  )
  on conflict (user_id, record_id) do update set
    workspace_id = excluded.workspace_id,
    tool_id = excluded.tool_id,
    collection = excluded.collection,
    data = excluded.data,
    deleted = excluded.deleted,
    version = excluded.version,
    client_mutation_id = excluded.client_mutation_id,
    updated_at = now()
  where public.sync_records.workspace_id = excluded.workspace_id
    and (public.sync_records.version < excluded.version
      or (public.sync_records.version = excluded.version and public.sync_records.client_mutation_id = excluded.client_mutation_id))
  returning true into v_applied;
  return coalesce(v_applied, false);
end;
$$;

revoke all on function public.upsert_workspace_sync_record_if_newer(uuid, uuid, text, text, text, jsonb, boolean, integer, text) from public, anon;
grant execute on function public.upsert_workspace_sync_record_if_newer(uuid, uuid, text, text, text, jsonb, boolean, integer, text) to authenticated;

-- New accounts created after this migration need a default marker on the bootstrap row.
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

  insert into public.workspaces (owner_id, name, kind, is_default)
  select new.id, 'Personal workspace', 'personal', true
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
