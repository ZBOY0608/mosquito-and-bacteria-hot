// Fills in the figures a paper's metadata arrived without: one pass of the hourly `content.figures` job,
// with a printout, for the stock and for checking a single batch by hand.
//   node scripts/figures.ts [--limit 50]
import { closeDb } from "@aihot/backend/db";
import { fillFigureGaps } from "@aihot/backend/content/figures";

if (import.meta.main) {
  const at = process.argv.indexOf("--limit");
  const limit = at > 0 ? Number(process.argv[at + 1]) : 50;
  try {
    const { papers, figures, images } = await fillFigureGaps(Number.isFinite(limit) ? limit : 50);
    console.log(`papers ${papers}, figures ${figures}, images ${images}`);
  } finally {
    await closeDb();
  }
}
