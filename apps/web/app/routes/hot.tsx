import { useLoaderData } from "react-router";
import { IntentLink } from "../components/ui/IntentLink";
import type { Hot7Response, PaperHeat, TrackHeat } from "@aihot/contracts/site";
import { withSubject } from "@aihot/site";
import { apiGet, cachedPage } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta } from "../lib/seo";
import { monthDayTime } from "../lib/format";
import { EmptyState } from "../components/ui/Page";
import { IconChevronDown, IconInfo } from "../components/icons";
import { PhoneBar } from "../components/shell/PhoneBar";
import { navUp } from "../components/shell/nav";
import { scrollBehavior } from "../lib/motion";
import type { Screen } from "../components/shell/screens";

export const handle: Screen = { tab: navUp("/hot").tab, name: "热点" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: { request: Request }) {
  return cachedPage(600, { hot: await apiGet<Hot7Response>("/api/site/hot7", { signal: request.signal }) });
}

export function meta() {
  return pageMeta({
    title: withSubject("热点榜"),
    description: "近 7 天收录的文献按轨道汇总：每条轨收了多少、平均什么水平，以及评分最高的一批。",
    path: "/hot",
    image: "/og/pages/hot.png",
  });
}

const RANK_COLOR = ["text-rank-1", "text-rank-2", "text-rank-3"];
const rankColor = (rank: number) => RANK_COLOR[rank - 1] ?? "text-rank-rest";
const pad = (rank: number) => String(rank).padStart(2, "0");

/** One track's week: how much came in, how much cleared the bar, and the paper in the strongest journal. */
function TrackCard({ t }: { t: TrackHeat }) {
  const metricsLine = t.top && (t.top.quartile || t.top.impactFactor)
    ? [t.top.quartile, t.top.impactFactor].filter(Boolean).join("/")
    : null;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-bold text-ink">{t.label}</h2>
        <span className="num shrink-0 text-[12.5px] text-ink-4">
          {t.count} 篇{t.selectedCount > 0 ? ` · 精选 ${t.selectedCount}` : ""}
        </span>
      </div>
      {t.top && (
        <p className="mt-3 border-t border-line pt-3 text-[13.5px] leading-[1.6] text-ink-2">
          {metricsLine && <span className="mr-1.5 whitespace-nowrap text-[11.5px] font-semibold text-accent">{metricsLine}</span>}
          {t.top.journal && <span className="mr-1.5 whitespace-nowrap text-[11.5px] text-ink-4">{t.top.journal}</span>}
          <IntentLink viewTransition to={`/items/${t.top.itemId}`} className="transition-colors hover:text-accent">
            {t.top.title}
          </IntentLink>
        </p>
      )}
    </div>
  );
}

/** One row of the best-of list: rank, title, track and source, and the score it came in with. */
function PaperRow({ p, rank }: { p: PaperHeat; rank: number }) {
  return (
    <li className="group grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3.5 transition-colors hover:bg-bg-sunk/70 sm:px-5 dark:hover:bg-bg-muted/40">
      <span className={`num text-[16px] font-semibold leading-[24px] ${rankColor(rank)}`} aria-label={`评分排名第 ${rank} 位`}>
        {pad(rank)}
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-[650] leading-[1.55] text-ink">
          <IntentLink viewTransition to={`/items/${p.itemId}`} className="transition-colors hover:text-accent">
            {p.title}
          </IntentLink>
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[12px] text-ink-4">
          <span className="rounded-full bg-bg-sunk px-2 py-0.5 text-[11.5px] text-ink-3">{p.categoryLabel}</span>
          <span>{p.sourceName}</span>
          <span className="num">{p.at.slice(5, 10).replace("-", "/")}</span>
        </div>
      </div>
      <span className="num text-[20px] font-semibold leading-none text-ink">{p.score}</span>
    </li>
  );
}

/** Opens "榜单是怎么算的" at the foot of the page and brings it into view. */
function showMethod() {
  const method = document.getElementById("hot-method") as HTMLDetailsElement | null;
  if (!method) return;
  method.open = true;
  method.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
}

export default function HotPage() {
  const { hot } = useLoaderData<typeof loader>();
  return (
    <div className="pb-10">
      <PhoneBar
        title="热点"
        large
        sub={
          <>
            近 {hot.days} 天收录 {hot.papers.length} 篇 · {hot.tracks.length} 条轨道
            {hot.computedAt && (
              <>
                {" · "}
                <span className="num">{monthDayTime(hot.computedAt)}</span> 更新
              </>
            )}
          </>
        }
        actions={
          <button type="button" onClick={showMethod} className="flex h-11 items-center gap-1 px-3 text-[14px] text-accent active:opacity-50">
            <IconInfo size={17} /> 怎么算
          </button>
        }
      />
      <header className="hidden flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-5 pt-1 lg:flex">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] text-hot">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-hot opacity-30" />
              <span className="relative inline-flex size-2 rounded-full bg-hot" />
            </span>
            近 7 天
          </div>
          <h1 className="mt-1.5 text-[24px] font-bold leading-[1.3] tracking-[-0.01em] text-ink lg:text-[26px]">{withSubject("热点榜")}</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-3">
            近 {hot.days} 天收录 {hot.papers.length} 篇文献 · {hot.tracks.length} 条轨道
          </p>
        </div>
        {hot.computedAt && (
          <p className="text-[12px] text-ink-4">
            <span className="num">{monthDayTime(hot.computedAt)}</span> 更新 · 按评分与轨道汇总
          </p>
        )}
      </header>

      {hot.papers.length === 0 ? (
        <div className="card rounded-sheet">
          <EmptyState title="近 7 天还没有收录">站点恢复收录后，这里会汇总每条轨道的收成和评分最高的文献。</EmptyState>
        </div>
      ) : (
        <>
          {hot.tracks.length > 0 && (
            <section aria-label="轨道热度" className="grid grid-cols-1 gap-3 @[760px]:grid-cols-2 @[1040px]:grid-cols-3">
              {hot.tracks.map((t) => (
                <TrackCard key={t.key ?? "other"} t={t} />
              ))}
            </section>
          )}

          <section aria-label="高分文献榜" className="mt-7">
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="text-[15px] font-semibold text-ink">高分文献榜</h2>
              <span className="hidden text-[12px] text-ink-4 lg:block">近 {hot.days} 天 · 按 AI 评分排序</span>
            </div>
            <ol className="card divide-y divide-line-soft overflow-hidden">
              {hot.papers.map((p, i) => (
                <PaperRow key={p.itemId} p={p} rank={i + 1} />
              ))}
            </ol>
          </section>
        </>
      )}

      <details id="hot-method" className="disclosure group/method mt-8 scroll-mt-[calc(var(--bar-h)+16px)] text-[12px] text-ink-4">
        <summary className="flex items-center gap-1.5 py-1 transition-colors hover:text-ink-2">
          <IconInfo size={15} />
          榜单是怎么算的？
          <span className="ml-auto inline-flex items-center gap-0.5">
            <span className="group-open/method:hidden">了解榜单</span>
            <span className="hidden group-open/method:inline">收起</span>
            <IconChevronDown size={13} className="transition-transform duration-200 group-open/method:rotate-180" />
          </span>
        </summary>
        <div className="max-w-[760px] space-y-2 pb-2 pl-[21px] pt-2 leading-[1.75] text-ink-3">
          <p>榜单看的是近 7 天收录、经过 AI 评分的全部文献：每条轨道给收录量和平均分，高分榜按评分排序，同分看收录先后。</p>
          <p>评分反映证据强度、新颖性、相关度、影响与可执行性（五维加权），不代表讨论热度，也不是期刊的影响因子。一个文献站没有"讨论热度"——一篇论文通常只有一个来源。</p>
          <p>只统计公开可见的收录；被下架或调整为仅摘要的条目会从榜单移除。每小时刷新一次。</p>
        </div>
      </details>
    </div>
  );
}
