// Item detail and Markdown export, both behind the same visibility and licence rules.
import type { KeyFinding, LiteratureFigure, LiteratureMeta, OutlineEntry, SiteItemDetail, StoryRef } from "@aihot/contracts/site";
import { ITEM_COPY, SITE } from "@aihot/site";
import { bodyToMarkdown } from "../content/markdown.ts";
import { sql } from "../db.ts";
import { collapseWhitespace, stripTagMarkup } from "../lib/text.ts";
import { proxyBodyImages } from "../media/imgproxy.ts";
import { textToHtml } from "../content/sanitize.ts";
import { exportTranslation, isChineseBody, ITEM_COLUMNS, ITEM_FROM, seatHolders, showsPost, toItemSummary, xView, type ItemRow } from "./items.ts";
import { evidenceCondition, listedCondition } from "./scope.ts";
import { itemUrl, siteUrl } from "./links.ts";
import { hasItemPage, publicSourceName } from "./rules.ts";
import { topicLinks, topicMembership } from "./topics.ts";

interface DetailRow extends ItemRow {
  raw: Record<string, any> | null;
  fact: Record<string, any> | null;
  body_html: string | null;
  body_text: string | null;
  body_status: string;
  tr_html: string | null;
  tr_complete: boolean | null;
  topics: string[];
}

export type DetailResult =
  | { kind: "found"; item: SiteItemDetail; row: DetailRow }
  | { kind: "not_found" };

/** Adds stable ids to h2–h4 and returns the outline. */
function withOutline(html: string): { html: string; outline: OutlineEntry[] } {
  const outline: OutlineEntry[] = [];
  let n = 0;
  const out = html.replace(/<h([2-4])(?: id="sec-\d+")?>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => {
    n += 1;
    const id = `sec-${n}`;
    const text = stripTagMarkup(inner, "").trim();
    if (text) outline.push({ id, text: text.slice(0, 80), level: Number(level) });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, outline };
}

async function loadRow(id: string): Promise<DetailRow | null> {
  const [row] = await sql<DetailRow[]>`
    SELECT ${ITEM_COLUMNS}, a.raw, an.output->'fact' AS fact, a.body_html, a.body_text, a.body_status, tr.body_html AS tr_html, tr.complete AS tr_complete,
      ${topicMembership()} AS topics
    ${ITEM_FROM}
    LEFT JOIN analyses an ON an.id = p.analysis_id
    WHERE p.article_id = ${id}`;
  return row ?? null;
}

/**
 * What the paper claims, as the selection read it: who was studied, what was done (in Chinese), the
 * finding itself quoted from the original, and the design it was found under. An analysis that carried no
 * fact gets no card, and a field the model left out stays absent rather than being filled in.
 */
function keyFindingOf(fact: Record<string, any> | null): KeyFinding | null {
  if (!fact || typeof fact !== "object") return null;
  // The model's sentences sometimes keep a space before their final stop; a quote should read as text.
  const text = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? collapseWhitespace(v.trim()).replace(/\s+([,.;:!?])/g, "$1") : null;
  const conditions = (Array.isArray(fact.conditions) ? fact.conditions : [])
    .map((c: any) => ({ text: text(c?.text), quote: text(c?.quote) }))
    .filter((c: { text: string | null }): c is { text: string; quote: string | null } => c.text !== null);
  const finding: KeyFinding = {
    subject: text(fact.subject),
    action: text(fact.action),
    object: text(fact.object),
    evidence: text(fact.evidence),
    conditions,
  };
  return finding.subject || finding.action || finding.object || finding.evidence ? finding : null;
}

/**
 * A paper's own metadata, as received at ingest. Only the fields a reader needs: the journal and where in
 * it the paper sits, who wrote it and where the first author works, the identifiers, and the figures the
 * open-access full text carries. Anything missing is simply absent, never invented.
 */
function literatureOf(raw: Record<string, any> | null): LiteratureMeta | null {
  const lit = raw?.literature;
  if (!lit || typeof lit !== "object") return null;
  const name = (a: any) => [a?.firstName, a?.lastName].filter((x) => typeof x === "string" && x.trim()).join(" ").trim();
  const authors = (Array.isArray(lit.authors) ? lit.authors : [])
    .map((a: any) => ({ name: name(a), affiliation: typeof a?.affiliation === "string" && a.affiliation.trim() ? a.affiliation.trim() : null }))
    .filter((a: { name: string }) => a.name);
  const figures: LiteratureFigure[] = (Array.isArray(lit.figures) ? lit.figures : [])
    .filter((f: any) => f && typeof f.caption === "string" && f.caption.trim())
    .map((f: any) => ({ label: typeof f.label === "string" ? f.label.trim() || null : null, caption: f.caption.trim(), url: typeof f.url === "string" && f.url ? f.url : null, license: typeof f.license === "string" ? f.license : null }));
  return {
    journal: lit.journal || null,
    journalAbbr: lit.journal_abbr || null,
    doi: lit.doi || null,
    pmid: lit.pmid || null,
    pmcid: lit.pmcid || null,
    volume: lit.volume || null,
    issue: lit.issue || null,
    pages: lit.pages || null,
    publishedAt: lit.pubdate || null,
    pubtypes: Array.isArray(lit.pubtypes) ? lit.pubtypes.filter((t: unknown) => typeof t === "string") : [],
    isReview: !!lit.is_review,
    authors,
    figures,
  };
}

/**
 * The body a page reads in `language` when it has it, else in the other: Chinese is the article's own text
 * or a translation (shown even before it is complete), the original only the article's own. `page` turns
 * the HTML shown into what is sent, with its outline.
 */
function readingBody(
  language: "zh" | "original",
  zh: { html: string; kind: "translation" | "original" } | null,
  original: string | null,
  complete: boolean,
  page: (html: string) => { html: string; outline: OutlineEntry[] },
): Pick<SiteItemDetail, "body" | "outline" | "hasTranslation" | "bodyLanguage"> {
  const bodyLanguage = language === "original" && original ? "original" : zh?.html ? "zh" : "original";
  const shown = bodyLanguage === "zh" ? zh!.html : original;
  const sent = shown ? page(shown) : { html: shown, outline: [] };
  return {
    body: { zh: bodyLanguage === "zh" ? sent.html : null, original: bodyLanguage === "original" ? sent.html : null, zhKind: zh?.kind ?? null, complete },
    outline: sent.outline,
    hasTranslation: zh?.kind === "translation" && !!zh.html && !!original,
    bodyLanguage,
  };
}

/**
 * Public detail (rules.hasItemPage) in one language, Chinese unless the original is asked for: items the
 * lists leave out (low relevance, merged duplicates, no Chinese summary yet) keep a noindex page;
 * withdrawn and hot_signal items are a 404.
 */
export async function loadItemDetail(id: string, language: "zh" | "original" = "zh", now = new Date()): Promise<DetailResult> {
  const row = await loadRow(id);
  if (!row || !hasItemPage({ visibility: row.visibility, sourceMode: row.source_mode })) return { kind: "not_found" };

  const summary = toItemSummary(row);
  if (row.visibility === "summary-only") {
    const item: SiteItemDetail = {
      ...summary,
      selected: false,
      score: null,
      category: null,
      story: null,
      reason: null,
      tags: [],
      x: null,
      readingMode: "summary-only",
      literature: literatureOf(row.raw),
      keyFinding: keyFindingOf(row.fact),
      author: null,
      body: null,
      outline: [],
      relatedStories: [],
      topics: [],
      indexable: false,
      markdownAvailable: false,
      group: null,
      hasTranslation: false,
      bodyLanguage: "original",
    };
    return { kind: "found", item, row };
  }

  const related = await sql<StoryRef[]>`
    SELECT DISTINCT st.public_id::text AS "publicId", st.title
    FROM fact_articles fa JOIN facts f ON f.id = fa.fact_id JOIN stories st ON st.id = f.story_id
    WHERE fa.article_id = ${id} AND fa.role <> 'mention' AND st.merged_into IS NULL
    ORDER BY "publicId" LIMIT 6`;

  let x: SiteItemDetail["x"] = null;
  let reading: Pick<SiteItemDetail, "body" | "outline" | "hasTranslation" | "bodyLanguage"> = { body: null, outline: [], hasTranslation: false, bodyLanguage: "original" };
  if (showsPost(row)) {
    const post = xView(row, false, true);
    const text = String(row.x_post?.text ?? row.body_text ?? "");
    // A post's text is sent as written: its headings make the outline, without anchors.
    if (post?.translation || text.trim()) reading = readingBody(language, post?.translation ? { html: textToHtml(post.translation), kind: "translation" } : null, text.trim() ? textToHtml(text) : null, true,
      (html) => ({ html, outline: withOutline(html).outline }));
    if (post) {
      const { text: _text, translation: _translation, ...shown } = post;
      x = shown;
    }
  } else if (row.body_mode === "full" && (row.body_html || row.body_text)) {
    // A paper's body is its abstract, pushed as text with no markup: the page shows it as paragraphs.
    const bodyHtml = row.body_html ?? textToHtml(row.body_text ?? "");
    const chinese = isChineseBody(row);
    const zh = chinese ? { html: bodyHtml, kind: "original" as const } : row.tr_html ? { html: row.tr_html, kind: "translation" as const } : null;
    reading = readingBody(language, zh, chinese ? null : bodyHtml, chinese ? true : row.tr_complete ?? false, (html) => withOutline(proxyBodyImages(html)));
  }

  let group: SiteItemDetail["group"] = null;
  if (row.fact_id) {
    const [g] = await sql<{ public_id: string; reports: number; sources: number }[]>`
      SELECT f.public_id, count(p.article_id) AS reports, count(DISTINCT p.source_id) AS sources
      FROM facts f JOIN fact_articles fa ON fa.fact_id = f.id JOIN publications p ON p.article_id = fa.article_id
      WHERE f.id = ${row.fact_id} AND ${evidenceCondition()} AND ${listedCondition(now)}
      GROUP BY f.public_id`;
    if (g) {
      group = {
        factId: g.public_id,
        reportCount: Number(g.reports),
        additionalSourceCount: Math.max(0, Number(g.sources) - 1),
      };
    }
  }

  // The reason goes with the seat; a report yielding it points to the one holding it.
  const sameEvent = (await seatHolders([row], now)).get(row.id) ?? null;
  const item: SiteItemDetail = {
    ...summary,
    x,
    ...(sameEvent ? { reason: null, sameEvent } : {}),
    readingMode: "full",
    literature: literatureOf(row.raw),
    keyFinding: keyFindingOf(row.fact),
    author: row.author,
    body: reading.body,
    outline: reading.outline,
    relatedStories: related,
    topics: topicLinks(row.topics),
    indexable: row.indexable,
    markdownAvailable: markdownAvailable(row),
    group,
    hasTranslation: reading.hasTranslation,
    bodyLanguage: reading.bodyLanguage,
  };
  return { kind: "found", item, row };
}

/**
 * Same predicate for the export button and the export route: a public page with something to export
 * (a summary, the post where pages show it, or a full-text body).
 */
export function markdownAvailable(row: {
  visibility: string; source_mode: string; summary: string | null; body_mode: string; body_html?: string | null; body_text?: string | null; channel: string; x_post: Record<string, any> | null;
}): boolean {
  if (row.visibility !== "public" || !hasItemPage({ visibility: row.visibility, sourceMode: row.source_mode })) return false;
  return !!row.summary || (showsPost(row) && (!!row.x_post?.text || !!row.x_post?.media?.length || !!row.x_post?.quoted?.text)) || (row.body_mode === "full" && (!!row.body_html || !!row.body_text));
}

export async function exportMarkdown(id: string): Promise<{ filename: string; body: string } | null> {
  const row = await loadRow(id);
  if (!row || !markdownAvailable(row)) return null;
  const lines: string[] = [];
  lines.push(`# ${row.title}`, "");
  if (row.original_title) lines.push(`> 原标题：${row.original_title}`, "");
  lines.push(`- 来源：${publicSourceName(row.source_name)}`);
  // Without a reliable date from the original, the time it was collected says so.
  lines.push(row.published_at ? `- 发布时间：${row.published_at.toISOString()}` : `- 收录时间：${row.discovered_at.toISOString()}`);
  lines.push(`- ${SITE.name}：${itemUrl(row.id)}`);
  lines.push(`- 原文：${row.url}`, "");
  if (row.summary) lines.push("## 摘要", "", row.summary, "");
  if (row.selected && row.seat && row.reason) lines.push(`## ${ITEM_COPY.reasonLabel}`, "", row.reason, "");
  if (showsPost(row) && row.x_post) {
    const post = xView(row);
    if (post?.text) lines.push("## 正文", "", post.text, "");
    if (post?.translation) lines.push("## 中文译文", "", post.translation, "");
    for (const media of post?.media ?? []) {
      const url = media.url.startsWith("/") ? siteUrl(media.url) : media.url;
      lines.push(media.kind === "image" ? `![${media.alt ?? ""}](${url})` : `[视频](${url})`, "");
    }
    const q = post?.quoted;
    if (q?.text) lines.push(`## 引用 @${q.handle ?? ""}`, "", ...String(q.text).split("\n").map((l) => `> ${l}`), "", ...(q.url ? [q.url, ""] : []));
    if (q?.text && q.translation) lines.push("### 引用中文译文", "", ...q.translation.split("\n").map((l) => `> ${l}`), "");
  } else if (row.body_mode === "full" && (row.body_html || row.body_text)) {
    const translation = exportTranslation(row);
    if (translation) lines.push("## 正文 · 中文译文", "", bodyToMarkdown(translation, row.url), "");
    const bodyHtml = row.body_html ?? textToHtml(row.body_text ?? "");
    // A paper's body is its abstract: the export says so instead of calling it the article.
    const heading = isChineseBody(row) ? "## 正文" : row.raw?.literature ? "## 原文摘要" : "## 正文 · 原文";
    lines.push(heading, "", bodyToMarkdown(bodyHtml, row.url), "");
  }
  return { filename: `${SITE.mcpPrefix}-${row.id}.md`, body: lines.join("\n").replace(/\n{3,}/g, "\n\n") };
}
