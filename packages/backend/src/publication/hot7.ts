// The literature answer to the news-world hot list: what the site actually received and scored over the
// last seven days, by track and as a best-of list. Nothing here measures "discussion" — a paper has one
// source — so the numbers are the day's own: how much came in, how good it scored, what leads each track.
// Computed on read with an hour of cache; the multi-source machinery in events/hot.ts stays untouched.
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

export interface SevenDayHeat {
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

async function compute(): Promise<SevenDayHeat> {
  const days = 7;
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await sql<Row[]>`
    SELECT p.category, p.article_id AS item_id, p.title, p.summary, p.score, p.selected,
      a.raw->'literature'->>'journal' AS journal, s.id AS source_id, s.name AS source_name,
      coalesce(p.published_at, p.discovered_at) AS at
    FROM publications p JOIN sources s ON s.id = p.source_id JOIN articles a ON a.id = p.article_id
    WHERE ${listedCondition(new Date())} AND p.score IS NOT NULL AND NOT p.backfill
      AND p.timeline_at >= ${since}
    ORDER BY p.score DESC, at DESC`;
  const byTrack = new Map<string, TrackHeat>();
  for (const r of rows) {
    const key = r.category ?? "";
    const t = byTrack.get(key) ?? { key: r.category, label: label(r.category), count: 0, selectedCount: 0, top: null };
    t.count += 1;
    if (r.selected) t.selectedCount += 1;
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
    .slice(0, 20)
    .map(({ weighted: _w, ...p }) => p);
  return { days, computedAt: new Date().toISOString(), tracks, papers };
}

let cache: Cached<SevenDayHeat> | null = null;

/** The year's frontier board, cached for an hour: the numbers move slowly and the page reads them per request. */
export function sevenDayHeatCached(): Promise<SevenDayHeat> {
  if (!cache) {
    cache = cached(compute, { freshMs: 3_600_000, maxStaleMs: 6 * 3_600_000 });
  }
  return cache.get();
}
