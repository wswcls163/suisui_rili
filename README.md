# 岁岁日历

记录亲友生日与珍贵时光的轻量日历应用。

- [产品设计文档](docs/product-design.md)
- [账号登录产品设计](docs/account-login-product-design.md)
- [移动端技术方案](docs/technical-design.md)
- [账号登录技术方案](docs/account-login-technical-design.md)
- [应用运行与测试说明](mobile/README.md)
- [本次验证记录与手机验收项](docs/validation.md)

应用代码位于 `mobile/`，使用 React Native + Expo + TypeScript。已实现双历月历、生日增删改查、逐年换算、时光记、临时日期计算、本地保存、应用内当天提醒，以及邮箱密码账号与离线优先同步客户端。登录账号可选择、替换和删除独立账号头像；头像先保存在应用私有空间，再通过私有 Supabase Storage 对象跨设备同步，不进入生日或时光记数据。全局左侧功能菜单可直接进入日历、生日簿、时光记、日期计算、重要日期提醒和账号同步；提醒与账号使用独立页面。首页“日期计算”可输入任意有效年月日，立即查看该日期距今天的自然日数，结果不会保存或同步。手机使用 SQLite，电脑浏览器预览使用 IndexedDB；两端共用界面、业务规则和 Supabase 同步协议。未配置云端时仍可本地使用，配置同一个 Supabase 项目后可跨设备同步。早期交互原型已在正式应用稳定后移除，避免重复维护两套界面与生日规则。

当前优先完成手机端，并提供电脑浏览器测试入口。Android `0.3.5` 测试 APK 已加入品牌通知卡片、直接说明今日节日/生日/周年的主标题，以及系统提示音和短振动。在 OnePlus PJE110、ColorOS 16 上已完成覆盖安装与真机横幅验收：系统应用通知页勾选“横幅”后，前台立即测试会显示岁岁日历品牌顶部横幅。ColorOS 仍可能把划掉最近任务视为强行停止并取消全部闹钟；应用已提供正确设置入口和明确说明，但不能替用户修改厂商系统开关。Windows 独立安装包留到手机端稳定后再做。产物校验值和验收清单见[验证记录](docs/validation.md)。

## 在电脑上运行

需要 Node.js 22.13 以上版本（建议使用 `.nvmrc` 指定的版本，也可使用 Node.js 24）。

```sh
cd mobile
npm ci
npm run web
```

打开终端输出的地址，默认是 [电脑预览](http://localhost:8081)。可实际新增、编辑、删除生日和时光记，刷新页面后保留数据。账号环境配置见[应用运行说明](mobile/README.md)。关闭终端中的开发服务后，需要重新运行命令才能访问。

## 统一验证

需要 Node.js 22.13 或以上版本，并先在 `mobile/` 按锁文件安装依赖。在仓库根目录运行：

```sh
npm ci --prefix mobile
npm run verify
```

统一验证依次执行文档与仓库配置测试、移动端 Jest、SQLite / IndexedDB / 同步集成测试、TypeScript、ESLint、Prettier 和历法批量核验。GitHub Actions 在推送到 `main` 或创建 Pull Request 时执行相同命令。

响应式布局验证需要先单独运行 `npm --prefix mobile run web`，再在另一终端执行 `npm run verify:layout`；它依赖本机 Chrome 和开发服务，不进入基础 CI。
