# 给 Agent 的说明

> **多会话协作守则(2026-10-31 起,长期有效)**:本仓库由多个 AI 会话并行操作(workbuddy 与 ZCode)。
> - 动手前先 `git status`;看到别的会话的未提交修改**不要还原、不要覆盖、不要提交**,先问使用者。
> - 完成自己的工作立即 commit,别攒——未提交的东西随时可能被并行的会话覆盖。
> - 本机不要跑全量 `npm test`(会拖垮机器),单文件测试 + CI。
> - 2026-10-31 的详情页增强任务单(文内图/关键发现卡/原摘要/相关文献)已全部完成并验收,
>   记录见 `D:\Documents\Trae-CN\temp_20261029_01\任务单-20261031-详情页增强.md`。
> - `site/brand/` 的盾蚊图标与 `Sidebar.tsx` 的头部布局是定稿设计,改动前先问使用者。

这个仓库是一个**蚊媒传染病文献站**：从五条 PubMed 检索线和八个期刊源采集论文，用模型预筛、双次评分、写作与归组，按五条轨道归档，每天出一份简报，并通过网站、分类 RSS、公开 API、Agent Markdown 和 MCP 对外提供。

它派生自开源框架 [AIHOT](https://github.com/KKKKhazix/AIHOT)（MIT）。框架负责流水线与发布层，本仓库负责**领域化配置**。

先读 `README.md`，再按任务读 `docs/` 里对应的文档。

## 最常见的任务：调整领域判断

五条轨道已经定稿，key 进了网址不要再改：`symbiont` / `transmission` / `prediction` / `virus-disease` / `control-policy`。

领域知识集中在 `industry/`：

| 文件 | 管什么 |
|---|---|
| `taxonomy.ts` | 五轨定义与判定说明、9 类内容类型、56 个主题标签、14 个机构 |
| `topics.json` | 主题页的 30 个主题、6 个分组 |
| `sources.json` | 首次启动导入的 13 个信源 |
| `prompts/` | 预筛、评分、结构化、写作的全部提示词——**领域判断就在这里** |
| `selection.ts` | 入选门槛（按信源分级，不分轨） |

站点自己的东西在 `site/`：站名文案（`site.ts`）、每一步用哪个模型（`models.ts`）、品牌（`brand/`）、条款页（`pages/`）。

**判轨的核心在 `prompts/structure.md`**：它是五问决策树，第一个问题是「主要产出是不是一个模型」。这条不能挪位置——模型类论文一旦成立第一问，后面每个问题都会答"是"，必须先截断。综述与 Meta 分析不成立第一问。

这些事要问使用者本人，不要替他决定：站名；盯哪些信源；什么研究重要、什么是噪声；门槛数字；条款与隐私说明（`site/pages/` 是模板，上线前需本人确认）。

改评分标准时保留原有结构（内容类型、五维加权、噪声压制、安全边界），替换的是"什么算重要""什么算噪声"的判例。门槛必须用使用者标注的样本重新校准（`docs/selection.md`），不要凭感觉改数字。

## 运行与检查

- Node.js 24 直接运行 TypeScript，后端没有构建步骤。npm workspaces：`apps/*`、`packages/*`、`industry`、`site`、`modules/*`。
- 本机当前是便携式部署（`D:\devstack` 下的 Node 与 PostgreSQL），启停用 `start-all.bat` / `stop-all.bat`；Docker 方式见 `docs/deploy.md`。
- 改完至少跑：
  ```bash
  npm run typecheck
  npm run build -w @aihot/web && node --test apps/web/tests/*.test.ts
  node scripts/smoke.ts --base http://localhost:3000             # 站点跑起来以后
  ```
- **后端测试本机只跑单个文件，不要跑全量 `npm test`。** 每个测试文件都会建一个独立数据库副本，全量一次就是上百个；PostgreSQL 启动时要逐库 fsync，会把启动拖到十几分钟，同时把连接池吃干（2026-10-30 因为这个原因连续卡死过两次）。单文件这样跑：
  ```bash
  DATABASE_URL=postgres://127.0.0.1:5432/<名字>_test \
    node --test-global-setup=tests/databases.ts --import ./tests/databases.ts \
    --test --test-timeout=120000 tests/topics.test.ts
  ```
  全量交给 GitHub Actions 的 `Check`（`check` job 的 Backend tests 步骤），本机不用复现。
- **跑完测试记得清库**：单文件跑几次也会攒出几十个副本。用 `D:\devstack\cleanup-test-dbs.ps1` 清掉，别让它们在下次启动时被 fsync。
- `react-router typegen` 会清理旧类型目录，若被删除拦截挡住，先 `rm -rf apps/web/.react-router-types` 再跑 typecheck，否则 `params.id` 会被推断成 optional，报一堆假错。
- 改了 `site/site.ts` 的文案后必须 `npm run build -w @aihot/web` 并重启 web，否则页面还是旧的。

## 要守住的规则

- 前端（`apps/web`）只通过 HTTP 读 `apps/api`，数据库、模型调用和密钥只在后端。
- 所有公开出口都从 `packages/backend/src/publication/` 这一个读取层读，新增公开出口也一样。五条分类 RSS、API 的 `category` 参数、MCP 都是自动继承这套可见性规则的。
- 读者打开页面不触发模型调用；模型只在 worker 的任务里调用。
- 付费请求都经过回执（`providers/receipts.ts`）和预算熔断，不要绕开。回执的幂等键里含模型名，换模型不会命中旧缓存。
- 安全阀只有设成 `true` 才打开：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`FEISHU_*_ENABLED`、`INDEXNOW_SUBMIT_ENABLED`。测试里推送一直关着，采集和模型调用只连本地假服务，不访问任何外部服务。
- 信源默认只展示摘要和原文链接（`site_fulltext` 关）；只有来源明确允许时才打开全文。文献的"正文"就是摘要，`external` 信源必须同时写 `bodyText` 与 `excerpt`，只写 `excerpt` 会让条目卡在 `body_status='pending'`。
- 公开内容匿名，管理员和访客看到的一样；后台只允许管理员。
- 停用或替换一个功能、机制时，同一个改动删掉它的代码、测试、文档和存下的状态；会删掉已有数据的，在 `docs/deploy.md` 的更新说明里写明。
- 数据库迁移放在 `database/migrations/`（模块的在它的 `migrations/`），按完整文件名排序执行和记账；已经发布的迁移不改。从 `0055` 起每个文件只放一条可在线执行的语句，索引使用 `CONCURRENTLY IF NOT EXISTS`。
- 不要提交 `.env`、密钥和 `.data/`。
- 不要使用上游项目（AIHOT）的名字和 Logo。

## 写代码

匹配周围代码的写法、命名和注释密度。选能清楚解决问题的简单方案，只定义正在使用的抽象。验证改动涉及的重要行为，不为简单的样式改动写测试。

## 与上游的关系

框架代码来自 `KKKKhazix/AIHOT`（远程名 `upstream`）。领域改造都在 `industry/`、`site/` 和采集脚本里，所以同步上游时冲突面很小：

```bash
git fetch upstream
git merge upstream/main       # 冲突一般只出现在 shared 的提示词模板与迁移编号
```

如果要把通用的改进提回上游，先读 `CONTRIBUTING.md`——上游只收对所有站都成立的改动，本站自己的判例、数字和例子留在本仓库。
