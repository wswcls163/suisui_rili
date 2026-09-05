alter table public.birthdays
  add column if not exists item_type text not null default 'birthday',
  add column if not exists start_date date,
  add column if not exists note text not null default '';

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.birthdays'::regclass and contype = 'c'
  loop
    execute format('alter table public.birthdays drop constraint %I', constraint_row.conname);
  end loop;
end
$$;

alter table public.birthdays
  add constraint calendar_items_type_check check (item_type in ('birthday', 'countup')),
  add constraint calendar_items_name_check check (char_length(btrim(name)) between 1 and 30),
  add constraint calendar_items_note_check check (char_length(note) <= 120),
  add constraint calendar_items_version_check check (version > 0),
  add constraint calendar_items_payload_check check (
    (
      item_type = 'birthday' and start_date is null and
      (
        (lunar_month is null and lunar_day is null and is_leap is null) or
        (lunar_month between 1 and 12 and lunar_day between 1 and 30 and is_leap is not null)
      ) and
      (
        (solar_month is null and solar_day is null) or
        (solar_month between 1 and 12 and solar_day between 1 and
          case when solar_month = 2 then 29 when solar_month in (4, 6, 9, 11) then 30 else 31 end)
      ) and
      (lunar_month is not null or solar_month is not null)
    ) or (
      item_type = 'countup' and start_date is not null and
      lunar_month is null and lunar_day is null and is_leap is null and
      solar_month is null and solar_day is null
    )
  );

create or replace function public.apply_birthday_mutation(
  p_operation_id uuid,
  p_birthday_id uuid,
  p_kind text,
  p_base_version bigint,
  p_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.birthdays%rowtype;
  v_record public.birthdays%rowtype;
  v_result jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind not in ('upsert', 'delete') then raise exception 'INVALID_MUTATION'; end if;
  if p_base_version < 0 then raise exception 'INVALID_BASE_VERSION'; end if;

  select result into v_result from public.sync_operations
    where user_id = v_user and operation_id = p_operation_id;
  if found then return v_result; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_birthday_id::text, 0));

  select * into v_existing from public.birthdays
    where user_id = v_user and id = p_birthday_id for update;

  if found and v_existing.version <> p_base_version then
    return jsonb_build_object('status', 'conflict', 'record', to_jsonb(v_existing) - 'user_id');
  end if;
  if not found and p_base_version <> 0 then raise exception 'REMOTE_RECORD_MISSING'; end if;

  if p_kind = 'delete' then
    if not found then raise exception 'REMOTE_RECORD_MISSING'; end if;
    update public.birthdays set
      version = version + 1,
      updated_at = now(),
      deleted_at = now()
    where user_id = v_user and id = p_birthday_id
    returning * into v_record;
  else
    if p_payload is null then raise exception 'MISSING_PAYLOAD'; end if;
    insert into public.birthdays (
      user_id,id,item_type,name,lunar_month,lunar_day,is_leap,solar_month,solar_day,start_date,note,
      created_at,updated_at,version,deleted_at
    ) values (
      v_user,p_birthday_id,coalesce(p_payload->>'item_type', 'birthday'),p_payload->>'name',
      (p_payload->>'lunar_month')::smallint,(p_payload->>'lunar_day')::smallint,
      (p_payload->>'is_leap')::boolean,(p_payload->>'solar_month')::smallint,
      (p_payload->>'solar_day')::smallint,(p_payload->>'start_date')::date,
      coalesce(p_payload->>'note', ''),now(),now(),1,null
    )
    on conflict (user_id,id) do update set
      item_type = excluded.item_type,
      name = excluded.name,
      lunar_month = excluded.lunar_month,
      lunar_day = excluded.lunar_day,
      is_leap = excluded.is_leap,
      solar_month = excluded.solar_month,
      solar_day = excluded.solar_day,
      start_date = excluded.start_date,
      note = excluded.note,
      updated_at = now(),
      version = public.birthdays.version + 1,
      deleted_at = null
    returning * into v_record;
  end if;

  v_result := jsonb_build_object('status', 'applied', 'record', to_jsonb(v_record) - 'user_id');
  insert into public.sync_operations(user_id, operation_id, result)
    values (v_user, p_operation_id, v_result);
  return v_result;
end;
$$;

revoke all on function public.apply_birthday_mutation(uuid, uuid, text, bigint, jsonb) from public;
grant execute on function public.apply_birthday_mutation(uuid, uuid, text, bigint, jsonb) to authenticated;
