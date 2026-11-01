// The operator generates structured deep readings (目的/方法/创新性/结果) for already-published papers
// outside the site; this only stores what came in. Writes land on the paper's latest analysis row
// (analyses.output.deepRead) — the same row the item detail reads. Unknown article ids are reported
// back, never silently dropped; re-pushing a paper overwrites its previous reading (idempotent).
import { z } from "zod";
import { sql } from "../db.ts";
import { IngestError } from "./items.ts";

const SEGMENT = z.string().trim().min(1).max(300);
const DeepReadItem = z.object({
  articleId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  model: z.string().trim().min(1).max(80).catch("external"),
  deepRead: z.object({
    objective: SEGMENT.nullable().catch(null),
    methods: SEGMENT.nullable().catch(null),
    novelty: SEGMENT.nullable().catch(null),
    results: SEGMENT.nullable().catch(null),
  }),
});

const Batch = z.object({ items: z.array(DeepReadItem).min(1).max(100) });

/** Stores one reading on the paper's latest analysis row; false when the paper has no analysis at all. */
async function storeOne(articleId: string, deepRead: { objective: string | null; methods: string | null; novelty: string | null; results: string | null }, model: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [row] = await tx<{ id: number }[]>`
      SELECT id FROM analyses WHERE article_id = ${articleId} ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`;
    if (!row) return false;
    await tx`
      UPDATE analyses SET output = jsonb_set(output, '{deepRead}', ${tx.json({ ...deepRead, model } as never)}, true)
      WHERE id = ${row.id}`;
    return true;
  });
}

/**
 * @param body { items: [{ articleId, deepRead: {objective, methods, novelty, results}, model }] }
 * @returns { accepted, rejected: [{articleId, reason}] } — accepted counts papers stored; rejected
 * names unknown papers and batches over the size limit, so the operator can fix and re-push.
 */
export async function ingestDeepReads(body: unknown): Promise<{ accepted: number; rejected: Array<{ articleId: string; reason: string }> }> {
  const parsed = Batch.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new IngestError(400, first ? `${first.path.join(".") || "body"}: ${first.message}` : "invalid body");
  }
  const accepted = [];
  const rejected: Array<{ articleId: string; reason: string }> = [];
  for (const item of parsed.data.items) {
    const dr = item.deepRead;
    const hasAny = [dr.objective, dr.methods, dr.novelty, dr.results].some((v) => v !== null && v !== "");
    if (!hasAny) {
      rejected.push({ articleId: item.articleId, reason: "deepRead is empty" });
      continue;
    }
    if (await storeOne(item.articleId, dr, item.model)) accepted.push(item.articleId);
    else rejected.push({ articleId: item.articleId, reason: "no analysis for this article id" });
  }
  return { accepted: accepted.length, rejected };
}
