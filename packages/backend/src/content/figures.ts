// The figures a paper ships with, read from its open-access full text and written back into the
// article's literature metadata, so the detail page can show them. Only the publisher's own image
// address is recorded — never a copy — so the credit and the licence travel with the figure; where the
// address cannot be built from the deposit, the figure keeps its caption and the page says where to look.
// Figures arrive with the metadata pipeline when it has them; this pass fills the ones it left empty and
// re-checks after a while, so a paper published later is not stuck without its figures.
import { sql } from "../db.ts";
import { guardedFetch } from "../lib/http-fetch.ts";
import { collapseWhitespace, stripTags } from "../lib/text.ts";

const FULL_TEXT = "https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML";
const MAX_FIGURES = 6;
const MAX_CAPTION = 1200;
/** Attempts per image address, tried in order, until one answers with an image. */
const PROBE_BYTES = 512;
/** How long a paper whose publisher gives no usable address is left alone before it is asked again. */
const RETRY_AFTER = "30 days";

/** A figure as deposited, with every image address its publisher may serve it from. */
export interface ParsedFigure {
  label: string | null;
  caption: string;
  license: string | null;
  candidates: string[];
}

/** A figure as stored in `articles.raw.literature.figures`. */
export interface StoredFigure {
  label: string | null;
  caption: string;
  url: string | null;
  license: string | null;
}

const CREATIVE_COMMONS: Array<[RegExp, string]> = [
  [/\/by-nc-nd\/\d\.\d/, "Creative Commons Attribution-NonCommercial-NoDerivatives"],
  [/\/by-nc-sa\/\d\.\d/, "Creative Commons Attribution-NonCommercial-ShareAlike"],
  [/\/by-nc\/\d\.\d/, "Creative Commons Attribution-NonCommercial"],
  [/\/by-sa\/\d\.\d/, "Creative Commons Attribution-ShareAlike"],
  [/\/by\/\d\.\d/, "Creative Commons Attribution"],
  [/\/by-nd\/\d\.\d/, "Creative Commons Attribution-NoDerivatives"],
];

/** The licence of the whole paper, from its Creative Commons address when it has one. */
export function licenseOf(xml: string): string | null {
  for (const [, kind, version] of xml.matchAll(/creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/gi)) {
    const name = CREATIVE_COMMONS.find(([re]) => re.test(`/${kind}/${version}`))?.[1];
    if (name) return `${name} ${version}`;
  }
  const sentence = /Creative Commons[^<.。]{0,80}?\d\.\d/.exec(stripTags(xml));
  return sentence ? collapseWhitespace(sentence[0]) : null;
}

/** The deposited figures, in document order: each `<fig>` with its label, caption and image file name. */
function figureBlocks(xml: string): Array<{ label: string; caption: string; href: string | null }> {
  const blocks: Array<{ label: string; caption: string; href: string | null }> = [];
  for (const [, inner] of xml.matchAll(/<fig\b[^>]*>([\s\S]*?)<\/fig>/g)) {
    const caption = stripTags(/<caption\b[^>]*>([\s\S]*?)<\/caption>/.exec(inner!)?.[1] ?? "");
    const label = collapseWhitespace(stripTags(/<label\b[^>]*>([\s\S]*?)<\/label>/.exec(inner!)?.[1] ?? ""));
    const graphic = /<graphic\b[^>]*?xlink:href="([^"]+)"/.exec(inner!)?.[1]
      ?? /<inline-graphic\b[^>]*?xlink:href="([^"]+)"/.exec(inner!)?.[1]
      ?? null;
    blocks.push({ label, caption, href: graphic?.trim() || null });
  }
  return blocks;
}

const PLOS_JOURNALS: Record<string, string> = {
  pntd: "plosntds",
  ppat: "plospathogens",
  pdig: "digitalhealth",
  pone: "plosone",
  pbio: "plosbiology",
  pgen: "plosgenetics",
  pcbi: "ploscompbiol",
  pmed: "plosmedicine",
};

/**
 * The addresses a publisher serves this figure from, most likely first. Only publishers whose address
 * can be built from the deposit alone are listed; every other paper keeps its caption.
 */
export function publisherImageUrls(doi: string | null, href: string | null, index: number): string[] {
  if (!doi || !href) return [];
  const value = doi.toLowerCase();
  const name = href.replace(/\.(webp|gif|jpe?g|tiff?|png)$/i, "");
  const ext = /\.(webp|gif|jpe?g|tiff?|png)$/i.exec(href)?.[1]?.toLowerCase() ?? "jpg";
  if (value.startsWith("10.1186/") || value.startsWith("10.1038/")) {
    // Springer Nature serves one MediaObject per figure, as png or as webp.
    const art = `https://media.springernature.com/full/springer-static/image/art%3A${encodeURIComponent(doi)}/MediaObjects/${name}`;
    return [`${art}.png`, `${art}.webp`];
  }
  if (value.startsWith("10.1371/")) {
    // 10.1371/journal.pntd.0014222: the second segment names the journal, which is part of its path.
    const journal = doi.split("/")[1]?.split(".")[1]?.toLowerCase() ?? "";
    const slug = PLOS_JOURNALS[journal];
    return slug ? [`https://journals.plos.org/${slug}/article/figure/image?size=large&id=${doi}.g${String(index).padStart(3, "0")}`] : [];
  }
  if (value.startsWith("10.3389/")) {
    // Frontiers: the article id closes the DOI, the deposit's file name is the MediaObject's.
    const id = doi.split(".").pop() ?? "";
    const parts = /^(.*)-g0*(\d+)$/.exec(name);
    if (!id || !parts) return [];
    const file = `${parts[1]}-g${String(Number(parts[2])).padStart(3, "0")}.${ext}`;
    return [`https://www.frontiersin.org/files/Articles/${id}/${parts[1]}-HTML/image_m/${file}`];
  }
  return [];
}

/** The figures of a full-text XML, as deposited, each with the addresses to try. */
export function figuresFromFullText(xml: string, doi: string | null): ParsedFigure[] {
  const license = licenseOf(xml);
  const figures: ParsedFigure[] = [];
  for (const [i, block] of figureBlocks(xml).entries()) {
    if (!block.caption) continue;
    figures.push({
      label: block.label || null,
      caption: block.caption.slice(0, MAX_CAPTION),
      license,
      candidates: publisherImageUrls(doi, block.href, i + 1),
    });
    if (figures.length >= MAX_FIGURES) break;
  }
  return figures;
}

/** The first address that really answers with an image; null when the publisher serves none of them. */
async function reachable(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    try {
      const res = await guardedFetch(url, { timeoutMs: 15_000, maxBytes: PROBE_BYTES, truncate: true, headers: { range: `bytes=0-${PROBE_BYTES - 1}` } });
      if (res.status < 400 && (res.headers.get("content-type") ?? "").startsWith("image/")) return url;
    } catch {
      // A publisher refusing us says nothing about the address: try the next one.
    }
  }
  return null;
}

/** Fills in the image address of every figure; null when the full text could not be read at all. */
export async function literatureFigures(pmcid: string, doi: string | null): Promise<StoredFigure[] | null> {
  let xml: string;
  try {
    const res = await guardedFetch(FULL_TEXT.replace("{pmcid}", encodeURIComponent(pmcid)), { timeoutMs: 25_000, maxBytes: 4 * 1024 * 1024 });
    if (res.status !== 200) return null;
    xml = res.text();
  } catch {
    return null;
  }
  const figures: StoredFigure[] = [];
  for (const figure of figuresFromFullText(xml, doi)) {
    figures.push({ label: figure.label, caption: figure.caption, license: figure.license, url: await reachable(figure.candidates) });
  }
  return figures;
}

/**
 * One pass over the papers whose figures are still missing an image: their full text is read, the
 * figures written back, and the paper stamped so a publisher that offers no address is not asked again
 * for a month. Failures leave the stamp alone and are retried by the next run.
 */
export async function fillFigureGaps(limit = 8): Promise<{ papers: number; figures: number; images: number }> {
  const rows = await sql<{ id: string; pmcid: string; doi: string | null }[]>`
    SELECT a.id, a.raw->'literature'->>'pmcid' AS pmcid, a.raw->'literature'->>'doi' AS doi
    FROM articles a
    WHERE coalesce(a.raw->'literature'->>'pmcid', '') <> ''
      AND (a.raw->'literature'->>'figuresAt' IS NULL OR (a.raw->'literature'->>'figuresAt')::timestamptz < now() - ${RETRY_AFTER}::interval)
      AND (jsonb_array_length(coalesce(a.raw->'literature'->'figures', '[]'::jsonb)) = 0
           OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.raw->'literature'->'figures') f WHERE coalesce(f->>'url', '') <> ''))
    ORDER BY a.discovered_at DESC
    LIMIT ${limit}`;
  let papers = 0;
  let figures = 0;
  let images = 0;
  for (const row of rows) {
    const found = await literatureFigures(row.pmcid, row.doi);
    if (!found) continue;
    await sql`
      UPDATE articles
      SET raw = jsonb_set(
        jsonb_set(coalesce(raw, '{}'::jsonb), '{literature,figures}', ${sql.json(found as never)}::jsonb, true),
        '{literature,figuresAt}', to_jsonb(now()), true)
      WHERE id = ${row.id}`;
    papers += 1;
    figures += found.length;
    images += found.filter((f) => f.url).length;
  }
  return { papers, figures, images };
}
