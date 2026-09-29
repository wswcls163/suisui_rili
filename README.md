# 岁岁日历

记录亲友生日与珍贵时光的轻量日历应用。

- [产品设计文档](docs/product-design.md)
- [账号登录产品设计](docs/account-login-product-design.md)
- [移动端技术方案](docs/technical-design.md)
- [账号登录技术方案](docs/account-login-technical-design.md)
- [应用运行与测试说明](mobile/README.md)
- [本次验证记录与手机验收项](docs/validation.md)
- [交互 Demo 与运行说明](demo/README.md)

应用代码位于 `mobile/`，使用 React Native + Expo + TypeScript。已实现双历月历、生日增删改查、逐年换算、时光记、临时日期计算、本地保存、应用内当天提醒，以及邮箱密码账号与离线优先同步客户端。全局左侧功能菜单可直接进入日历、生日簿、时光记、日期计算、重要日期提醒和账号同步；提醒与账号使用独立页面。首页“日期计算”可输入任意有效年月日，立即查看该日期距今天的自然日数，结果不会保存或同步。手机使用 SQLite，电脑浏览器预览使用 IndexedDB；两端共用界面、业务规则和 Supabase 同步协议。未配置云端时仍可本地使用，配置同一个 Supabase 项目后可跨设备同步。旧 `demo/` 保留为交互参考。

当前优先完成手机端，并提供电脑浏览器测试入口。Android `0.3.1` 测试 APK 已完成本地构建、对齐、签名和静态集成校验，真机上的顶部横幅、锁屏全屏、后台与重启恢复仍需安装后逐项验收；Windows 独立安装包留到手机端稳定后再做。产物校验值和验收清单见[验证记录](docs/validation.md)。

## 在电脑上运行

需要 Node.js 22.13 以上版本（建议使用 `.nvmrc` 指定的版本，也可使用 Node.js 24）。

```sh
cd mobile
npm ci
npm run web
```

打开终端输出的地址，默认是 [电脑预览](http://localhost:8081)。可实际新增、编辑、删除生日和时光记，刷新页面后保留数据。账号环境配置见[应用运行说明](mobile/README.md)。关闭终端中的开发服务后，需要重新运行命令才能访问。

## 文档验证

需要 Node.js 22.13 或以上版本。在仓库根目录运行以下命令，检查 README 和 docs 中的本地文件链接：

```sh
node --test tests/*.test.mjs
```

现有 Demo 的测试、类型检查、Lint 与构建命令见其运行说明。
