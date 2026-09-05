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
