# 岁岁日历应用

手机优先的 React Native + Expo 应用，同时提供电脑浏览器预览。实现范围见[产品设计](../docs/product-design.md)，结构与规则见[技术方案](../docs/technical-design.md)。

## 运行

使用 Node.js 22.13 以上版本，推荐 `.nvmrc` 中的 22.23.2；Node.js 24 也可。项目锁定 Expo SDK 57、React Native 0.86、React 19.2，安装依赖请使用锁文件：

```sh
cd mobile
npm ci
npm run web
```

浏览器打开终端中的地址，默认 `http://localhost:8081`。首页当天日期右侧的“日期计算”是独立临时工具：年份、月份、日期分别输入，月份和日期无需补零，例如直接填写 `2020 年 3 月 5 日`；完整日期输入后会立即显示它距今天的精确自然日数，以及按公历平均一年 365.2425 天计算的“约 N 年”。三个输入互不串位，删除月份不会挪动日期；查询结果不会保存，也不会参与同步。首页最多展示三条时光记摘要，记录较多时可点“查看全部”切换到完整列表。新建时先在月历选日期，再点「＋」选择“生日”或“时光记”；生日会自动预填农历信息，时光记会把所选日期作为开始日期，并可选择“记录天数”或“每年纪念”。生日簿和时光记列表都可查看、编辑和删除记录。点击月历标题可用年、月、日三列滚轮跳转，日期范围为 1901—2100 年，支持滑动、鼠标滚轮和点选；电脑聚焦滚轮后也可用方向键调整、Page Up / Page Down 快选、Home / End 到首尾。切换年月时自动处理闰年和大小月，取消不改变原先选择。

预览使用当前浏览器的 IndexedDB，刷新、关闭再打开页面后保留数据。未登录时，不同浏览器、不同端口或不同设备的数据彼此独立；登录同一个账号后可通过 Supabase 同步。清理网站数据会删除未登录记录和本机缓存，不会删除已经同步的云端生日。预览不是手机 SQLite 或真机验收的替代品。

生日方式可选“只过农历”“只过阳历”“两个都过”。例如编辑已有的农历腊月初九生日，选择“两个都过”并另填阳历 1 月 11 日，两套日期就会独立预览、逐年计算和提醒。同一天重合时只计一次，生日簿仍保留一个人。旧记录升级后保持原有农历规则，不根据姓名猜测阳历日期；阳历 2 月 29 日在平年提前到 28 日，原始日期保持不变。

## 配置邮箱账号与同步

没有云端配置时应用继续本地运行，“账号与同步”页面会明确显示尚未配置。需要联调账号时：

1. 创建 Supabase 开发项目，将 `.env.example` 复制为 `.env`，填写项目 URL 与 publishable key。不要把数据库密码或 `service_role` 放进客户端环境变量。
2. 使用 Supabase CLI 关联开发项目，执行 `supabase/migrations/` 中的迁移，并部署 `delete-account` Edge Function。
3. 在 Supabase Auth 的 URL 配置中加入开发网页 `http://localhost:8081/auth/callback`、原生 `suisui://auth/callback`，以及以后实际使用的生产回调地址。
4. 开发阶段可用 Supabase 测试邮件；正式发布前配置自己的 SMTP、发件域名和中文邮件模板。

示例命令如下，其中项目标识来自自己的 Supabase 项目：

```sh
copy .env.example .env
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase functions deploy delete-account
```

登录后，生日和时光记仍先写入 SQLite 或 IndexedDB，再自动同步；断网修改保留在队列中，恢复前台、定时检查或手动点击时重试。云端需依次应用 `202609050002_countups.sql` 和 `202609050003_time_notes.sql`，否则时光记或展示方式会保留在本机并提示同步失败。首次登录不会自动搬走访客数据，需在账号页点“合并并同步”；云端确认成功且没有冲突后才清理访客副本。

## 手机开发与安装包

```sh
npm run android
# 仅在已配置 Xcode 的 macOS 上运行：
npm run ios
```

采用 development build。Android 需要 Android SDK、匹配的 JDK、模拟器或通过 USB 连接的手机；iOS 需要 macOS / Xcode 和适当的签名配置。Expo SDK 57 的最低平台版本为 Android 7、iOS 16.4；环境安装参考 [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)。

原生目录由 Expo 配置生成，不手动维护，也不提交到 Git。生成 Android 工程可用 `npx expo prebuild --platform android --no-install`。需要能脱离开发服务独立运行的 Android 测试包时，在工具链就绪后执行：

```sh
npx expo run:android --variant release
```

该命令用于本地验收；正式分发还须配置自己的签名、确认应用标识并执行真机检查。默认标识为 `com.suisui.calendar`。应用代码在手机端使用 SQLite 保存数据；杀进程保留、断网启动、生命周期和键盘等仍要在设备上验收。当前完成情况见[验证记录](../docs/validation.md)。

## 检查命令

```sh
npm test
npm run test:storage
npm run verify:calendar
npm run typecheck
npm run lint -- --max-warnings 0
npm run format:check
npm run build:web
npm run build:bundles
npx expo-doctor
```

`test:storage` 使用 Node 自带的真实 SQLite 引擎验证仓库与迁移，使用 fake-indexeddb 验证浏览器仓库。Node.js 22 可能显示 SQLite 实验性功能提示；这是运行时提示，不代表用例失败。历法核验使用已提交的独立对照数据，无需联网，来源和差异处理见[历法数据说明](tests/fixtures/README.md)。

资源导出到 `dist/`（Web）和 `dist-native/`（Android / iOS Hermes 包）。后者不是 APK 或 IPA。导出的 Web 使用单页路由，静态服务器需要将页面路由回退到 `index.html`。

## 修改代码的位置

| 要修改的内容                       | 位置                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| 页面与导航                         | `app/`                                                                         |
| 月历、生日表单、共用样式和小组件   | `src/components/`                                                              |
| 临时日期计算、年月日滚轮与跳转弹窗 | `src/components/DateCalculatorDialog.tsx`、`src/components/DateJumpDialog.tsx` |
| 输入校验、年度生日与时光记规则     | `src/core/birthday.ts`、`src/core/countup.ts`                                  |
| 常见节日、纪念日规则与同日节气组合 | `src/core/festivals.ts`                                                        |
| 历法库与核验口径                   | `src/core/calendar.ts`                                                         |
| 日期运算、北京时间与前台时钟       | `src/core/dates.ts`、`src/core/clock.ts`                                       |
| 共享生日状态与手机生命周期         | `src/state/AppProvider.tsx`                                                    |
| 邮箱认证、会话存储与回调           | `src/auth/`、`src/state/AuthProvider.tsx`                                      |
| 离线队列、云端适配与同步状态       | `src/sync/`、`src/state/SyncProvider.tsx`                                      |
| SQLite、IndexedDB 和版本迁移       | `src/data/`                                                                    |

Supabase 数据库迁移与注销函数位于 `supabase/`。仓库不包含任何项目密钥；未配置环境变量时账号功能保持关闭。系统通知尚未实现。新增功能按实际职责扩展，不预先建立空目录、通用事件引擎或多层服务。图标源文件与生成脚本在 `assets/icon.svg`、`scripts/generate-icons.mjs`；修改后运行 `node scripts/generate-icons.mjs`。

遵守根目录 [AGENTS.md](../AGENTS.md)：改动必须更新相关测试，检查通过后创建 Git commit，并在交付说明中给出提交内容。
