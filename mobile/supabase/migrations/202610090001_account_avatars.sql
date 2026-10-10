-- 账号头像使用私有 Storage bucket；客户端只能访问当前账号的固定对象路径。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('account-avatars', 'account-avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "account avatars select own" on storage.objects;
create policy "account avatars select own"
on storage.objects for select to authenticated
using (
  bucket_id = 'account-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
);
drop policy if exists "account avatars insert own" on storage.objects;
create policy "account avatars insert own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'account-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
);

drop policy if exists "account avatars update own" on storage.objects;
create policy "account avatars update own"
on storage.objects for update to authenticated
using (
  bucket_id = 'account-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
)
with check (
  bucket_id = 'account-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
);

drop policy if exists "account avatars delete own" on storage.objects;
create policy "account avatars delete own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'account-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
);

