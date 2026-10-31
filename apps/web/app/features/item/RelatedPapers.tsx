// Papers near this one by meaning, inside the same track: the title, the journal it appeared in and the
// site's score. Links only — the list is a reading suggestion, not a claim about the work.
import { Link } from "react-router";
import type { RelatedPaper } from "@aihot/contracts/site";

export function RelatedPapers({ papers }: { papers: RelatedPaper[] }) {
  return (
    <ul className="divide-y divide-line-soft">
      {papers.map((paper) => (
        <li key={paper.id} className="py-2.5 first:pt-0 last:pb-0">
          <Link viewTransition to={`/items/${paper.id}`} className="group block">
            <span className="line-clamp-2 text-[13px] font-medium leading-[1.6] text-ink-2 transition-colors group-hover:text-accent">{paper.title}</span>
            <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-4">
              {paper.journal && <span className="truncate">{paper.journal}</span>}
              {paper.journal && paper.score !== null && <span aria-hidden="true">·</span>}
              {paper.score !== null && <span className="num whitespace-nowrap">AI {Math.round(paper.score)}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
