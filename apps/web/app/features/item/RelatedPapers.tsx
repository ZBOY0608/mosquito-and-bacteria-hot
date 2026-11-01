// Papers near this one by meaning, inside the same track: the title and the journal it appeared in.
// Links only — the list is a reading suggestion, not a claim about the work.
import { Link } from "react-router";
import type { RelatedPaper } from "@aihot/contracts/site";

export function RelatedPapers({ papers }: { papers: RelatedPaper[] }) {
  return (
    <ul className="divide-y divide-line-soft">
      {papers.map((paper) => (
        <li key={paper.id} className="py-2.5 first:pt-0 last:pb-0">
          <Link viewTransition to={`/items/${paper.id}`} className="group block">
            <span className="line-clamp-2 text-[13px] font-medium leading-[1.6] text-ink-2 transition-colors group-hover:text-accent">{paper.title}</span>
            {paper.journal && <span className="mt-1 block truncate text-[11.5px] text-ink-4">{paper.journal}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
