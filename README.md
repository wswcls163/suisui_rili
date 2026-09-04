# 岁岁日历

按农历逐年计算亲友生日的轻量日历应用。

- [产品设计文档](docs/product-design.md)
- [移动端技术方案](docs/technical-design.md)
- [交互 Demo 与运行说明](demo/README.md)

正式版技术路线已确定为 React Native + Expo + TypeScript + SQLite，面向 Android 和 iOS。当前仅有模拟数据的界面 Demo，移动端应用尚未实现；第一期仅做应用内提醒。

## 文档验证

需要 Node.js 22.13 或以上版本。在仓库根目录运行以下命令，检查 README 和 docs 中的本地文件链接：

```sh
node --test tests/*.test.mjs
```

现有 Demo 的测试、类型检查、Lint 与构建命令见其运行说明。
