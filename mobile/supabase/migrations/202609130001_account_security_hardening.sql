-- 客户端只读取账号自己的事项；所有写入必须经过带版本与幂等校验的 RPC。
revoke all privileges on table public.birthdays from public, anon, authenticated;
grant select on table public.birthdays to authenticated;

-- 幂等结果只供 SECURITY DEFINER 函数内部使用，客户端不能直接读取或篡改。
revoke all privileges on table public.sync_operations from public, anon, authenticated;

-- 明确收紧函数调用角色，避免后续默认权限变化意外扩大入口。
revoke all on function public.apply_birthday_mutation(uuid, uuid, text, bigint, jsonb) from public, anon;
grant execute on function public.apply_birthday_mutation(uuid, uuid, text, bigint, jsonb) to authenticated;

drop policy if exists "users read own birthdays" on public.birthdays;
create policy "users read own birthdays"
on public.birthdays for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
