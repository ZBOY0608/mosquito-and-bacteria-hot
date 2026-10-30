// External collection reports (POST /api/ingest/items). Same identity rules and timeline
// rule as every other entrance: old or future-dated items and explicit backfill never count as
// today's news and are never pushed. Unknown sources are created isolated, awaiting an operator.
import { sql } from "../db.ts";
import { upsertMaterial } from "../content/materials.ts";
import { queueProcessing } from "../jobs/content.ts";
import { readPublicationDate } from "../sources/dates.ts";
import { normalizeUrl } from "../lib/url.ts";

export const MAX_ITEMS = 50;

export class IngestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ItemIn {
  title?: unknown;
  url?: unknown;
  publishedAt?: unknown;
  author?: unknown;
  /**
   * 正文或摘要原文。文献的“正文”就是摘要：给了它，`body_status` 直接落 `ok`，`bare` 为假，
   * 抽取步骤不会再去抓页面（对外部推送尤其重要，见 docs）。
   */
  bodyText?: unknown;
  /** 原文节选，用于详情页展示原文语言的内容；不影响正文判定。 */
  excerpt?: unknown;
  raw?: { _aihot?: { backfill?: boolean; baseline?: boolean } } & Record<string, unknown>;
}

export async function ingestItems(body: { sourceId?: unknown; sourceName?: unknown; items?: unknown }): Promise<{ ok: true; created: number }> {
  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  const items = Array.isArray(body.items) ? (body.items as ItemIn[]) : [];
  if (!sourceId || !items.length) throw new IngestError(400, "sourceId and items[] required");
  if (items.length > MAX_ITEMS) throw new IngestError(413, `items[] exceeds max ${MAX_ITEMS} per request`);

  const [source] = await sql<{ id: string; participation_mode: string; enabled: boolean }[]>`
    INSERT INTO sources (id, name, kind, config, tier, participation_mode, interval_minutes, enabled, health, tags)
    VALUES (${sourceId.slice(0, 120)}, ${typeof body.sourceName === "string" && body.sourceName.trim() ? body.sourceName.trim().slice(0, 200) : sourceId.slice(0, 120)},
            'external', '{}'::jsonb, 'T2', 'isolated', 1440, true, 'ok', ${["ingest:auto-created"]})
    ON CONFLICT (id) DO UPDATE SET last_ok_at = now() WHERE sources.enabled
    RETURNING id, participation_mode, enabled`;
  if (!source) throw new IngestError(409, "source paused");

  const seen = new Set<string>();
  let created = 0;
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const title = typeof it.title === "string" ? it.title.trim() : "";
    const rawUrl = typeof it.url === "string" ? it.url.trim() : "";
    if (!title || !rawUrl) continue;
    const url = normalizeUrl(rawUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const publication = readPublicationDate(typeof it.publishedAt === "string" ? it.publishedAt : null, "+00:00");
    const flags = it.raw?._aihot ?? {};
    // 外部推送常常自带摘要，没有摘要就没有可判定的材料：两者都收，正文为空时由 excerpt 兜底，
    // 使 body_status 落 ok、bare 为假，避免 worker 去抓本来抓不到（或不该抓）的原站页面。
    const bodyText = typeof it.bodyText === "string" && it.bodyText.trim() ? it.bodyText.trim() : null;
    const excerpt = typeof it.excerpt === "string" && it.excerpt.trim() ? it.excerpt.trim() : null;
    const effectiveBody = bodyText ?? excerpt;
    const res = await upsertMaterial({
      sourceId: source!.id,
      // Normalize only for deduplication. Ownership needs the reported origin (including www and
      // scheme), and upsertMaterial already applies the common normalized identity rule.
      url: rawUrl,
      title,
      author: typeof it.author === "string" ? it.author.slice(0, 200) : null,
      ...publication,
      bodyText: effectiveBody,
      excerpt,
      bodyStatus: effectiveBody ? "ok" : undefined,
      raw: it.raw ?? null,
      via: "ingest",
      backfill: flags.backfill ? "reported-backfill" : flags.baseline ? "reported-baseline" : null,
    });
    if (res.created) created += 1;
    if (res.created || res.revised || res.processingNeeded) await queueProcessing(res.articleId);
  }
  await sql`UPDATE sources SET last_fetch_at = now(), last_ok_at = now() WHERE id = ${source!.id}`;
  await sql`INSERT INTO ingest_events (client, kind, status, summary) VALUES ('ingest-items', 'items', 'ok', ${sql.json({ sourceId: source!.id, received: items.length, created })})`;
  return { ok: true, created };
}
