# 岁岁日历应用

手机优先的 React Native + Expo 应用，同时提供电脑浏览器预览。实现范围见[产品设计](../docs/product-design.md)，结构与规则见[技术方案](../docs/technical-design.md)。

## 运行

使用 Node.js 22.13 以上版本，推荐 `.nvmrc` 中的 22.23.2；Node.js 24 也可。项目锁定 Expo SDK 57、React Native 0.86、React 19.2，安装依赖请使用锁文件：

```sh
cd mobile
npm ci
npm run web
```

`?preview=phone` 默认使用 443 像素手机布局；追加 `previewWidth=320` 或 `previewWidth=390` 可在电脑宽屏上审查对应窄屏，例如 `http://localhost:8081/?preview=phone&previewWidth=320`。未支持的值回退到 443 像素。

浏览器打开终端中的地址，默认 `http://localhost:8081`；打开 `http://localhost:8081/?preview=phone` 会在电脑宽屏上固定使用 443 像素的手机布局，便于先审查再生成安装包。也可以直接缩窄普通预览窗口触发相同响应式布局。

正式首页使用紧凑 App bar、完整月历、紧接月历的所选日期与未来 30 天事项流，以及固定在底部的“日历 / 生日簿 / 时光记 / 我的”四栏导航。顶栏右侧固定为账号入口：已登录且设置头像时显示圆形账号头像，否则显示邮箱首字；未登录时显示中性人物图标。点击进入账号与同步，可从系统相册选择、替换或删除头像。月历工具栏集中年月、今天和上月/下月操作，日期计算位于今天摘要中的次级工具入口。月历中的节日、生日和时光记使用不同语义色圆点，具体名称与规则在下方事项流完整显示；内容全部来自真实本地或已同步数据，不使用演示记录。悬浮「＋」沿用原有新建流程，重要日期提醒等设置页继续提供侧边功能菜单。

日历日期摘要中的“日期计算”是独立临时工具：年份、月份、日期使用三列自适应输入，月份和日期无需补零，例如直接填写 `2020 年 3 月 5 日`；完整日期输入后会立即显示它距今天的精确自然日数，以及按公历平均一年 365.2425 天计算的“约 N 年”。三个输入互不串位，删除月份不会挪动日期；查询结果不会保存，也不会参与同步。新建时先在月历选日期，再点「＋」选择“生日”或“时光记”；生日会自动预填农历信息，时光记会把所选日期作为开始日期，并可选择“记录天数”或“每年纪念”。生日簿和时光记列表都可查看、编辑和删除记录。点击月历标题可用年、月、日三列滚轮跳转，日期范围为 1901—2100 年，支持滑动、鼠标滚轮和点选；电脑聚焦滚轮后也可用方向键调整、Page Up / Page Down 快选、Home / End 到首尾。切换年月时自动处理闰年和大小月，取消不改变原先选择。

### 独立首页视觉预览

`http://localhost:8081/design-preview` 保留最初用于评审新版布局的可点击样稿，便于与正式页比较。它以完整月历为主体，不提供周历或折叠态；可切换月份、选择日期，并在月历下方紧接当天和未来 30 天的分组事项流。节日、生日和时光记使用稳定且克制的独立语义色，当前日期、选中日期和事项标记可快速区分。页面保留四栏主导航和悬浮新增入口，但非日历入口不进入正式业务页。

该路由不出现在正式功能菜单中，只使用内置示例内容和日期、农历、节日等纯计算模块，不调用生日仓库、时光记仓库、同步或通知动作，也不会写入 IndexedDB、SQLite 或 Supabase。预览与正式首页共用 `src/components/home/homeTheme.ts` 的颜色、字体、间距、圆角、尺寸和事项状态令牌，但两条路由的数据边界保持隔离。正式首页始终是 `/`。

预览使用当前浏览器的 IndexedDB，刷新、关闭再打开页面后保留数据。未登录时，不同浏览器、不同端口或不同设备的数据彼此独立；登录同一个账号后可通过 Supabase 同步。清理网站数据会删除未登录记录和本机缓存，不会删除已经同步的云端生日。预览不是手机 SQLite 或真机验收的替代品。

生日方式可选“只过农历”“只过阳历”“两个都过”。例如编辑已有的农历腊月初九生日，选择“两个都过”并另填阳历 1 月 11 日，两套日期就会独立预览、逐年计算和提醒。同一天重合时只计一次，生日簿仍保留一个人。旧记录升级后保持原有农历规则，不根据姓名猜测阳历日期；阳历 2 月 29 日在平年提前到 28 日，原始日期保持不变。

“设置”页提供设备本地的重要日期提醒，默认关闭。第一次开启会直接弹出 Android 官方通知授权框，用户点击一次“允许”后自动保存开关并登记提醒；应用不能替用户点击或静默授予系统权限。月历标注的节日、节气、纪念日，以及生日与“每年纪念”都会在当天按设定的北京时间提醒，默认 09:00；普通“记录天数”不发送通知。同一天出现多项内容时只发送一条合并通知，并完整列出当天的重要日子。修改记录、切换时间或重新打开应用后会自动重排最近 60 条提醒，并核对系统实际保存数量。

Android 生产提醒使用持久化的原生 AlarmManager + BroadcastReceiver 链路，不依赖 JavaScript 常驻。手机设置页分别诊断应用通知、高优先级横幅渠道、声音、振动、精确提醒、原生登记和最近投递，并明确标注无法统一读取的厂商“悬浮/横幅”开关。可先点“立即测试顶部横幅”，再点“1 分钟后锁屏测试”验证返回桌面、普通后台和锁屏触发；延时登记会显示预计触发时间和稳定标识。通知渠道使用系统提示音和一次 220ms 短振动，通知本身不设置 Android `FLAG_SILENT`。如果测试只进入通知栏，可点“系统通知与横幅设置”直达应用级通知页，在 ColorOS 等系统中勾选“横幅”并保持“静默通知”关闭；系统不允许应用替用户修改此开关。

“锁屏时全屏提醒”默认关闭，必须由用户明确开启；开启后系统会在许可范围内尝试亮屏显示完整提醒，不绕过锁屏密码，Android 14+ 未授予全屏资格时自动降级为普通通知。测试包包含该能力用于验收，但应用商店通常只允许核心闹钟或来电应用使用全屏意图，正式上架前必须重新评估合规性。系统设置里的“强行停止”会冻结所有本地提醒，重新打开应用后才能恢复；真机已经确认部分厂商系统会把划掉最近任务也处理为强行停止并取消全部闹钟，因此应使用返回桌面代替划掉，并允许自启动与后台运行。电脑预览只检查界面，不发送系统通知；开关与时间设置不通过 Supabase 同步，每台手机分别开启。

## 配置邮箱账号与同步

生日现在可以选填 1901 至今年的 4 位阳历出生年份。填写后，生日簿、选日事项、当天提醒、详情和通知按每次生日发生年份显示“满 N 周岁”；清空后不显示年龄。旧记录升级后出生年份为空。首页今天区域显示完整年月日、中文星期、农历和北京时间；选择未来日期会显示“距离今天还有 N 天”。

出生年份对应的云端迁移为 `202609220001_birthday_birth_year.sql`。该迁移已于 2026-09-27 部署到 Supabase 开发项目“岁岁日历-dev”；新版客户端会先检查 `birth_year` 能力，其他尚未迁移的环境会明确报告能力缺失，不会把丢失出生年份的旧 RPC 结果当成同步成功。

没有云端配置时应用继续本地运行，“账号与同步”页面会明确显示尚未配置。需要联调账号时：

1. 创建 Supabase 开发项目，将 `.env.example` 复制为 `.env`，填写项目 URL 与 publishable key。不要把数据库密码或 `service_role` 放进客户端环境变量。
2. 使用 Supabase CLI 关联开发项目，按顺序执行 `supabase/migrations/` 中的全部迁移（包括 `202609130001_account_security_hardening.sql`），并部署 `delete-account` Edge Function。安全加固后客户端只有查询权限，增删改统一经过版本与幂等 RPC。
3. 在 Supabase Auth 的 URL 配置中加入开发网页 `http://localhost:8081/auth/callback`、原生 `suisui://auth/callback`，以及以后实际使用的生产回调地址。
4. 开发阶段可用 Supabase 测试邮件；正式发布前配置自己的 SMTP、发件域名和中文邮件模板。

账号头像对应迁移为 `202610090001_account_avatars.sql`。它创建私有 `account-avatars` Storage bucket，并把查询、上传、覆盖和删除限制为当前登录用户的固定路径 `<auth.uid()>/avatar.jpg`。本次代码只生成迁移和注销函数变更，**没有替用户部署到远端 Supabase**；应用在迁移未部署或离线时仍会立即显示本机头像，并标为待同步。部署迁移并重新部署 `delete-account` Edge Function 后，头像才会跨设备恢复，注销账号也会先删除云端头像。

原生端使用系统照片选择器和方形裁剪，不调用相机，也不在启动时申请相册权限；客户端再次居中裁成 1:1、缩放为 512×512，并重新编码为中等压缩 JPEG，因此不保留原照片 EXIF 或定位信息。手机文件位于应用私有文档目录，浏览器文件位于浏览器私有 Cache Storage；本地键值仅保存账号范围、文件引用、哈希、路径、时间和同步状态，不保存二进制或 Base64。头像拥有独立同步通道，失败不会阻塞生日与时光记同步。

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

也可以在生成的 `android/` 目录执行 `gradlew.bat app:assembleRelease`，产物位于 `android/app/build/outputs/apk/release/app-release.apk`。Windows 下如果工程物理路径包含中文，而 Gradle、JDK 或 Expo 自动链接报路径不存在，应将 `mobile/` 构建输入复制到纯英文临时目录，在那里按 `package-lock.json` 重新执行 `npm ci` 和原生构建；不要把临时目录当作源码继续开发，也不要提交其中的 `.env`、原生缓存或签名文件。

2026-09-09 已用 JDK 17、Android SDK / Build Tools 36 和 NDK 27.1 在本机成功生成通用测试 APK，并校验包名 `com.suisui.calendar`、最低 API 24、目标 API 36、ZIP 对齐和 v2 签名。当前 APK 使用 Android Debug 证书，只供真机验收；正式分发还须配置自己的签名并重新构建。应用代码在手机端使用 SQLite 保存数据；杀进程保留、断网启动、生命周期和键盘等仍要在设备上验收。当前完成情况见[验证记录](../docs/validation.md)。

2026-09-15 已生成 `0.2.0`（Android 版本号 `2`）通用测试 APK，包含当前手机布局、左侧功能菜单、日期计算、时光记、合并提醒和账号安全修复。新包与 `0.1.0` 使用同一测试证书，可直接覆盖安装；APK 的 SHA-256 为 `53923B31254DA61C3CACB3AD00ECE098E4B042F6AC81AB5A8EF41DF5E0C15CD2`。Windows 本机构建须使用足够短的纯英文临时路径，避免 React Native 原生 CMake 对象路径超过限制。

2026-09-29 已生成 `0.3.0`（Android 版本号 `3`）通用测试 APK，用于交付通知可靠性诊断、新通知渠道和 1 分钟真机测试功能。产物位于 `releases/suisui-calendar-0.3.0-test.apk`，大小 107,869,369 字节，SHA-256 为 `FF2FF7A4386A34892BA15DF705C7346C5B105E916F277D39A44133C04D149122`。该版本继续使用与 `0.1.0`、`0.2.0` 相同的本地测试证书，可直接覆盖安装并保留应用数据；完整构建和校验结果见[验证记录](../docs/validation.md)。

2026-10-06 已生成 `0.3.5`（Android 版本号 `8`）通用测试 APK，移除设置页中的模拟预览，通知渠道改用系统提示音和短振动，并把系统设置入口改为应用级“通知与横幅”页面。产物位于 `releases/suisui-calendar-0.3.5-test.apk`；最终大小和 SHA-256 见[验证记录](../docs/validation.md)。该包在 OnePlus PJE110 上覆盖安装并保留应用数据与权限；ColorOS 16 应用通知页勾选“横幅”后，前台立即测试已肉眼确认显示岁岁日历品牌顶部横幅。

## 检查命令

```sh
npm test
npm run test:storage
npm run verify:calendar
npm run verify:layout # 先在另一个终端运行 npm run web
npm run typecheck
npm run lint -- --max-warnings 0
npm run format:check
npm run build:web
npm run build:bundles
npx expo-doctor
npm audit --registry=https://registry.npmjs.org/
```

`test:storage` 使用 Node 自带的真实 SQLite 引擎验证仓库与迁移，使用 fake-indexeddb 验证浏览器仓库。Node.js 22 可能显示 SQLite 实验性功能提示；这是运行时提示，不代表用例失败。历法核验使用已提交的独立对照数据，无需联网，来源和差异处理见[历法数据说明](tests/fixtures/README.md)。

资源导出到 `dist/`（Web）和 `dist-native/`（Android / iOS Hermes 包）。后者不是 APK 或 IPA。导出的 Web 使用单页路由，静态服务器需要将页面路由回退到 `index.html`。

## 修改代码的位置

| 要修改的内容                       | 位置                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 页面与导航                         | `app/`、`src/components/home/`、`src/components/NavigationDrawer.tsx`                                                              |
| 月历、生日表单、共用样式和小组件   | `src/components/`、`src/components/home/homeTheme.ts`                                                                              |
| 临时日期计算、年月日滚轮与跳转弹窗 | `src/components/DateCalculatorDialog.tsx`、`src/components/DateJumpDialog.tsx`                                                     |
| 输入校验、年度生日与时光记规则     | `src/core/birthday.ts`、`src/core/countup.ts`                                                                                      |
| 系统通知规则、排程与设备设置       | `src/core/notification.ts`、`src/notifications/`、`src/state/NotificationProvider.tsx`、`modules/suisui-notification-reliability/` |
| 常见节日、纪念日规则与同日节气组合 | `src/core/festivals.ts`                                                                                                            |
| 历法库与核验口径                   | `src/core/calendar.ts`                                                                                                             |
| 日期运算、北京时间与前台时钟       | `src/core/dates.ts`、`src/core/clock.ts`                                                                                           |
| 共享生日状态与手机生命周期         | `src/state/AppProvider.tsx`                                                                                                        |
| 邮箱认证、会话存储与回调           | `src/auth/`、`src/state/AuthProvider.tsx`                                                                                          |
| 离线队列、云端适配与同步状态       | `src/sync/`、`src/state/SyncProvider.tsx`                                                                                          |
| 账号头像处理、私有缓存与独立同步   | `src/avatar/`、`src/state/AvatarProvider.tsx`、`src/components/AccountAvatar.tsx`                                                  |
| SQLite、IndexedDB 和版本迁移       | `src/data/`                                                                                                                        |

Supabase 数据库迁移与注销函数位于 `supabase/`。仓库不包含任何项目密钥；未配置环境变量时账号功能保持关闭。Android 系统通知使用本地原生 AlarmManager 排程，iOS 继续使用 `expo-notifications`，两者都不依赖远端推送服务。新增功能按实际职责扩展，不预先建立空业务表、通用事件引擎或多层服务。图标源文件与生成脚本在 `assets/icon.svg`、`scripts/generate-icons.mjs`；修改后运行 `node scripts/generate-icons.mjs`。

遵守根目录 [AGENTS.md](../AGENTS.md)：改动必须更新相关测试，检查通过后创建 Git commit，并在交付说明中给出提交内容。
