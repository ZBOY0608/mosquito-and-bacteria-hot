// Turns on the abstract of the five literature lines and re-derives the papers already published, so an
// item stored before the change shows its abstract instead of only the site's reading of it. The switch
// is `site_fulltext` (a paper's body is its abstract); redistribution stays off. Safe to re-run: only
// sources still off are touched, and re-deriving changes nothing a reader already saw except the body.
//   node scripts/literature-abstracts.ts
import { closeDb, sql } from "@aihot/backend/db";
import { republishSource } from "@aihot/backend/publication/publish";

if (import.meta.main) {
  try {
    const sources = await sql<{ id: string }[]>`
      SELECT id FROM sources WHERE kind = 'external' AND id LIKE 'lit-%' AND NOT site_fulltext ORDER BY id`;
    for (const { id } of sources) {
      await sql`UPDATE sources SET site_fulltext = true, updated_at = now() WHERE id = ${id}`;
      const { total, changed, reduced } = await republishSource(id);
      console.log(`${id}: ${total} papers, ${changed} re-derived, ${reduced} withdrawn`);
    }
    if (sources.length === 0) console.log("every literature line already shows its abstract");
  } finally {
    await closeDb();
  }
}
