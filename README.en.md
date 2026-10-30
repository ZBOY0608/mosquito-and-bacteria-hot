<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-176b75?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/Node.js-24-176b75?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 24">
  <img src="https://img.shields.io/badge/PostgreSQL-17-176b75?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 17">
</p>

<p align="center">
  <b>A literature radar for mosquito-borne disease.</b><br>
  Five PubMed search lines plus eight journal feeds, screened and scored twice by a model,
  filed into five tracks, with a daily brief every morning.
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <b>English</b>
</p>

<br>

## What it is

A reading site for peer-reviewed literature on mosquito-borne disease — not a news aggregator.

Every day it pulls papers from five curated PubMed queries and eight journal tables of contents, merges duplicate records of the same paper, asks a model what question the study answers and whether it is worth reading, writes bilingual titles and summaries, then files everything into five tracks, ranks by event heat, and publishes a daily brief.

The output is meant to be read by both people and agents: website, per-category RSS, public API, MCP, `llms.txt`, sitemap.

## The five tracks

Categories are split by **what question a study answers**, not by topic. The routing rule lives in `industry/prompts/structure.md` and is a four-question decision tree rather than keyword matching.

| Track | key | Question | Holds |
|---|---|---|---|
| Symbionts & microbiome | `symbiont` | Can the bacterium block transmission? | Wolbachia transfection and spread, microbiome surveys, IIT releases, paratransgenesis |
| Transmission & vector | `transmission` | Can this mosquito population transmit? | Infection / dissemination / salivary-gland rates, EIP, viral load, vector ecology, insecticide resistance |
| Prediction & modelling | `prediction` | What happens next? | Climate-driven models, spatio-temporal risk mapping, ML early warning, transmission dynamics, clinical warning scores |
| Virus & disease | `virus-disease` | How does the pathogen cause disease? | Virology, pathogenesis, immunology, clinical features, diagnostics, serosurveys, outbreaks |
| Control & policy | `control-policy` | Does the measure work? | Vaccines, antivirals, insecticide application, community intervention, guidelines, health economics |

The hard case is modelling papers: a study combining climate data, case counts and machine learning may never mention a mosquito. That is why "is the main output a model?" is the **first** question — once it holds, every later question would also answer yes, so it has to short-circuit. Reviews and meta-analyses never satisfy the first question; they follow the topic they synthesise.

## How it works

```
5 PubMed search lines ─┐
8 journal RSS feeds  ──┴─→ dedupe → prefilter → two independent scores → writing → grouping → heat → daily brief
```

- **Collect** — five search lines share one `daily_fetch.py`; queries, per-bucket quotas and impact-factor floors live in config files, not code. Journal feeds run over RSS and arrive a day or two earlier.
- **Prefilter** — wide recall, relevance only. Modelling papers without any mosquito mention must not be dropped.
- **Score** — the same rubric applied twice independently; the sum must clear a per-tier threshold. Five axes: novelty, evidence, relevance, impact, actionability, weighted by content type. For `modeling_forecast`, actionability is weighted **0** — a model is not an operation you can copy, so the score should come from novelty and evidence.
- **Write** — Chinese title, answer-first summary, recommendation reason; the English original title and abstract are kept alongside. Model output is never allowed to become an observation: "projected to rise" cannot become "rose".
- **Group & rank** — records of the same paper collapse into one event; heat is computed per event over a 48-hour window with a 24-hour half-life, each independent source counted once.

## Layout

```
industry/          five-track taxonomy, tags, sources, prompts, thresholds
site/              site name, copy, edition times
packages/backend/  editorial pipeline, publication layer, queues
apps/{api,web,worker}
database/migrations/
```

Domain knowledge sits almost entirely in `industry/` and `site/`; the code rarely needs touching.

## Running it

The current deployment is a portable Windows setup: Node 24 and PostgreSQL 17 unpacked under `D:\devstack`, nothing written to the system drive.

```bat
D:\devstack\start-all.bat    REM database -> api -> worker -> web
D:\devstack\stop-all.bat     REM clean shutdown
```

The site is at <http://localhost:3000>, admin at `/admin`.

Docker Compose is still supported if you move it to another machine:

```bash
git clone <this repo> vbd-hot
cd vbd-hot
node scripts/init-env.ts --llm-key <your model API key>
docker compose up -d --build
```

## Data & licensing

Paper metadata comes from PubMed / Europe PMC. Titles and abstracts remain the copyright of their authors and journals; this site only aggregates summaries and links out.

The **framework, engine and prompt architecture** come from [AIHOT](https://github.com/KKKKhazix/AIHOT) by 数字生命卡兹克, under the [MIT license](LICENSE). What this repository adds is the domain work: the five-track taxonomy, four domain prompts, five collection lines and adapters, a 290-journal metrics table, site copy and ops scripts. The original copyright notice is kept in `LICENSE` as MIT requires. The AIHOT name and logo are not used here.
