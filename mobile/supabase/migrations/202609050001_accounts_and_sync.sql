create table public.birthdays (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  lunar_month smallint,
  lunar_day smallint,
  is_leap boolean,
  solar_month smallint,
  solar_day smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  primary key (user_id, id),
  check (
    (lunar_month is null and lunar_day is null and is_leap is null) or
    (lunar_month between 1 and 12 and lunar_day between 1 and 30 and is_leap is not null)
  ),
  check (
    (solar_month is null and solar_day is null) or
    (solar_month between 1 and 12 and solar_day between 1 and
      case when solar_month = 2 then 29 when solar_month in (4, 6, 9, 11) then 30 else 31 end)
  ),
  check (lunar_month is not null or solar_month is not null)
);

create index birthdays_user_updated on public.birthdays(user_id, updated_at, id);

create table public.sync_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

alter table public.birthdays enable row level security;
alter table public.sync_operations enable row level security;

create policy "users read own birthdays"
on public.birthdays for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users insert own birthdays"
on public.birthdays for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own birthdays"
on public.birthdays for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users delete own birthdays"
on public.birthdays for delete to authenticated
using ((select auth.uid()) = user_id);

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
      user_id,id,name,lunar_month,lunar_day,is_leap,solar_month,solar_day,created_at,updated_at,version,deleted_at
    ) values (
      v_user,p_birthday_id,p_payload->>'name',
      (p_payload->>'lunar_month')::smallint,(p_payload->>'lunar_day')::smallint,
      (p_payload->>'is_leap')::boolean,(p_payload->>'solar_month')::smallint,
      (p_payload->>'solar_day')::smallint,now(),now(),1,null
    )
    on conflict (user_id,id) do update set
      name = excluded.name,
      lunar_month = excluded.lunar_month,
      lunar_day = excluded.lunar_day,
      is_leap = excluded.is_leap,
      solar_month = excluded.solar_month,
      solar_day = excluded.solar_day,
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
