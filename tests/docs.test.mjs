import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

const documents = [
  join(root, "README.md"),
  join(root, "mobile", "README.md"),
  join(root, "mobile", "tests", "fixtures", "README.md"),
  ...(await markdownFiles(join(root, "docs"))),
];

test("仓库已移除旧 Demo 并忽略本机 IDE 配置", async () => {
  await assert.rejects(access(join(root, "demo")));
  const gitignore = await readFile(join(root, ".gitignore"), "utf8");
  assert.match(gitignore, /^\.idea\/$/m);
});

test("根级统一验证与 GitHub Actions 使用同一入口", async () => {
  const packageConfig = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  const verify = packageConfig.scripts?.verify ?? "";
  assert.equal(packageConfig.engines?.node, ">=22.13.0");
  assert.equal(
    packageConfig.scripts?.["verify:docs"],
    "node --test tests/docs.test.mjs tests/supabase-deploy.test.mjs",
  );
  assert.match(verify, /verify:docs/);
  assert.match(verify, /--prefix mobile test/);
  assert.match(verify, /test:storage/);
  assert.match(verify, /typecheck/);
  assert.match(verify, /lint/);
  assert.match(verify, /format:check/);
  assert.match(verify, /verify:calendar/);

  const workflow = await readFile(
    join(root, ".github", "workflows", "verify.yml"),
    "utf8",
  );
  assert.match(workflow, /node-version-file: mobile\/\.nvmrc/);
  assert.match(workflow, /npm ci --prefix mobile/);
  assert.match(workflow, /npm run verify/);
});

for (const document of documents) {
  test(`${relative(root, document)} 的本地文件链接有效`, async () => {
    const content = await readFile(document, "utf8");
    // Check inline links used by these docs, excluding fenced code examples.
    const prose = content.replace(
      /^```[^\r\n]*\r?\n[\s\S]*?^```[^\r\n]*$/gm,
      "",
    );
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

test("账号登录产品设计覆盖已确认的核心范围", async () => {
  const content = await readFile(
    join(root, "docs", "account-login-product-design.md"),
    "utf8",
  );

  assert.match(content, /邮箱与密码/);
  assert.match(content, /未登录[\s\S]*数据只保存在当前设备/);
  assert.match(content, /找回密码/);
  assert.match(content, /退出登录/);
  assert.match(content, /注销账号/);
  assert.match(content, /离线状态[\s\S]*联网后自动/);
  assert.match(content, /手机与电脑/);
  assert.match(content, /Supabase Auth \+ PostgreSQL/);
});

test("账号登录技术方案覆盖认证、同步和安全边界", async () => {
  const content = await readFile(
    join(root, "docs", "account-login-technical-design.md"),
    "utf8",
  );

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
  assert.match(content, /account-avatars/);
  assert.match(content, /512×512/);
  assert.match(content, /不含图片二进制或 Base64/);
  assert.match(content, /zjsvkdmpjxtlxqyzaxpa/);
  assert.match(content, /migration repair/);
  assert.match(content, /npm run deploy:supabase/);
  assert.match(content, /禁止把正式迁移复制到 Dashboard SQL Editor/);
});

test("AGENTS 记录适度模块化的长期代码准则", async () => {
  const content = await readFile(join(root, "AGENTS.md"), "utf8");

  assert.match(content, /代码采用适度模块化/);
  assert.match(content, /避免把互不相关的功能堆在一起/);
  assert.match(content, /避免为了拆分而拆分/);
});

test("Android 验证记录区分测试包生成与真机验收", async () => {
  const content = await readFile(join(root, "docs", "validation.md"), "utf8");

  assert.match(content, /Android release 测试 APK/);
  assert.match(content, /包名 `com\.suisui\.calendar`/);
  assert.match(content, /Android Debug 证书/);
  assert.match(content, /Android 通用 APK 编译[\s\S]*已通过/);
  assert.match(
    content,
    /Android 真机安装、启动与冷启动[\s\S]*0\.3\.5 已覆盖安装并启动/,
  );
  assert.match(
    content,
    /用户在真实手机上测试后确认，已测试的核心提醒行为满足当前需求/,
  );
  assert.match(content, /尚未逐项取证的场景推定为已通过/);
});

test("Android 发布版本在 Expo 与 npm 配置中保持一致", async () => {
  const appConfig = JSON.parse(
    await readFile(join(root, "mobile", "app.json"), "utf8"),
  );
  const packageConfig = JSON.parse(
    await readFile(join(root, "mobile", "package.json"), "utf8"),
  );
  const packageLock = JSON.parse(
    await readFile(join(root, "mobile", "package-lock.json"), "utf8"),
  );

  assert.equal(appConfig.expo.version, packageConfig.version);
  assert.equal(packageLock.version, packageConfig.version);
  assert.equal(packageLock.packages[""].version, packageConfig.version);
  assert.equal(appConfig.expo.version, "0.3.5");
  assert.equal(appConfig.expo.android.versionCode, 8);
});

test("首页视觉预览与正式导航及数据模块保持隔离", async () => {
  const route = await readFile(
    join(root, "mobile", "app", "design-preview.tsx"),
    "utf8",
  );
  const preview = await readFile(
    join(
      root,
      "mobile",
      "src",
      "components",
      "design-preview",
      "DesignPreviewHome.tsx",
    ),
    "utf8",
  );
  const home = await readFile(join(root, "mobile", "app", "index.tsx"), "utf8");
  const calendar = await readFile(
    join(root, "mobile", "src", "components", "MonthCalendar.tsx"),
    "utf8",
  );
  const homeTheme = await readFile(
    join(root, "mobile", "src", "components", "home", "homeTheme.ts"),
    "utf8",
  );
  const homeTimeline = await readFile(
    join(
      root,
      "mobile",
      "src",
      "components",
      "home",
      "HomeCalendarTimeline.tsx",
    ),
    "utf8",
  );
  const dateCalculator = await readFile(
    join(root, "mobile", "src", "components", "DateCalculatorDialog.tsx"),
    "utf8",
  );
  const navigation = await readFile(
    join(root, "mobile", "src", "components", "NavigationDrawer.tsx"),
    "utf8",
  );

  assert.match(route, /DesignPreviewHome/);
  assert.doesNotMatch(navigation, /design-preview/);
  assert.doesNotMatch(preview, /state\/|data\/|sync\/|notifications\/|auth\//);
  assert.match(preview, /BottomNavigation/);
  assert.match(preview, /defaultHomeTheme/);
  assert.doesNotMatch(preview, /#[0-9a-f]{3,8}/i);
  assert.match(
    homeTheme,
    /selected:[\s\S]*birthday:[\s\S]*festival:[\s\S]*memory:/,
  );
  assert.match(home, /HomeBottomNavigation/);
  assert.match(home, /HomeCalendarTimeline/);
  assert.match(home, /defaultHomeTheme/);
  assert.match(home, /useAuth/);
  assert.match(home, /首页账号入口/);
  assert.match(home, /showTodayAction/);
  assert.match(home, /<MonthCalendar[\s\S]*<HomeCalendarTimeline/);
  assert.doesNotMatch(home, /NavigationDrawer/);
  assert.match(dateCalculator, /defaultHomeTheme/);
  assert.match(dateCalculator, /日期计算输入区/);
  assert.doesNotMatch(
    [home, calendar, homeTimeline, dateCalculator].join("\n"),
    /#[0-9a-f]{3,8}/i,
  );
  assert.doesNotMatch(preview, /照片占位|独立视觉预览|留一点空白/);
});
