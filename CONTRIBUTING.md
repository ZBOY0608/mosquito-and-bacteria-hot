# 参与贡献

这是个人维护的领域站点，派生自 [AIHOT](https://github.com/KKKKhazix/AIHOT)（MIT）。欢迎提交可复现的问题和文档修正，中文或英文都可以。

## 交流

- **Issue**：可复现的 Bug、有明确场景的功能建议。
- **安全漏洞**：不要开公开 Issue，按 [安全报告说明](SECURITY.md) 私密提交。

## 提交改动

1. Fork 或直接开分支，从最新的 `main` 起。
2. 先读 [AGENTS.md](AGENTS.md) 和对应的 [文档](docs/README.md)。一次改动解决一个清楚的问题，不夹带无关重构。
3. 本地验证至少跑：

   ```bash
   npm run typecheck
   DATABASE_URL=postgres://127.0.0.1:5432/<名字>_test npm test
   npm run build -w @aihot/web && node --test apps/web/tests/*.test.ts
   ```

   测试库名必须以 `_test` 或 `_ci` 结尾，账号要有 `CREATEDB` 权限。**跑完记得清理测试库**（`D:\devstack\cleanup-test-dbs.ps1`）——每个测试文件会建一个库副本，堆到上百个会让 PostgreSQL 启动变得极慢。

4. 数据库改动：已发布的迁移不改，修正放进新文件；从 `0055` 起每个文件只放一条可在线执行的语句，索引用 `CONCURRENTLY IF NOT EXISTS`。规则见 [迁移约定](docs/architecture.md#数据库迁移)。

## 贡献范围

- **领域内容**（信源、标签、判例、门槛）改 `industry/`，本站特有的写法和数字留在这里，不要提回上游。
- **站名、文案、品牌**改 `site/`。
- **框架本身**的通用改进（采集能力、处理流程、公开接口、可访问性）适合提回 [上游](https://github.com/KKKKhazix/AIHOT)，先读上游的 `CONTRIBUTING.md`。

## 不要提交的东西

`.env`、密钥、管理员密码、Cookie、生产数据、未获授权的素材。日志和截图先移除敏感信息。

代码沿用 [MIT 许可证](LICENSE)，品牌与第三方素材说明见 [NOTICE](NOTICE)。
