// The papers nearest this one by meaning, inside its track: same category, not itself, not another report
// of the same event. Similarity is the cosine of the stored embeddings (0006); a paper that has none gets
// no section at all rather than a list of merely recent neighbours. The corpus changes once a day, so the
// answer is kept for an hour.
import { sql } from "../db.ts";
import { EMBEDDING_MODEL } from "../providers/embeddings.ts";

export interface RelatedPaper {
  id: string;
  title: string;
  journal: string | null;
  score: number | null;
}

const LIMIT = 3;
const FRESH_MS = 60 * 60 * 1000;
const kept = new Map<string, { at: number; papers: RelatedPaper[] }>();
const inflight = new Map<string, Promise<RelatedPaper[]>>();

/** A stored vector, whichever way the driver hands it over. */
function asVector(value: unknown): number[] | null {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === "string") {
    const parts = value.replace(/^\{|\}$/g, "").split(",").filter(Boolean).map(Number);
    return parts.length && parts.every((n) => Number.isFinite(n)) ? parts : null;
  }
  return null;
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! ** 2;
    nb += b[i]! ** 2;
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : -1;
}

async function nearest(articleId: string): Promise<RelatedPaper[]> {
  const [self] = await sql<{ category: string | null; fact_id: number | null; vector: unknown }[]>`
    SELECT p.category, p.fact_id, e.vector
    FROM publications p
    LEFT JOIN embeddings e ON e.kind = 'article' AND e.ref_id = p.article_id AND e.model = ${EMBEDDING_MODEL}
    WHERE p.article_id = ${articleId}`;
  const own = asVector(self?.vector);
  if (!self?.category || !own) return [];
  const rows = await sql<{ id: string; title: string; journal: string | null; score: number | null; vector: unknown }[]>`
    SELECT p.article_id AS id, p.title, a.raw->'literature'->>'journal' AS journal, p.score, e.vector
    FROM publications p
    JOIN articles a ON a.id = p.article_id
    JOIN embeddings e ON e.kind = 'article' AND e.ref_id = p.article_id AND e.model = ${EMBEDDING_MODEL}
    WHERE p.category = ${self.category} AND p.article_id <> ${articleId}
      AND p.visibility = 'public' AND p.eligible
      AND (${self.fact_id}::bigint IS NULL OR p.fact_id IS DISTINCT FROM ${self.fact_id}::bigint)`;
  return rows
    .map((row) => ({ row, similarity: cosine(own, asVector(row.vector) ?? []) }))
    .filter((entry) => entry.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, LIMIT)
    .map(({ row }) => ({ id: row.id, title: row.title, journal: row.journal, score: row.score }));
}

/** The three related papers of one item; empty when it has no embedding or no neighbours. */
export function relatedPapers(articleId: string): Promise<RelatedPaper[]> {
  const cached = kept.get(articleId);
  if (cached && Date.now() - cached.at < FRESH_MS) return Promise.resolve(cached.papers);
  const running = inflight.get(articleId);
  if (running) return running;
  const read = nearest(articleId)
    .then((papers) => {
      kept.set(articleId, { at: Date.now(), papers });
      // A day's worth of items is a few hundred entries; the oldest leave first and are read again later.
      while (kept.size > 500) kept.delete(kept.keys().next().value!);
      return papers;
    })
    .finally(() => inflight.delete(articleId));
  inflight.set(articleId, read);
  return read;
}
