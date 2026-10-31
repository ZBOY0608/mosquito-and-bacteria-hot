// Computes the article embeddings the related-papers section (and event recall) reads, for the published
// items that have none yet. Paid model calls through the usual receipts, so it needs model calls on and an
// embeddings key; a paper's text is its title, the site's summary and the abstract it came with.
//   node scripts/embed-articles.ts [--limit 300]
import { closeDb, sql } from "@aihot/backend/db";
import { ensureEmbeddings, embeddingsAvailable, EMBEDDING_MODEL } from "@aihot/backend/providers/embeddings";

if (import.meta.main) {
  try {
    if (!embeddingsAvailable()) {
      console.log("embeddings are off: set EMBEDDING_API_KEY (or DASHSCOPE_API_KEY) and MODEL_CALLS_ENABLED=true");
      process.exitCode = 1;
    } else {
      const at = process.argv.indexOf("--limit");
      const limit = at > 0 ? Number(process.argv[at + 1]) : 300;
      const rows = await sql<{ id: string; text: string }[]>`
        SELECT p.article_id AS id, concat_ws(E'\n\n', p.title, p.summary, a.body_text) AS text
        FROM publications p
        JOIN articles a ON a.id = p.article_id
        LEFT JOIN embeddings e ON e.kind = 'article' AND e.ref_id = p.article_id AND e.model = ${EMBEDDING_MODEL}
        WHERE p.visibility = 'public' AND e.ref_id IS NULL
        ORDER BY p.timeline_at DESC
        LIMIT ${Number.isFinite(limit) ? limit : 300}`;
      if (rows.length === 0) {
        console.log("every published item already has its embedding");
      } else {
        const vectors = await ensureEmbeddings(rows.map((row) => ({ id: row.id, text: row.text ?? "" })));
        console.log(`${vectors.size} embeddings stored (${EMBEDDING_MODEL})`);
      }
    }
  } finally {
    await closeDb();
  }
}
