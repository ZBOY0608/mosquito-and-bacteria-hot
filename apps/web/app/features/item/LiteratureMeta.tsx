// What a paper says about itself, next to the site's own reading of it: the journal and where the paper
// sits in it, who wrote it and where the first author works, and the figures of the open-access full text.
// Nothing here is generated: it is the deposit's own metadata, shown as received. The identifiers and the
// journal metrics are plain text on purpose — the one way out to the original is the top-right button.
import type { LiteratureAuthor, LiteratureFigure, LiteratureMeta } from "@aihot/contracts/site";

/** 综述 / 原始研究: the two things a reader of this site decides between at a glance. */
export function paperType(meta: LiteratureMeta): string {
  const types = meta.pubtypes.join(" ").toLowerCase();
  if (meta.isReview || types.includes("review")) return "综述";
  if (types.includes("clinical trial")) return "临床试验";
  if (types.includes("meta-analysis")) return "Meta 分析";
  return "原始研究";
}

/** 许可写成短码：Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 -> CC BY-NC-ND 4.0 */
export function shortLicense(name: string): string {
  const m = /^Creative Commons (.+?)\s*(\d\.\d)$/i.exec(name.trim());
  if (!m) return name;
  const codes = m[1]
    .split("-")
    .map((part) => ({ attribution: "BY", noncommercial: "NC", noderivatives: "ND", sharealike: "SA" })[part.trim().toLowerCase()] ?? part.trim())
    .join("-");
  return `CC ${codes} ${m[2]}`;
}

/** Identifiers as plain text: they identify, they are not doors out to the publisher. */
export function LiteratureIds({ meta }: { meta: LiteratureMeta }) {
  return (
    <>
      {meta.doi && <span>DOI {meta.doi}</span>}
      {meta.pmid && <span>PubMed {meta.pmid}</span>}
      {meta.pmcid && <span>PMC {meta.pmcid.replace(/^PMC/i, "")}</span>}
    </>
  );
}

/** Journal, volume(issue):pages, paper type, metrics, identifiers: one line under the English title. */
export function LiteratureLine({ meta }: { meta: LiteratureMeta }) {
  const place = [meta.volume ? `${meta.volume}${meta.issue ? `(${meta.issue})` : ""}` : "", meta.pages || ""].filter(Boolean).join(": ");
  const metrics = meta.metrics ?? null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-relaxed text-ink-3">
      {meta.journal && <span className="font-medium text-ink-2">{meta.journal}</span>}
      {place && <span className="mono text-[12.5px]">· {place}</span>}
      <span>· {paperType(meta)}</span>
      {metrics?.impactFactor && <span>· IF {metrics.impactFactor}</span>}
      {metrics?.quartile && <span>· JCR {metrics.quartile}</span>}
      {metrics?.source && <span className="text-[11.5px] text-ink-4">(数据来源：{metrics.source})</span>}
      <span className="flex items-center gap-2">
        <LiteratureIds meta={meta} />
      </span>
    </div>
  );
}

/** Every author as deposited; the first affiliation is what a reader usually wants to know. */
export function LiteratureAuthors({ authors }: { authors: LiteratureAuthor[] }) {
  if (authors.length === 0) return null;
  const first = authors.find((a) => a.affiliation)?.affiliation ?? null;
  const shown = authors.slice(0, 6).map((a) => a.name).join("、");
  const rest = authors.length - 6;
  return (
    <div className="text-[12.5px] leading-relaxed text-ink-3">
      <p>
        {shown}
        {rest > 0 && (
          <>
            {" "}
            <details className="inline">
              <summary className="inline cursor-pointer text-accent">等 {authors.length} 位</summary>
              <span className="mt-1 block text-ink-3">{authors.map((a) => a.name).join("、")}</span>
            </details>
          </>
        )}
      </p>
      {first && <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">第一单位：{first}</p>}
    </div>
  );
}

/**
 * The figures of the open-access full text. The image is hotlinked from the publisher (never copied),
 * with its caption as deposited and the licence it came under, so the credit travels with the figure.
 * Entries without a resolvable image never reach this component: a caption alone is not a figure.
 */
export function LiteratureFigures({ figures }: { figures: LiteratureFigure[] }) {
  const shown = figures.slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <section className="mt-9 border-t border-line pt-4 xl:mt-10">
      <div className="mb-4 text-[12px] font-semibold text-accent">文内图表</div>
      <div className="space-y-7">
        {shown.map((f, i) => (
          <figure key={`${f.caption.slice(0, 24)}-${i}`}>
            {f.url ? (
              <img
                src={f.url}
                alt={f.caption.slice(0, 120)}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="mx-auto max-h-[520px] w-auto max-w-full rounded-control border border-line-soft bg-white object-contain"
              />
            ) : null}
            <figcaption className="mt-2.5 text-[13px] leading-[1.7] text-ink-3">
              {f.label && <span className="mr-1 font-semibold text-ink-2">{f.label}</span>}
              {f.caption}
              {f.url && f.license && <span className="ml-1 text-[11.5px] text-ink-4">（图源：原文 · {shortLicense(f.license)}）</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      {figures.length > shown.length && <p className="mt-3 text-[12px] text-ink-4">另有 {figures.length - shown.length} 张图，见原文。</p>}
    </section>
  );
}
