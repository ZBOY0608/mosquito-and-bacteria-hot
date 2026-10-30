<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-176b75?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/Node.js-24-176b75?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 24">
  <img src="https://img.shields.io/badge/PostgreSQL-17-176b75?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 17">
</p>

<p align="center">
  <b>蚊媒传染病文献热点站。</b><br>
  每天从五条检索线和八个期刊源里收文献，模型筛选、双次评分、按五条轨道归档，早上出一份简报。
</p>

<p align="center">
  <b>简体中文</b> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="#跑起来">跑起来</a> ·
  <a href="#五条轨道">五条轨道</a> ·
  <a href="#它是怎么工作的">它是怎么工作的</a> ·
  <a href="#文档">文档</a>
</p>

<br>

## 这是什么

一个只做蚊媒传染病的文献聚合站。它不追新闻，追**同行评议的论文**。

每天自动去 PubMed 取五条线的文献、抓八个期刊的最新目录，把同一篇论文在不同来源的重复记录合并，让模型判断这篇研究在回答什么问题、值不值得读，写成中英双语的标题与摘要，最后按五条轨道归档、排热度、出日报。

线上形态是一个能读也能被 Agent 读的站：网页、分类 RSS、公开 API、MCP、`llms.txt`、sitemap，同一份内容给人也给程序。

## 五条轨道

分类不是按主题罗列，而是按**这项研究在回答什么问题**分层。判定规则写在 `industry/prompts/structure.md`，用的是四问决策树，不是关键词匹配。

| 轨道 | key | 回答的问题 | 收什么 |
|---|---|---|---|
| 共生菌与微生物组 | `symbiont` | 菌能不能用来阻断传播 | 沃尔巴克氏体等共生菌的转染、传播、菌群调查、IIT 释放、paratransgenesis |
| 传播效能与媒介 | `transmission` | 这群蚊能不能传病 | 感染率、播散率、唾液腺感染、外潜伏期、病毒载量、媒介生态、杀虫剂抗性 |
| 预测与建模 | `prediction` | 接下来会怎样 | 气候驱动建模、时空风险制图、机器学习预警、传播动力学、临床预警评分、分子预测 |
| 病毒与疾病 | `virus-disease` | 病原怎么致病 | 病毒学、致病与免疫、临床特征、诊断、血清学、暴发调查 |
| 防控与政策 | `control-policy` | 措施有没有效 | 疫苗与抗病毒、杀虫剂应用、社区干预、指南与政策、卫生经济 |

判轨最容易被问倒的地方是「模型类论文」：气象加病例数再加机器学习，全文可能一只蚊子都没有。所以决策树的第一个问题就是「主要产出是不是一个模型」——这类材料一旦成立，后面每个问题都会答"是"，必须先截断。综述与 Meta 分析则不成立第一问，按它综合的主题归轨。

## 它是怎么工作的

```
五条 PubMed 检索线 ─┐
八个期刊目录 RSS  ──┴─→ 判重 → 预筛 → 两次独立评分 → 写作与结构化 → 事件归组 → 热度 → 日报
```

**采集**：五条检索线各自一份配置，跑同一个 `daily_fetch.py`。检索式、分桶配额、影响因子门槛全在配置里，改标准不用改代码。期刊目录走 RSS，比 PubMed 早一两天。

**预筛**：宽召回，只判断"与这五条线有没有关系"，不做质量评价。这里有一条容易踩的坑——纯建模论文常常不出现 mosquito，预筛提示词里专门写了这条不能被误杀。

**评分**：同一份标准独立打两次分，两次之和过门槛才成为候选。五轴是新颖性、证据强度、相关度、影响、可执行性，按内容类型加权。预测建模类的可执行性权重给 0——模型本身不是能照搬的操作，分数该由新颖性和证据决定。

**写作**：中文标题、答案先行的摘要、推荐理由；英文原题与摘要原文并存，页面双语展示。模型输出不得写成观测事实，"预计上升"不能写成"上升"。

**归组与热度**：同一篇论文的多条记录聚成一个事件；热度按事件算，48 小时窗口、24 小时半衰期、每个独立来源只算一次。

## 采集线

| 线 | 主题 | 站点信源 | 配置 |
|---|---|---|---|
| A | 非蚊媒虫种（蜱、沙蝇、蚤、蚋等）× 微生物组 × 病毒 | `lit-symbiont-a` | 独立脚本，未接入自动化 |
| B | 蚊媒共生菌防控 | `lit-symbiont-b` | `config/config.json`（7 桶） |
| C | 虫媒病毒与疾病 | `lit-disease-c` | `config/disease.json`（3 桶） |
| D | 传播效能与媒介 | `lit-transmission-d` | `config/transmission.json`（4 桶） |
| E | 预测与建模 | `lit-prediction-e` | `config/prediction.json`（3 桶） |

期刊目录 8 个：PLOS NTD、PLOS Pathogens、PLOS Computational Biology、Nature Microbiology、Trends in Parasitology、Emerging Microbes & Infections、CDC EID、WHO 新闻。

期刊指标覆盖 290 种刊，含影响因子与 JCR 2026 分区。

## 跑起来

### 当前部署（Windows，便携式，不装 Docker）

依赖都在 `D:\devstack`：Node 24 与 PostgreSQL 17 都是解压即用的绿色版，C 盘不写任何东西。

```bash
# 一键启动：数据库 → API → worker → Web，并打开浏览器
D:\devstack\start-all.bat

# 关机前干净停止
D:\devstack\stop-all.bat
```

站点在 <http://localhost:3000>，后台在 `/admin`。

外网访问目前用临时隧道（地址每次变）：`D:\devstack\start-tunnel.bat`。

### 通用方式（Docker）

仓库本身仍支持 Docker Compose，换一台机器时可以用：

```bash
git clone <本仓库地址> vbd-hot
cd vbd-hot
node scripts/init-env.ts --llm-key <你的模型 API Key>
docker compose up -d --build
```

需要 Docker、Node 24，以及一个 OpenAI 兼容的模型接口。`init-env` 默认按 DeepSeek 配；换服务商照 `.env.example` 里的例子改 `LLM_BASE_URL`、`LLM_MODEL`、`LLM_EXTRA_JSON`。

## 配置在哪

领域相关的东西几乎都在两个目录，代码基本不用动：

| 文件 | 管什么 |
|---|---|
| `industry/taxonomy.ts` | 五轨定义与判定说明、9 类内容类型、56 个主题标签、14 个机构 |
| `industry/topics.json` | 主题页的 30 个主题、6 个分组 |
| `industry/sources.json` | 首次启动导入的 13 个信源 |
| `industry/prompts/` | 预筛、评分、结构化、写作的全部提示词——**行业判断就在这里** |
| `site/site.ts` | 站名、文案、出刊时间、导航、公开接口分类 |

## 文档

| 文档 | 内容 |
|---|---|
| [文档索引](docs/README.md) | 本站文档与框架文档的分界，改什么看哪份 |
| [五轨说明](docs/tracks.md) | 五条轨道的边界、判定决策树、判例、跨轨关联、怎么加轨 |
| [架构](docs/architecture.md) | 三个进程、目录结构、数据库迁移、对外出口 |
| [把它改成你的行业](docs/customize.md) | 站名、分类、主题、信源、提示词、门槛的改法 |
| [信源](docs/sources.md) | 六种信源怎么配，分级、全文、抓取频率、外部推送接口 |
| [精选与校准](docs/selection.md) | 一条资料怎么变成精选，怎么用自己的样本校准 |
| [事件归组](docs/grouping.md) | 事件关系怎么判断，怎么评测 |
| [部署](docs/deploy.md) | Docker、域名与 HTTPS、更新与备份 |

技术栈：Node.js 24 · TypeScript · React Router（服务端渲染）· Fastify · PostgreSQL 17 · pg-boss · Tailwind CSS。

## 数据来源与版权

论文元数据来自 PubMed / Europe PMC，摘要与标题的版权归原作者与期刊所有；本站只做聚合摘要与阅读索引，不转载全文。期刊影响因子与分区为 JCR 2026 数值，按刊名匹配，仅供筛选参考。

如果你是来源方，希望更正、下架或调整展示方式，请通过站内反馈页联系。

## 来源与许可

本站的**框架、引擎与全部提示词机制**来自开源项目 [AIHOT](https://github.com/KKKKhazix/AIHOT)（作者：数字生命卡兹克），使用 [MIT 许可证](LICENSE)。

在此之上，本仓库做的是**领域化改造**：五轨分类体系、四份领域提示词、五条采集线与适配器、290 种期刊的指标表、站点文案与运维脚本。这部分改动由本仓库维护者完成。

MIT 许可证要求保留原作者的版权声明，因此 `LICENSE` 保持原样。AIHOT 的名字与 Logo 不在许可范围内，本站不使用。
