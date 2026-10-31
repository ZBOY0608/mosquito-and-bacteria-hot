// Failure cases: a benchmark, price change, tool or follow-up is counted as a new model; a category
// correction leaves frozen daily/weekly/monthly columns stale, rewrites the lead or selection, triggers
// a paid digest, leaves an obsolete section introduction, or commits without its audit/revision.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { overrideFields } from "@aihot/backend/admin/content";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { dailyMetrics } from "@aihot/backend/reports/compose";
import type { EditionEntry } from "@aihot/backend/reports/edition";
import { QUEUES, getBoss, stopBoss } from "@aihot/backend/jobs/queue";
import { RELEASE } from "@aihot/industry/taxonomy";

after(async () => { await stopBoss(); await closeDb(); });

test("new models require a launch classification as well as an official, new model event", () => {
  const base = { category: "symbiont", tags: ["原始研究"], authority: 0, previous: null,
    entry: { sourceId: "official", firstParty: true } } as EditionEntry;
  const rows = [base, { ...base, tags: ["评测/基准"] }, { ...base, tags: ["方法与工具"] },
    { ...base, category: "transmission" }, { ...base, authority: 3 },
    { ...base, previous: { key: "2026-09-30", title: "已报过的发布" } }, { ...base, tags: [] }];
  // RELEASE 是本行业的「最受关注的那类发布」。本仓库没有这样的类（RELEASE 为 null），
  // dailyMetrics 就不产出 modelsReleased 这个字段，日报报头也不显示发布数；
  // 将来把某类发布填进 RELEASE 时，这个断言自动回到「只算一条」。
  if (RELEASE === null) assert.equal(dailyMetrics(rows).modelsReleased, undefined, "没有 RELEASE 时不产出发布数");
  else assert.equal(dailyMetrics(rows).modelsReleased, 1);
  assert.equal(dailyMetrics(rows).totalEvents, 7);
});

test("category corrections revise every standard report atomically without selecting, rewriting or notifying", async () => {
  await getBoss(); // the digest check below reads the job table
  const sourceId = `category-${tag()}`;
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode) VALUES (${sourceId},'Category fixture','rss','T1','editorial')`;
  const { articleId } = await upsertMaterial({ sourceId, url: `https://example.com/${sourceId}`, title: "沃尔巴克氏体品系构建", bodyText: "品系构建与传代稳定性", bodyStatus: "ok", via: "fetch", publishedAt: new Date() });
  await sql`INSERT INTO analyses (article_id,input_revision,origin,relevance,category,tags,title_zh,summary_zh,score,selected)
    VALUES (${articleId},1,'rule','pass','symbiont',ARRAY['原始研究','沃尔巴克氏体'],'沃尔巴克氏体品系构建','冻结摘要',88,true)`;
  const [story] = await sql`INSERT INTO stories (public_id,title) VALUES (gen_random_uuid(),'工具事件') RETURNING id`;
  const [fact] = await sql`INSERT INTO facts (public_id,title,story_id) VALUES (${`f-${tag()}`},'工具发布',${story!.id}) RETURNING id`;
  await sql`INSERT INTO fact_articles (fact_id,article_id,role) VALUES (${fact!.id},${articleId},'report')`;
  await publishArticle(articleId, { releasedAt: new Date() });
  const entry = { itemId: articleId, title: "冻结标题", summary: "冻结摘要", sourceId, firstParty: true, role: "官方" };
  const contents = [
    { kind: "daily", key: "2097-01-02", content: { leadItemId: articleId, lead: { title: "冻结头条" }, highlights: [articleId], flashes: [], sections: [{ label: "共生菌与微生物组", items: [entry] }], metrics: { totalEvents: 1 } } },
    ...(["weekly", "monthly"] as const).map(kind => ({ kind, key: kind === "weekly" ? "2097-W01" : "2097-01", content: { headline: "冻结头条", leadItemId: articleId, storyOrder: [articleId], overview: "保留总述", themes: [{ heading: "共生菌与微生物组", summary: "旧栏目导读", storyRefs: [entry] }], metrics: { totalStories: 1 } } })),
  ];
  for (const r of contents) await sql`INSERT INTO reports (kind,key,window_start,window_end,content,generated_at,origin)
    VALUES (${r.kind},${r.key},now(),now(),${sql.json(r.content as never)},now(),'imported')`;
  const [before] = await sql`SELECT selected,seat,score,visible_after,selected_ready_at FROM publications WHERE article_id=${articleId}`;
  const change = (actor: string) => overrideFields(articleId, { fields: { category: "transmission", tags: ["方法与工具", "沃尔巴克氏体"] }, version: 0, reason: "测的是传播参数而非菌干预" }, actor);
  await sql.unsafe(`CREATE FUNCTION reject_category_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.actor = 'reject-category' THEN RAISE EXCEPTION 'category audit rejected'; END IF; RETURN NEW; END $$`);
  await sql.unsafe("CREATE TRIGGER reject_category_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_category_audit()");
  try {
    await assert.rejects(change("reject-category"), /category audit rejected/);
    assert.equal((await sql`SELECT category FROM publications WHERE article_id=${articleId}`)[0]!.category, "symbiont");
    assert.equal((await sql`SELECT 1 FROM report_revisions WHERE report_id IN (SELECT id FROM reports WHERE key IN ('2097-01-02','2097-W01','2097-01'))`).length, 0);
  } finally {
    await sql.unsafe("DROP TRIGGER reject_category_audit ON audit_log; DROP FUNCTION reject_category_audit()");
  }
  const digestCount = (await sql`SELECT count(*)::int AS n FROM pgboss.job WHERE name=${QUEUES.digest}`)[0]!.n;
  await change("test-category");
  for (const r of contents) {
    const [saved] = await sql`SELECT content,revision FROM reports WHERE kind=${r.kind} AND key=${r.key}`;
    assert.equal(saved!.revision, 2);
    const c = saved!.content;
    assert.equal(c.leadItemId, articleId);
    if (r.kind === "daily") {
      assert.deepEqual(c.sections, [{ label: "传播效能与媒介", items: [entry] }], "the entry moves to the new section");
      // RELEASE 为 null 时日报没有发布数这一列，corrections 也不去编一个；填了 RELEASE 才有得改。
      if (RELEASE === null) assert.equal("modelsReleased" in c.metrics, false, "没有 RELEASE 时不产出发布数");
      else assert.equal(c.metrics.modelsReleased, 0, "the release figure follows the new classification");
      assert.deepEqual(c.highlights, [articleId]);
      assert.equal(c.lead.title, "冻结头条");
    } else {
      assert.deepEqual(c.themes, [{ heading: "传播效能与媒介", summary: null, storyRefs: [entry] }]);
      assert.deepEqual(c.storyOrder, [articleId]);
      assert.equal(c.overview, "保留总述");
    }
  }
  assert.deepEqual((await sql`SELECT selected,seat,score,visible_after,selected_ready_at FROM publications WHERE article_id=${articleId}`)[0], before);
  assert.equal((await sql`SELECT count(*)::int AS n FROM pgboss.job WHERE name=${QUEUES.digest}`)[0]!.n, digestCount);
  await overrideFields(articleId, { fields: {}, clear: ["category", "tags"], version: 1, reason: "验证撤销纠错" }, "test-category");
  const [restored] = await sql`SELECT content FROM reports WHERE kind='daily' AND key='2097-01-02'`;
  assert.equal(restored!.content.sections[0].label, "共生菌与微生物组", "撤销纠错后回到原栏目");
  if (RELEASE !== null) assert.equal(restored!.content.metrics.modelsReleased, 1);
});
