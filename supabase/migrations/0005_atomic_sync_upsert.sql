-- Apply sync record versions atomically so concurrent devices cannot overwrite a newer row.
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
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;
  if p_version < 1 or p_version > 2147483647 then
    raise exception 'invalid version';
  end if;

  insert into public.sync_records (
    user_id, record_id, tool_id, collection, data, deleted, version, client_mutation_id, updated_at
  ) values (
    p_user_id, p_record_id, p_tool_id, p_collection, p_data, p_deleted, p_version, p_client_mutation_id, now()
  )
  on conflict (user_id, record_id) do update set
    tool_id = excluded.tool_id,
    collection = excluded.collection,
    data = excluded.data,
    deleted = excluded.deleted,
    version = excluded.version,
    client_mutation_id = excluded.client_mutation_id,
    updated_at = now()
  where public.sync_records.version < excluded.version
     or (public.sync_records.version = excluded.version
         and public.sync_records.client_mutation_id = excluded.client_mutation_id)
  returning true into v_applied;

  return coalesce(v_applied, false);
end;
$$;

revoke all on function public.upsert_sync_record_if_newer(uuid, text, text, text, jsonb, boolean, integer, text)
  from public, anon;
grant execute on function public.upsert_sync_record_if_newer(uuid, text, text, text, jsonb, boolean, integer, text)
  to authenticated;
