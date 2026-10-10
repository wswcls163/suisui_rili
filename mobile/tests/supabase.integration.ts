import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const migration = readFileSync(
  join(root, 'supabase', 'migrations', '202609050001_accounts_and_sync.sql'),
  'utf8',
);
const countupMigration = readFileSync(
  join(root, 'supabase', 'migrations', '202609050002_countups.sql'),
  'utf8',
);
const timeNoteMigration = readFileSync(
  join(root, 'supabase', 'migrations', '202609050003_time_notes.sql'),
  'utf8',
);
const securityMigration = readFileSync(
  join(root, 'supabase', 'migrations', '202609130001_account_security_hardening.sql'),
  'utf8',
);
const birthYearMigration = readFileSync(
  join(root, 'supabase', 'migrations', '202609220001_birthday_birth_year.sql'),
  'utf8',
);
const avatarMigration = readFileSync(
  join(root, 'supabase', 'migrations', '202610090001_account_avatars.sql'),
  'utf8',
);
const deletionFunction = readFileSync(
  join(root, 'supabase', 'functions', 'delete-account', 'index.ts'),
  'utf8',
);
const config = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8');

test('云端表启用 RLS，业务策略只允许访问当前账号的数据', () => {
  assert.match(migration, /alter table public\.birthdays enable row level security/i);
  assert.equal((migration.match(/\(select auth\.uid\(\)\) = user_id/gi) ?? []).length, 5);
  assert.match(migration, /primary key \(user_id, id\)/i);
  assert.match(migration, /references auth\.users\(id\) on delete cascade/i);
  assert.match(migration, /revoke all on function public\.apply_birthday_mutation[\s\S]+from public/i);
  assert.match(
    migration,
    /grant execute on function public\.apply_birthday_mutation[\s\S]+to authenticated/i,
  );
});

test('同步 RPC 同时校验版本、幂等操作号并串行处理同一生日', () => {
  assert.match(migration, /sync_operations/i);
  assert.match(migration, /v_existing\.version <> p_base_version/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /'status', 'conflict'/i);
  assert.match(migration, /'status', 'applied'/i);
});

test('时光记基础迁移保留账号隔离，并由同一幂等 RPC 校验类型数据', () => {
  assert.match(countupMigration, /add column if not exists item_type/i);
  assert.match(countupMigration, /item_type in \('birthday', 'countup'\)/i);
  assert.match(countupMigration, /item_type = 'countup' and start_date is not null/i);
  assert.match(countupMigration, /create or replace function public\.apply_birthday_mutation/i);
  assert.match(countupMigration, /where user_id = v_user and id = p_birthday_id/i);
  assert.match(countupMigration, /sync_operations/i);
  assert.match(countupMigration, /grant execute[\s\S]+to authenticated/i);
});

test('时光记展示方式迁移只允许记录天数或每年纪念，并进入幂等 RPC', () => {
  assert.match(timeNoteMigration, /add column if not exists display_mode/i);
  assert.match(timeNoteMigration, /display_mode in \('days', 'anniversary'\)/i);
  assert.match(timeNoteMigration, /item_type = 'birthday' and display_mode = 'days'/i);
  assert.match(timeNoteMigration, /coalesce\(p_payload->>'display_mode', 'days'\)/i);
  assert.match(timeNoteMigration, /display_mode = excluded\.display_mode/i);
  assert.match(timeNoteMigration, /where user_id = v_user and id = p_birthday_id/i);
  assert.match(timeNoteMigration, /grant execute[\s\S]+to authenticated/i);
});

test('注销函数先验证当前会话，服务端密钥只用于删除该用户', () => {
  assert.match(config, /verify_jwt\s*=\s*true/i);
  assert.match(deletionFunction, /userClient\.auth\.getUser\(\)/);
  assert.match(deletionFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(deletionFunction, /storage\.from\('account-avatars'\)\.remove/);
  assert.match(deletionFunction, /`\$\{data\.user\.id\}\/avatar\.jpg`/);
  assert.ok(
    deletionFunction.indexOf("storage.from('account-avatars').remove") <
      deletionFunction.indexOf('admin.auth.admin.deleteUser'),
  );
  assert.match(deletionFunction, /admin\.auth\.admin\.deleteUser\(data\.user\.id\)/);
  assert.doesNotMatch(deletionFunction, /deleteUser\(request|deleteUser\([^d]/);
});

test('头像存储桶保持私有，并把读写删除限制到当前用户唯一对象路径', () => {
  assert.match(avatarMigration, /'account-avatars', 'account-avatars', false/i);
  assert.match(avatarMigration, /file_size_limit[\s\S]+1048576/i);
  assert.match(avatarMigration, /allowed_mime_types[\s\S]+image\/jpeg/i);
  assert.equal(
    (avatarMigration.match(/name = \(select auth\.uid\(\)\)::text \|\| '\/avatar\.jpg'/gi) ?? []).length,
    5,
  );
  assert.match(avatarMigration, /for select to authenticated/i);
  assert.match(avatarMigration, /for insert to authenticated/i);
  assert.match(avatarMigration, /for update to authenticated/i);
  assert.match(avatarMigration, /for delete to authenticated/i);
  assert.doesNotMatch(avatarMigration, /public\s*=\s*true/i);
});

test('安全加固禁止客户端绕过同步 RPC 直接写表，并隔离幂等结果', () => {
  assert.match(
    securityMigration,
    /revoke all privileges on table public\.birthdays from public, anon, authenticated/i,
  );
  assert.match(securityMigration, /grant select on table public\.birthdays to authenticated/i);
  assert.doesNotMatch(
    securityMigration,
    /grant\s+(insert|update|delete|all)[\s\S]+public\.birthdays[\s\S]+authenticated/i,
  );
  assert.match(
    securityMigration,
    /revoke all privileges on table public\.sync_operations from public, anon, authenticated/i,
  );
  assert.match(
    securityMigration,
    /revoke all on function public\.apply_birthday_mutation[\s\S]+from public, anon/i,
  );
  assert.match(
    securityMigration,
    /for select to authenticated[\s\S]+auth\.uid\(\)\) is not null[\s\S]+auth\.uid\(\)\) = user_id/i,
  );
});

test('出生年份迁移约束范围、进入幂等 RPC，并继续保持只读表和受控写入', () => {
  assert.match(birthYearMigration, /add column if not exists birth_year smallint/i);
  assert.match(birthYearMigration, /birth_year is null or birth_year between 1901 and 2100/i);
  assert.match(birthYearMigration, /item_type = 'countup' and birth_year is null/i);
  assert.match(birthYearMigration, /\(p_payload->>'birth_year'\)::smallint/i);
  assert.match(birthYearMigration, /birth_year = excluded\.birth_year/i);
  assert.match(
    birthYearMigration,
    /revoke all privileges on table public\.birthdays from public, anon, authenticated/i,
  );
  assert.match(birthYearMigration, /grant select on table public\.birthdays to authenticated/i);
  assert.match(
    birthYearMigration,
    /revoke all on function public\.apply_birthday_mutation[\s\S]+from public, anon/i,
  );
});
