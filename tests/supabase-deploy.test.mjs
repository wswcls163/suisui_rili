import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PROJECT_REF,
  assertMigrationHistory,
  assertProjectRef,
  listLocalMigrations,
  parseMigrationList,
} from "../mobile/scripts/deploy-supabase.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

const migrations = [
  "202609050001_accounts_and_sync.sql",
  "202609050002_countups.sql",
  "202609050003_time_notes.sql",
  "202609130001_account_security_hardening.sql",
  "202609220001_birthday_birth_year.sql",
  "202610090001_account_avatars.sql",
].map((name) => ({ name, version: name.slice(0, 12) }));

const alignedWithOnePending = `
 Local          | Remote         | Time (UTC)
----------------|----------------|----------------
 \`202609050001\` | \`202609050001\` | \`202609050001\`
 \`202609050002\` | \`202609050002\` | \`202609050002\`
 \`202609050003\` | \`202609050003\` | \`202609050003\`
 \`202609130001\` | \`202609130001\` | \`202609130001\`
 \`202609220001\` | \`202609220001\` | \`202609220001\`
 \`202610090001\` | \` \`            | \`202610090001\`
`;

test("迁移清单解析只允许远端为本地有序前缀", () => {
  const rows = parseMigrationList(alignedWithOnePending);
  assert.deepEqual(assertMigrationHistory(migrations, rows), ["202610090001"]);

  const forked = alignedWithOnePending.replace(
    "`202609050003` | `202609050003`",
    "`202609050003` | ` `",
  );
  assert.throws(
    () => assertMigrationHistory(migrations, parseMigrationList(forked)),
    /顺序分叉|必须已登记/,
  );
});

test("未知远端版本和缺失旧历史都会阻止部署", () => {
  const unknown = `${alignedWithOnePending}\n\` \` | \`202701010001\` | \`202701010001\``;
  assert.throws(
    () => assertMigrationHistory(migrations, parseMigrationList(unknown)),
    /未知版本/,
  );

  const emptyRemote = alignedWithOnePending.replace(
    /\| \`\d{12}\`/g,
    "| ` `           ",
  );
  assert.throws(
    () => assertMigrationHistory(migrations, parseMigrationList(emptyRemote)),
    /必须已登记/,
  );
});

test("目标项目必须同时匹配链接项目和客户端 URL", () => {
  assert.doesNotThrow(() =>
    assertProjectRef(
      EXPECTED_PROJECT_REF,
      `https://${EXPECTED_PROJECT_REF}.supabase.co`,
    ),
  );
  assert.throws(
    () =>
      assertProjectRef(
        "another-project",
        `https://${EXPECTED_PROJECT_REF}.supabase.co`,
      ),
    /链接项目不是允许的项目/,
  );
  assert.throws(
    () =>
      assertProjectRef(
        EXPECTED_PROJECT_REF,
        "https://another-project.supabase.co",
      ),
    /客户端配置指向/,
  );
});

test("迁移文件拒绝错误命名和重复版本", async () => {
  const directory = await mkdtemp(join(tmpdir(), "suisui-migrations-"));
  try {
    await writeFile(join(directory, "202610090001_first.sql"), "select 1;\n");
    await writeFile(join(directory, "202610090001_second.sql"), "select 1;\n");
    assert.throws(() => listLocalMigrations(directory), /重复迁移版本/);

    await rm(join(directory, "202610090001_second.sql"));
    await writeFile(join(directory, "manual-avatar.sql"), "select 1;\n");
    assert.throws(() => listLocalMigrations(directory), /命名不合法/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("受保护部署入口不包含自动修复、重置或关闭 JWT 的命令", async () => {
  const script = await readFile(
    resolve(root, "mobile", "scripts", "deploy-supabase.mjs"),
    "utf8",
  );
  assert.doesNotMatch(script, /migration["',\s]+repair/i);
  assert.doesNotMatch(script, /db["',\s]+reset/i);
  assert.doesNotMatch(script, /no-verify-jwt/i);

  const rootPackage = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const mobilePackage = JSON.parse(
    await readFile(resolve(root, "mobile", "package.json"), "utf8"),
  );
  assert.equal(
    rootPackage.scripts?.["deploy:supabase"],
    "npm --prefix mobile run deploy:supabase",
  );
  assert.equal(
    mobilePackage.scripts?.["deploy:supabase"],
    "node scripts/deploy-supabase.mjs",
  );
  assert.equal(mobilePackage.devDependencies?.supabase, "2.120.0");
});
