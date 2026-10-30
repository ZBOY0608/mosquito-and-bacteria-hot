# 文档索引

这个仓库派生自开源框架 [AIHOT](https://github.com/KKKKhazix/AIHOT)（MIT）。文档因此分两类，读的时候注意区分：

**本站自己的文档**（描述这五条轨道、这套采集线和这次部署）

| 文档 | 内容 |
|---|---|
| [五轨说明](tracks.md) | 五条轨道的边界、判定决策树、九组判例、跨轨关联、怎么加轨 |
| 运维手册 | 在仓库外：`D:\Documents\Trae-CN\temp_20261029_01\站点运维手册.md`，含启停、路径、外网、自动化、故障排查 |

**框架文档**（上游原文，描述引擎本身；技术机制仍然适用，但里面的行业例子是 AI 行业的）

| 文档 | 内容 | 对本项目的适配情况 |
|---|---|---|
| [架构](architecture.md) | 三个进程、目录、模块、数据库迁移、对外出口、测试 | 适用，进程结构与迁移规则没变 |
| [把它改成你的行业](customize.md) | 站名、分类、主题、信源、提示词、门槛的改法 | 适用，本项目已按此做过一轮 |
| [信源](sources.md) | 六种信源的配置、分级、全文、抓取频率、外部推送接口 | 适用；本项目用 `external` 推送文献，见下 |
| [精选与校准](selection.md) | 一条资料怎么变成精选，怎么用样本校准 | 适用；门槛目前未做金标校准 |
| [事件归组](grouping.md) | 事件关系判断与评测 | 适用，未改过 |
| [综述评测](story-digest-evaluation.md) | 改综述提示词前的并排比较方法 | 未使用 |
| [部署](deploy.md) | Docker、域名与 HTTPS、更新与备份 | 部分适用；当前是 Windows 便携部署 |

## 本项目相对框架的改动

只列会影响理解的：

1. **分类从"行业"改为"问题"**：五条轨道按研究回答什么分层，不是主题罗列。详见 [五轨说明](tracks.md)。
2. **内容类型加了第 9 类 `modeling_forecast`**，五轴权重里可执行性给 0。
3. **采集线**：五条 `external` 信源，由 `D:\workbuddy-data\文献推送\scripts\` 下的 Python 脚本推入，不走框架的 RSS 抓取。论文的"正文"就是摘要，所以 `ingest` 必须同时写 `bodyText` 与 `excerpt`。
4. **期刊指标**：290 种刊的影响因子与 JCR 2026 分区，按刊名匹配，仅供筛选与展示参考。
5. **站点身份**：站名、文案、出刊时间（日报 11:00，晚于两条采集推送）都在 `site/site.ts`。

## 想改什么，看哪份

| 你要改 | 看这里 |
|---|---|
| 某篇文献判错了轨 | `industry/prompts/structure.md` 的判例；已入库的在后台「内容诊断」改判 |
| 觉得选得太松/太严 | 先看 `industry/prompts/selection-score.md` 的品味规则，再考虑 `industry/selection.ts` 的门槛 |
| 加一门关注的课题 | `industry/taxonomy.ts` 的 `TOPIC_TAGS` + `topics.json` |
| 换/加一个信源 | `industry/sources.json` 与 `D:\workbuddy-data\文献推送\config\*.json` |
| 改站名和文案 | `site/site.ts`，改完必须 `npm run build -w @aihot/web` |
| 站点起不来 | 运维手册第 9 节「常见故障」 |
