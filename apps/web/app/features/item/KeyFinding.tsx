// The paper's own claim, next to the site's reading of it: one line of who was studied and what was
// found, then the sentence of the original that carries the finding and the design it was found under.
// The English is quoted, never translated here; anything the analysis left out is simply absent.
import type { KeyFinding as Finding } from "@aihot/contracts/site";

/** 研究对象 · 动作 · 对象/结论, in one line, skipping whatever the analysis left out. */
export function keyFindingLine(finding: Finding): string {
  return [finding.subject, finding.action, finding.object].filter(Boolean).join(" · ");
}

const SUMMARY = "cursor-pointer select-none text-[12.5px] leading-[1.6] text-ink-3 transition-colors hover:text-accent";

function Quote({ children }: { children: string }) {
  return (
    <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-[13.5px] leading-[1.75] text-ink-2">
      {children}
      <span className="mt-1 block text-[11.5px] text-ink-4">摘自原文</span>
    </blockquote>
  );
}

export function KeyFinding({ finding }: { finding: Finding }) {
  // The first line is what the card is for; the quoted sentences open on demand.
  const line = keyFindingLine(finding);
  if (!line && !finding.evidence && finding.conditions.length === 0) return null;
  return (
    <section className="mt-7 rounded-control border border-line-soft bg-bg-sunk px-4 py-4 xl:px-5">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold text-accent">关键发现</span>
        <span className="text-[11.5px] text-ink-4">按原文摘要整理</span>
      </div>
      {line && <p className="text-[15.5px] leading-[1.72] text-ink">{line}</p>}
      {finding.evidence && (
        <details className="mt-3 border-t border-line-soft pt-3">
          <summary className={SUMMARY}>原文依据（英文原句）</summary>
          <Quote>{finding.evidence}</Quote>
        </details>
      )}
      {finding.conditions.length > 0 && (
        <details className="mt-2 border-t border-line-soft pt-3">
          <summary className={SUMMARY}>研究设计 · {finding.conditions.length} 条</summary>
          <ul className="mt-2 space-y-2.5 border-l-2 border-line-strong pl-3">
            {finding.conditions.map((condition, i) => (
              <li key={`${i}-${condition.text.slice(0, 16)}`}>
                <p className="text-[13.5px] leading-[1.72] text-ink-2">{condition.text}</p>
                {/* The deposit often repeats the design sentence verbatim; showing it twice says nothing. */}
                {condition.quote && condition.quote !== condition.text && (
                  <p className="mt-0.5 text-[12.5px] leading-[1.7] text-ink-3">“{condition.quote}”</p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 pl-3 text-[11.5px] text-ink-4">摘自原文</p>
        </details>
      )}
    </section>
  );
}
