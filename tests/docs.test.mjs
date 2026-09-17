import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

const documents = [
  join(root, 'README.md'),
  join(root, 'demo', 'README.md'),
  join(root, 'mobile', 'README.md'),
  join(root, 'mobile', 'tests', 'fixtures', 'README.md'),
  ...(await markdownFiles(join(root, 'docs'))),
];

for (const document of documents) {
  test(`${relative(root, document)} 的本地文件链接有效`, async () => {
    const content = await readFile(document, 'utf8');
    // Check inline links used by these docs, excluding fenced code examples.
    const prose = content.replace(/^```[^\r\n]*\r?\n[\s\S]*?^```[^\r\n]*$/gm, '');
    for (const match of prose.matchAll(/\[[^\]\r\n]+\]\(([^\s)]+)\)/g)) {
      const href = match[1];
      // External URLs and section-only links are outside this file-link check.
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) continue;
      const target = decodeURIComponent(href.split(/[?#]/, 1)[0]);
      if (!target) continue;
      await assert.doesNotReject(
        access(resolve(dirname(document), target)),
        `失效链接：${relative(root, document)} -> ${href}`,
      );
    }
  });
}

test('账号登录产品设计覆盖已确认的核心范围', async () => {
  const content = await readFile(join(root, 'docs', 'account-login-product-design.md'), 'utf8');

  assert.match(content, /邮箱与密码/);
  assert.match(content, /未登录[\s\S]*数据只保存在当前设备/);
  assert.match(content, /找回密码/);
  assert.match(content, /退出登录/);
  assert.match(content, /注销账号/);
  assert.match(content, /离线状态[\s\S]*联网后自动/);
  assert.match(content, /手机与电脑/);
  assert.match(content, /Supabase Auth \+ PostgreSQL/);
});

test('账号登录技术方案覆盖认证、同步和安全边界', async () => {
  const content = await readFile(join(root, 'docs', 'account-login-technical-design.md'), 'utf8');

  assert.match(content, /Supabase Auth \+ PostgreSQL/);
  assert.match(content, /expo-secure-store/);
  assert.match(content, /SQLite[\s\S]*IndexedDB/);
  assert.match(content, /sync_outbox/);
  assert.match(content, /baseVersion/);
  assert.match(content, /Row Level Security/);
  assert.match(content, /service_role[\s\S]*不得进入/);
  assert.match(content, /邮箱深链接/);
  assert.match(content, /PKCE/);
  assert.match(content, /客户端角色只保留[\s\S]*SELECT/);
  assert.match(content, /apply_birthday_mutation/);
});

test('AGENTS 记录适度模块化的长期代码准则', async () => {
  const content = await readFile(join(root, 'AGENTS.md'), 'utf8');

  assert.match(content, /代码采用适度模块化/);
  assert.match(content, /避免把互不相关的功能堆在一起/);
  assert.match(content, /避免为了拆分而拆分/);
});

test('Android 验证记录区分测试包生成与真机验收', async () => {
  const content = await readFile(join(root, 'docs', 'validation.md'), 'utf8');

  assert.match(content, /Android release 测试 APK/);
  assert.match(content, /包名 `com\.suisui\.calendar`/);
  assert.match(content, /Android Debug 证书/);
  assert.match(content, /Android 通用 APK 编译[\s\S]*已通过/);
  assert.match(content, /Android 真机安装、启动与冷启动[\s\S]*待连接/);
});

test('Android 发布版本在 Expo 与 npm 配置中保持一致', async () => {
  const appConfig = JSON.parse(await readFile(join(root, 'mobile', 'app.json'), 'utf8'));
  const packageConfig = JSON.parse(await readFile(join(root, 'mobile', 'package.json'), 'utf8'));
  const packageLock = JSON.parse(await readFile(join(root, 'mobile', 'package-lock.json'), 'utf8'));

  assert.equal(appConfig.expo.version, packageConfig.version);
  assert.equal(packageLock.version, packageConfig.version);
  assert.equal(packageLock.packages[''].version, packageConfig.version);
  assert.equal(appConfig.expo.version, '0.2.0');
  assert.equal(appConfig.expo.android.versionCode, 2);
});
