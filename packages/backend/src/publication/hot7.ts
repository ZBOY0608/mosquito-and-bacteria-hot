// The literature answer to the news-world hot list: what the site actually received and scored over the
// last year, grouped by track as the frontier board. Nothing here measures "discussion" — a paper has one
// source — so the numbers are the site's own: how much came in, what journal carried it, how it scored.
// Computed on read with an hour of cache; the multi-source machinery in events/hot.ts stays untouched.
import type { DeepRead } from "@aihot/contracts/site";
import { CATEGORIES } from "@aihot/industry/taxonomy";
import { sql } from "../db.ts";
import { cached, type Cached } from "../lib/cache.ts";
import { listedCondition } from "./scope.ts";
import { journalMetricsForItem, journalNameForSource } from "./journal-metrics.ts";

export interface TrackHeat {
  key: string | null;
  label: string;
  count: number;
  /** How many of the week's items cleared the selection line. */
  selectedCount: number;
  /** How many of the week's items carry a generated deep reading. */
  deepReadCount: number;
  /** The week's paper in the highest-impact journal (by the operator's metric table), tie by score. */
  top: { itemId: string; title: string; journal: string | null; quartile: string | null; impactFactor: string | null } | null;
}

export interface PaperHeat {
  itemId: string;
  title: string;
  summary: string | null;
  score: number;
  category: string | null;
  categoryLabel: string;
  sourceName: string;
  journal: string | null;
  quartile: string | null;
  impactFactor: string | null;
  isTop: boolean;
  at: string;
}

export interface FrontierBoard {
  days: number;
  computedAt: string;
  tracks: TrackHeat[];
  papers: PaperHeat[];
}

interface Row {
  category: string | null;
  item_id: string;
  title: string;
  summary: string | null;
  score: number;
  selected: boolean;
  source_id: string;
  journal: string | null;
  source_name: string;
  at: Date;
}

const label = (c: string | null) => CATEGORIES.find((x) => x.key === c)?.label ?? "其他";

async function compute(): Promise<FrontierBoard> {
  const days = 365;
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await sql<Row[]>`
    SELECT p.category, p.article_id AS item_id, p.title, p.summary, p.score, p.selected,
      a.raw->'literature'->>'journal' AS journal, s.id AS source_id, s.name AS source_name,
      coalesce(p.published_at, p.discovered_at) AS at
    FROM publications p JOIN sources s ON s.id = p.source_id JOIN articles a ON a.id = p.article_id
    WHERE ${listedCondition(new Date())} AND p.score IS NOT NULL AND NOT p.backfill
      AND p.timeline_at >= ${since}
    ORDER BY p.score DESC, at DESC`;
  // 精读覆盖:哪些条目已有生成的 deep reading(批量一次读,轨道卡显示「精读 X/Y」)。
  const ids = rows.map((r) => r.item_id);
  const drRows = ids.length
    ? await sql<{ article_id: string }[]>`
      SELECT p.article_id FROM publications p JOIN analyses an ON an.id = p.analysis_id
      WHERE p.article_id = ANY(${ids}::text[]) AND an.output ? 'deepRead'`
    : [];
  const deepRead = new Set(drRows.map((r) => r.article_id));
  const byTrack = new Map<string, TrackHeat>();
  for (const r of rows) {
    const key = r.category ?? "";
    const t = byTrack.get(key) ?? { key: r.category, label: label(r.category), count: 0, selectedCount: 0, deepReadCount: 0, top: null };
    t.count += 1;
    if (r.selected) t.selectedCount += 1;
    if (deepRead.has(r.item_id)) t.deepReadCount += 1;
    byTrack.set(key, t);
  }
  // 每条轨的代表作:发表期刊影响因子最高的那篇(表里没有的排最后),平分时先收录的先。
  const tracks = [...byTrack.values()].map((t) => {
    const trackRows = rows.filter((r) => (r.category ?? "") === (t.key ?? ""));
    const withIf = trackRows.map((r) => ({ r, m: journalMetricsForItem(r.journal, r.source_id) }));
    const best = withIf
      .map((x) => ({ x, ifv: x.m?.impactFactor ? parseFloat(x.m.impactFactor) : -1 }))
      .sort((a, b) => b.ifv - a.ifv || b.x.r.score - a.x.r.score || b.x.r.at.getTime() - a.x.r.at.getTime())[0];
    const topRow = best?.x.r ?? null;
    const top = topRow
      ? {
          itemId: topRow.item_id,
          title: topRow.title,
          journal: topRow.journal ?? journalNameForSource(topRow.source_id) ?? topRow.source_name,
          quartile: best?.x.m?.quartile ?? null,
          impactFactor: best?.x.m?.impactFactor ?? null,
        }
      : null;
    return { ...t, top };
  }).sort((a, b) => b.count - a.count);
  // 前沿文献榜:近一年,按「期刊影响因子加权 + AI 评分」排序——顶刊与大子刊浮在前面。
  // 期刊影响因子 × 2 是量纲桥(IF 21.9 的权重 ≈ 44 分),让期刊质量与内容评分同台竞争;
  // 表里没有的期刊只按评分排,顶刊徽章按影响因子 ≥ 10 判定(近似"1 区 Top"的语义)。
  const papers = rows
    .map((r) => {
      const m = journalMetricsForItem(r.journal, r.source_id);
      const ifv = m?.impactFactor ? parseFloat(m.impactFactor) : 0;
      const weighted = r.score + 2 * ifv;
      return {
        itemId: r.item_id,
        title: r.title,
        summary: r.summary,
        score: r.score,
        weighted,
        category: r.category,
        categoryLabel: label(r.category),
        sourceName: r.source_name,
        journal: r.journal ?? journalNameForSource(r.source_id),
        quartile: m?.quartile ?? null,
        impactFactor: m?.impactFactor ?? null,
        isTop: ifv >= 10,
        at: r.at.toISOString(),
      };
    })
    .sort((a, b) => b.weighted - a.weighted || b.at.localeCompare(a.at))
    .map(({ weighted: _w, ...p }) => p);
  return { days, computedAt: new Date().toISOString(), tracks, papers };
}

let cache: Cached<FrontierBoard> | null = null;

/** The year's frontier board (full ranked list), cached for an hour: the numbers move slowly. */
export function frontierBoardCached(): Promise<FrontierBoard> {
  if (!cache) {
    cache = cached(compute, { freshMs: 3_600_000, maxStaleMs: 6 * 3_600_000 });
  }
  return cache.get();
}

/** The board's top slice for the 前沿榜 landing section. */
export async function frontierTop(limit = 20): Promise<PaperHeat[]> {
  return (await frontierBoardCached()).papers.slice(0, limit);
}

/**
 * One track's full frontier list, each paper carrying its deep reading when generated. Reads through
 * the cached board, then batch-merges the deep readings for the track's papers.
 */
export async function trackPapers(
  key: string | null,
): Promise<{ key: string | null; label: string; count: number; selectedCount: number; deepReadCount: number; papers: Array<PaperHeat & { deepRead: DeepRead | null }> } | null> {
  const board = await frontierBoardCached();
  const papers = board.papers.filter((p) => (p.category ?? "") === (key ?? ""));
  if (papers.length === 0 && !board.tracks.some((t) => (t.key ?? "") === (key ?? ""))) return null;
  const ids = papers.map((p) => p.itemId);
  const drRows = ids.length
    ? await sql<{ article_id: string; dr: Record<string, any> | null }[]>`
      SELECT p.article_id, an.output->'deepRead' AS dr
      FROM publications p JOIN analyses an ON an.id = p.analysis_id
      WHERE p.article_id = ANY(${ids}::text[]) AND an.output ? 'deepRead'`
    : [];
  const drMap = new Map(drRows.map((r) => [r.article_id, deepReadOf(r.dr)]));
  const track = board.tracks.find((t) => (t.key ?? "") === (key ?? ""));
  return {
    key: key ?? null,
    label: track?.label ?? label(key),
    count: papers.length,
    selectedCount: track?.selectedCount ?? 0,
    deepReadCount: [...drMap.values()].filter((d) => d !== null).length,
    papers: papers.map((p) => ({ ...p, deepRead: drMap.get(p.itemId) ?? null })),
  };
}

/** deepReadOf for the read layer: same validation as the import, on a raw jsonb record. */
function deepReadOf(raw: Record<string, any> | null): DeepRead | null {
  if (!raw || typeof raw !== "object") return null;
  const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const read: DeepRead = {
    objective: text(raw.objective),
    methods: text(raw.methods),
    novelty: text(raw.novelty),
    results: text(raw.results),
  };
  return read.objective || read.methods || read.novelty || read.results ? read : null;
}
