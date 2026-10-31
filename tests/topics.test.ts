// Topic pages: which articles a topic takes, and their counts.
// Written before the code, from the ways it can go wrong:
// - an entity topic takes an article about another organisation that only mentions it (several
//   subjects, its name nowhere in the title), or drops one about it whose title names it in
//   English, in Chinese, or only in the original title;
// - a Latin name matches inside another word ("Whose" is not WHO); a headline naming an entity
//   that is not a subject of the article gets in;
// - a topic defined by its tags stops taking them, or takes another topic's tags;
// - withdrawn or not yet released articles appear in a list or a count;
// - an article or story page names a topic its reports do not belong to;
// - a topic without content has no page, or an unknown slug or a page past the end has one.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { publishArticle } from "@aihot/backend/publication/publish";
import { TOPIC_GROUPS, TOPICS, loadTopicPage, listTopicSummaries, topicsOfStory } from "@aihot/backend/publication/topics";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const OFFICIAL = `test-topics-official-${T}`;
const MEDIA = `test-topics-media-${T}`;
const app = await buildApp();

/** 分析记录的第一条标签必须是分类标签，取行业包里合法的第一个。 */
const CATEGORY_TAG = "原始研究";

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, first_party, next_fetch_at) VALUES
    (${OFFICIAL}, 'Official', 'rss', 'T1', 'editorial', true, '2100-01-01'),
    (${MEDIA}, 'Media', 'rss', 'T2', 'editorial', false, '2100-01-01')`;
});
after(async () => {
  await app.close();
  await stopBoss();
  await closeDb();
});

let n = 0;
interface Report {
  source?: string;
  at: Date;
  title: string;
  originalTitle?: string;
  subjects?: string[];
  tags?: string[];
  score?: number;
  selected?: boolean;
  fact?: number;
  category?: string;
}

/** A published report; `fact` links it to a fact before publishing, as grouping would. */
async function report(r: Report): Promise<string> {
  n += 1;
  const { articleId } = await upsertMaterial({
    sourceId: r.source ?? MEDIA, url: `https://example.com/topics-${T}-${n}`, title: r.originalTitle ?? r.title, bodyText: "body", bodyHtml: "<p>body</p>", bodyStatus: "ok", via: "fetch", publishedAt: r.at,
  });
  await sql`UPDATE articles SET discovered_at = ${r.at}, timeline_at = ${r.at}, grouped_at = now() WHERE id = ${articleId}`;
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, score, selected, subjects, tags)
            VALUES (${articleId}, 1, 'rule', 'pass', ${r.category ?? "symbiont"}, ${r.title}, ${`摘要 ${n}`}, ${r.score ?? 80}, ${r.selected ?? true}, ${r.subjects ?? []}, ${[CATEGORY_TAG, ...(r.tags ?? [])]})`;
  if (r.fact) await sql`INSERT INTO fact_articles (fact_id, article_id, role) VALUES (${r.fact}, ${articleId}, 'report')`;
  await publishArticle(articleId, { releasedAt: new Date(r.at.getTime() + 60_000) });
  return articleId;
}

async function story(title: string): Promise<{ id: number; publicId: string }> {
  const publicId = randomUUID();
  const [s] = await sql<{ id: number }[]>`INSERT INTO stories (public_id, title, first_report_at, latest_at) VALUES (${publicId}, ${title}, now(), now()) RETURNING id`;
  return { id: s!.id, publicId };
}

async function fact(storyId: number | null, title: string): Promise<number> {
  const [f] = await sql<{ id: number }[]>`INSERT INTO facts (public_id, story_id, title) VALUES (${`f-${T}-${randomUUID()}`}, ${storyId}, ${title}) RETURNING id`;
  return f!.id;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const ids = (items: Array<{ id: string }>) => items.map((i) => i.id);
const page = async (slug: string, p = 1) => {
  const data = await loadTopicPage(slug, p, new Date());
  assert.ok(data, `${slug} page ${p}`);
  return data;
};
/** Every article of a topic, over all its pages. */
async function members(slug: string): Promise<string[]> {
  const first = await page(slug);
  const out = ids(first.items);
  for (let p = 2; p <= first.pageCount; p++) out.push(...ids((await page(slug, p)).items));
  return out;
}

test("an entity topic takes the articles about it, not the ones that only mention it", async () => {
  // 主体就是它，标题也点名。
  const soleSubject = await report({ at: hoursAgo(30), title: `WMP 公布印尼五年结果 ${T}`, subjects: ["wmp"] });
  const chineseName = await report({ at: hoursAgo(31), title: `世界蚊虫计划公布五年结果 ${T}`, subjects: ["wmp"] });
  // 两个主体，中文标题没点名，但原文标题点了名。
  const originalTitleNames = await report({ at: hoursAgo(32), title: `新释放策略的现场评估 ${T}`, originalTitle: `World Mosquito Program reports a five-year field evaluation ${T}`, subjects: ["wmp", "who"] });
  // 只是被提到，不是主体。
  const onlyMentioned = await report({ at: hoursAgo(33), title: `某地报告提到 WMP ${T}`, subjects: ["who"] });
  // 两个主体，标题都没点名：两个主题都不该收。
  const twoSubjectsNoName = await report({ at: hoursAgo(34), title: `两家机构联合发布监测数据 ${T}`, subjects: ["wmp", "who"] });
  // Latin 整词匹配：Whose 不是 WHO。
  const insideAnotherWord = await report({ at: hoursAgo(35), title: `Whose data matters in vector control ${T}`, subjects: ["who", "cdc"] });
  // 按标签定义的普通主题收自己的标签，不收别人的。
  const symbiontTag = await report({ at: hoursAgo(36), title: `沃尔巴克氏体阻断登革传播的现场试验 ${T}`, tags: ["沃尔巴克氏体"] });
  const otherTag = await report({ at: hoursAgo(37), title: `登革重症的临床特征 ${T}`, tags: ["登革"] });

  const wmp = await members("wmp");
  for (const id of [soleSubject, chineseName, originalTitleNames]) assert.ok(wmp.includes(id), "关于 WMP 的");
  for (const id of [onlyMentioned, twoSubjectsNoName, insideAnotherWord, otherTag]) assert.ok(!wmp.includes(id), "只是提到 WMP 的");

  const who = await members("who");
  assert.ok(who.includes(onlyMentioned), "关于 WHO 的");
  for (const id of [twoSubjectsNoName, insideAnotherWord, soleSubject]) assert.ok(!who.includes(id), "只是提到 WHO 的，或 Whose 不是 WHO");

  const wolbachia = await members("wolbachia");
  assert.ok(wolbachia.includes(symbiontTag), "标签主题收自己的标签");
  assert.ok(!wolbachia.includes(otherTag), "不收别的主题的标签");
  assert.ok((await members("dengue")).includes(otherTag), "另一个标签主题收它自己的标签");

  // 文章页列出它属于的主题。
  const topicsOf = async (id: string) => {
    const res = await app.inject({ method: "GET", url: `/api/site/items/${id}` });
    return (JSON.parse(res.body) as { topics: Array<{ slug: string }> }).topics.map((t) => t.slug);
  };
  assert.deepEqual(await topicsOf(soleSubject), ["wmp"]);
  assert.deepEqual(await topicsOf(onlyMentioned), ["who"]);
  assert.deepEqual(await topicsOf(twoSubjectsNoName), []);
  assert.deepEqual(await topicsOf(symbiontTag), ["wolbachia"]);
});

test("a story page names the topics of its reports", async () => {
  const fieldTrial = await story(`沃尔巴克氏体现场试验 ${T}`);
  await report({ source: OFFICIAL, at: hoursAgo(26), title: `沃尔巴克氏体现场试验结果 ${T}`, tags: ["沃尔巴克氏体"], fact: await fact(fieldTrial.id, "现场试验结果") });
  assert.deepEqual(await topicsOfStory(fieldTrial.id), [{ slug: "wolbachia", name: "沃尔巴克氏体" }]);
});

test("withdrawn articles stay out of lists and counts", async () => {
  // 这条用一个前面没造过内容的机构主题，免得和别的用例的数据混在一起。
  const kept = await report({ at: hoursAgo(5), title: `CDC 发布新的监测口径 ${T}`, subjects: ["cdc"] });
  const withdrawn = await report({ at: hoursAgo(4), title: `CDC 撤回的一份提示 ${T}`, subjects: ["cdc"] });
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${withdrawn}`;

  const data = await page("cdc");
  assert.deepEqual(ids(data.items), [kept]);
  const summary = (await listTopicSummaries()).topics.find((t) => t.slug === "cdc")!;
  assert.equal(summary.total, data.topic.total, "the index counts what the page lists");
  assert.equal(summary.latest?.title, `CDC 发布新的监测口径 ${T}`, "the index shows the newest public article");
});

test("every topic has a page; unknown topics and pages past the end have none", async () => {
  // 本文件没有造过西尼罗的内容，所以这个主题页是空的。
  const empty = await page("west-nile");
  assert.equal(empty.topic.indexable, false, "a topic without content is not indexed");
  assert.deepEqual(empty.items, []);
  assert.equal(await loadTopicPage("not-a-topic", 1, new Date()), null);
  assert.equal(await loadTopicPage("west-nile", 2, new Date()), null);
  const index = await app.inject({ method: "GET", url: "/api/site/topics" });
  const body = JSON.parse(index.body) as { groups: Array<{ key: string }>; topics: Array<{ slug: string }> };
  assert.deepEqual(body.groups.map((g) => g.key), TOPIC_GROUPS.map((g) => g.key), "the index groups follow the industry pack");
  assert.deepEqual(body.topics.map((t) => t.slug).sort(), TOPICS.map((t) => t.slug).sort(), "the index lists every topic");
});
