// The literature answer to the news-world hot list: what the site actually received and scored over the
// last seven days, by track and as a best-of list. Nothing here measures "discussion" — a paper has one
// source — so the numbers are the day's own: how much came in, how good it scored, what leads each track.
// Computed on read with an hour of cache; the multi-source machinery in events/hot.ts stays untouched.
import { CATEGORIES } from "@aihot/industry/taxonomy";
import { sql } from "../db.ts";
import { cached, type Cached } from "../lib/cache.ts";
import { listedCondition } from "./scope.ts";

export interface TrackHeat {
  key: string | null;
  label: string;
  count: number;
  avgScore: number | null;
  top: { itemId: string; title: string; score: number } | null;
}

export interface PaperHeat {
  itemId: string;
  title: string;
  summary: string | null;
  score: number;
  category: string | null;
  categoryLabel: string;
  sourceName: string;
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
  source_name: string;
  at: Date;
}

const label = (c: string | null) => CATEGORIES.find((x) => x.key === c)?.label ?? "其他";

async function compute(): Promise<SevenDayHeat> {
  const days = 7;
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await sql<Row[]>`
    SELECT p.category, p.article_id AS item_id, p.title, p.summary, p.score, s.name AS source_name,
      coalesce(p.published_at, p.discovered_at) AS at
    FROM publications p JOIN sources s ON s.id = p.source_id
    WHERE ${listedCondition(new Date())} AND p.score IS NOT NULL AND NOT p.backfill
      AND p.timeline_at >= ${since}
    ORDER BY p.score DESC, at DESC`;
  const byTrack = new Map<string, TrackHeat>();
  for (const r of rows) {
    const key = r.category ?? "";
    const t = byTrack.get(key) ?? { key: r.category, label: label(r.category), count: 0, avgScore: null, top: null };
    t.count += 1;
    if (t.top === null) t.top = { itemId: r.item_id, title: r.title, score: r.score };
    byTrack.set(key, t);
  }
  const tracks = [...byTrack.values()].map((t) => {
    const scored = rows.filter((r) => (r.category ?? "") === (t.key ?? "")).map((r) => r.score);
    return { ...t, avgScore: scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null };
  }).sort((a, b) => b.count - a.count);
  const papers = rows.slice(0, 10).map((r) => ({
    itemId: r.item_id,
    title: r.title,
    summary: r.summary,
    score: r.score,
    category: r.category,
    categoryLabel: label(r.category),
    sourceName: r.source_name,
    at: r.at.toISOString(),
  }));
  return { days, computedAt: new Date().toISOString(), tracks, papers };
}

let cache: Cached<SevenDayHeat> | null = null;

/** The seven-day heat, cached for an hour: the numbers move slowly and the page reads them per request. */
export function sevenDayHeatCached(): Promise<SevenDayHeat> {
  if (!cache) {
    cache = cached(compute, { freshMs: 3_600_000, maxStaleMs: 6 * 3_600_000 });
  }
  return cache.get();
}
