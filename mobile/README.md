# 岁岁日历应用

手机优先的 React Native + Expo 应用，同时提供电脑浏览器预览。实现范围见[产品设计](../docs/product-design.md)，结构与规则见[技术方案](../docs/technical-design.md)。

## 运行

使用 Node.js 22.13 以上版本，推荐 `.nvmrc` 中的 22.23.2；Node.js 24 也可。项目锁定 Expo SDK 57、React Native 0.86、React 19.2，安装依赖请使用锁文件：

```sh
cd mobile
npm ci
npm run web
```

浏览器打开终端中的地址，默认 `http://localhost:8081`。新建时先在月历选日期，再点「＋」和「生日」；日期会自动预填，也可修改农历月份、日期和闰月标记。生日簿可查看、编辑和删除记录。月历标题可以跳转到 1901—2100 年的任意月份。

预览使用当前浏览器的 IndexedDB，刷新、关闭再打开页面后保留数据。不同浏览器、不同端口或不同设备的数据彼此独立，清理网站数据会删除记录。预览不是手机 SQLite 或真机验收的替代品。

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

| 要修改的内容 | 位置 |
| --- | --- |
| 页面与导航 | `app/` |
| 月历、生日表单、共用样式和小组件 | `src/components/` |
| 输入校验、年度生日规则 | `src/core/birthday.ts` |
| 历法库与核验口径 | `src/core/calendar.ts` |
| 日期运算、北京时间与前台时钟 | `src/core/dates.ts`、`src/core/clock.ts` |
| 共享生日状态与手机生命周期 | `src/state/AppProvider.tsx` |
| SQLite、IndexedDB 和版本迁移 | `src/data/` |

没有服务端、账号、同步或系统通知。新增功能按实际职责扩展，不预先建立空目录、通用事件引擎或多层服务。图标源文件与生成脚本在 `assets/icon.svg`、`scripts/generate-icons.mjs`；修改后运行 `node scripts/generate-icons.mjs`。

遵守根目录 [AGENTS.md](../AGENTS.md)：改动必须更新相关测试，检查通过后创建 Git commit，并在交付说明中给出提交内容。
