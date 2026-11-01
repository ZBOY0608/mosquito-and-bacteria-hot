import { ITEM_COPY } from "@aihot/site";

/**
 * The AI score as a small pill, tinted by tier instead of drawn as a bar: strong picks (85+) in a wash of
 * warm red, solid ones (70+) in the accent, the rest as quiet text. The score itself is unchanged.
 */
const TIERS = [
  { min: 85, className: "bg-hot/10 text-hot ring-hot/25" },
  { min: 70, className: "bg-accent-soft text-accent ring-accent/20" },
  { min: 0, className: "text-ink-4 ring-line-soft" },
];

/** The score readers see: none when the site keeps scores from them. */
export function shownScore(score: number | null): number | null {
  return ITEM_COPY.showScore ? score : null;
}

/** "AI 评分 · 88" on desktop cards; `compact` keeps only the number (phones). */
export function ScoreLabel({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const shown = shownScore(score);
  if (shown === null) return null;
  const value = Math.round(shown);
  const tier = TIERS.find((t) => value >= t.min)!;
  return (
    <span
      title={`AI 评分 ${value}/100`}
      aria-label={`AI 评分 ${value} 分`}
      className={`inline-flex h-[20px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 ring-1 ring-inset ${tier.className}`}
    >
      {!compact && (
        <>
          <span className="text-[11px] font-medium leading-none opacity-80">AI 评分</span>
          <span className="h-2.5 w-px bg-current opacity-25" aria-hidden="true" />
        </>
      )}
      <span className="mono text-[12.5px] font-bold leading-none tabular-nums">{value}</span>
    </span>
  );
}

export interface JournalMetricsView {
  impactFactor: string | null;
  quartile: string | null;
}

/**
 * The journal's own standing instead of a score, where the metric table knows the journal: 分区在前
 * ("Q1/6.7"), parts missing stay absent, and an unmatched journal falls back to the score pill.
 */
export function JournalMetricsLabel({ metrics, compact = false }: { metrics: JournalMetricsView | null; compact?: boolean }) {
  if (!metrics || (!metrics.quartile && !metrics.impactFactor)) return null;
  const parts = [metrics.quartile, metrics.impactFactor].filter((v): v is string => !!v);
  return (
    <span
      title={`JCR 分区 / 影响因子 · 数据来源：JCR 2026`}
      aria-label={`该期刊 JCR 分区与影响因子：${parts.join(" / ")}`}
      className="inline-flex h-[20px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 ring-1 ring-inset ring-accent/20"
    >
      {!compact && <span className="text-[11px] font-medium leading-none opacity-80">JCR</span>}
      <span className="mono text-[12.5px] font-bold leading-none tabular-nums text-accent">{parts.join("/")}</span>
    </span>
  );
}
