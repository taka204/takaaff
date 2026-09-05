import { db } from './index.ts'
import type { SubIds } from '../subid.ts'

// --- Kiểu dữ liệu -----------------------------------------------------------

export type ProductInput = {
  itemId: string
  shopId: string
  name: string
  categoryPath: string
  url: string
}

export type SnapshotInput = {
  itemId: string
  priceVnd: number
  originalPriceVnd: number
  baseCommissionRate: number
  xtraCommissionRate: number
  salesCount: number
  rating: number
  inStock: boolean
}

/** Một sản phẩm kèm ảnh chụp mới nhất và ảnh chụp liền trước (để tính tốc độ bán). */
export type Candidate = {
  itemId: string
  shopId: string
  name: string
  categoryPath: string
  url: string
  priceVnd: number
  originalPriceVnd: number
  baseCommissionRate: number
  xtraCommissionRate: number
  salesCount: number
  rating: number
  capturedAt: string
  prevSalesCount: number | null
  prevCapturedAt: string | null
}

export type ScoreInput = {
  itemId: string
  computedAt: string
  evPerClick: number
  pConvert: number
  effectiveRate: number
  cappedCommissionVnd: number
  reasons: unknown
}

export type RankedRow = Candidate & {
  evPerClick: number
  pConvert: number
  effectiveRate: number
  cappedCommissionVnd: number
}

/**
 * subId ở đây là chuỗi thô, KHÔNG dùng kiểu `SubIds`. Giá trị đến từ phản hồi
 * của Shopee nên có thể là bất cứ thứ gì — kể cả link cũ sinh từ trước khi
 * lược đồ được cố định. Ép về union type sẽ là nói dối về dữ liệu.
 */
export type ConversionInput = {
  orderId: string
  itemId: string
  source: 'link' | 'video'
  subIds: Partial<Record<keyof SubIds, string>>
  orderValueVnd: number
  commissionVnd: number
  status: string
  orderedAt: string | null
  validatedAt: string | null
}

// --- Sản phẩm và ảnh chụp ---------------------------------------------------

export function upsertProduct(p: ProductInput, now: string): void {
  db()
    .prepare(
      `INSERT INTO product (item_id, shop_id, name, category_path, url, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         shop_id       = excluded.shop_id,
         name          = excluded.name,
         category_path = excluded.category_path,
         url           = excluded.url,
         last_seen_at  = excluded.last_seen_at`,
    )
    .run(p.itemId, p.shopId, p.name, p.categoryPath, p.url, now, now)
}

export function insertSnapshot(s: SnapshotInput, capturedAt: string): void {
  db()
    .prepare(
      `INSERT INTO product_snapshot
         (item_id, captured_at, price_vnd, original_price_vnd,
          base_commission_rate, xtra_commission_rate, sales_count, rating, in_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      s.itemId,
      capturedAt,
      Math.round(s.priceVnd),
      Math.round(s.originalPriceVnd),
      s.baseCommissionRate,
      s.xtraCommissionRate,
      Math.round(s.salesCount),
      s.rating,
      s.inStock ? 1 : 0,
    )
}

const CANDIDATES_SQL = `
  WITH ranked AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (PARTITION BY s.item_id ORDER BY s.captured_at DESC, s.id DESC) AS rn
    FROM product_snapshot s
  )
  SELECT
    p.item_id, p.shop_id, p.name, p.category_path, p.url,
    cur.price_vnd, cur.original_price_vnd,
    cur.base_commission_rate, cur.xtra_commission_rate,
    cur.sales_count, cur.rating, cur.captured_at,
    prev.sales_count AS prev_sales_count,
    prev.captured_at AS prev_captured_at
  FROM product p
  JOIN ranked cur  ON cur.item_id  = p.item_id AND cur.rn = 1
  LEFT JOIN ranked prev ON prev.item_id = p.item_id AND prev.rn = 2
  WHERE cur.in_stock = 1
`

export function listCandidates(): Candidate[] {
  return db()
    .prepare(CANDIDATES_SQL)
    .all()
    .map((r) => ({
      itemId: String(r['item_id']),
      shopId: String(r['shop_id']),
      name: String(r['name']),
      categoryPath: String(r['category_path']),
      url: String(r['url']),
      priceVnd: Number(r['price_vnd']),
      originalPriceVnd: Number(r['original_price_vnd']),
      baseCommissionRate: Number(r['base_commission_rate']),
      xtraCommissionRate: Number(r['xtra_commission_rate']),
      salesCount: Number(r['sales_count']),
      rating: Number(r['rating']),
      capturedAt: String(r['captured_at']),
      prevSalesCount: r['prev_sales_count'] === null ? null : Number(r['prev_sales_count']),
      prevCapturedAt: r['prev_captured_at'] === null ? null : String(r['prev_captured_at']),
    }))
}

// --- Điểm -------------------------------------------------------------------

export function insertScores(rows: ScoreInput[]): void {
  const stmt = db().prepare(
    `INSERT INTO score
       (item_id, computed_at, ev_per_click, p_convert, effective_rate,
        capped_commission_vnd, reasons_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const r of rows) {
    stmt.run(
      r.itemId,
      r.computedAt,
      r.evPerClick,
      r.pConvert,
      r.effectiveRate,
      Math.round(r.cappedCommissionVnd),
      JSON.stringify(r.reasons),
    )
  }
}

export function topScores(limit: number, computedAt: string): RankedRow[] {
  return db()
    .prepare(
      `WITH ranked AS (
         SELECT s.*,
           ROW_NUMBER() OVER (PARTITION BY s.item_id ORDER BY s.captured_at DESC, s.id DESC) AS rn
         FROM product_snapshot s
       )
       SELECT
         p.item_id, p.shop_id, p.name, p.category_path, p.url,
         cur.price_vnd, cur.original_price_vnd,
         cur.base_commission_rate, cur.xtra_commission_rate,
         cur.sales_count, cur.rating, cur.captured_at,
         prev.sales_count AS prev_sales_count,
         prev.captured_at AS prev_captured_at,
         sc.ev_per_click, sc.p_convert, sc.effective_rate, sc.capped_commission_vnd
       FROM score sc
       JOIN product p   ON p.item_id   = sc.item_id
       JOIN ranked cur  ON cur.item_id = p.item_id AND cur.rn = 1
       LEFT JOIN ranked prev ON prev.item_id = p.item_id AND prev.rn = 2
       WHERE sc.computed_at = ?
       ORDER BY sc.ev_per_click DESC
       LIMIT ?`,
    )
    .all(computedAt, limit)
    .map((r) => ({
      itemId: String(r['item_id']),
      shopId: String(r['shop_id']),
      name: String(r['name']),
      categoryPath: String(r['category_path']),
      url: String(r['url']),
      priceVnd: Number(r['price_vnd']),
      originalPriceVnd: Number(r['original_price_vnd']),
      baseCommissionRate: Number(r['base_commission_rate']),
      xtraCommissionRate: Number(r['xtra_commission_rate']),
      salesCount: Number(r['sales_count']),
      rating: Number(r['rating']),
      capturedAt: String(r['captured_at']),
      prevSalesCount: r['prev_sales_count'] === null ? null : Number(r['prev_sales_count']),
      prevCapturedAt: r['prev_captured_at'] === null ? null : String(r['prev_captured_at']),
      evPerClick: Number(r['ev_per_click']),
      pConvert: Number(r['p_convert']),
      effectiveRate: Number(r['effective_rate']),
      cappedCommissionVnd: Number(r['capped_commission_vnd']),
    }))
}

export function latestScoreRun(): string | null {
  const row = db().prepare('SELECT MAX(computed_at) AS ts FROM score').get()
  const ts = row?.['ts']
  return ts === null || ts === undefined ? null : String(ts)
}

// --- Link và bài đăng -------------------------------------------------------

export function upsertLink(itemId: string, shortUrl: string, s: SubIds, now: string): number {
  const existing = db()
    .prepare(
      `SELECT id FROM link
       WHERE item_id = ? AND sub1 = ? AND sub2 = ? AND sub3 = ? AND sub4 = ? AND sub5 = ?`,
    )
    .get(itemId, s.sub1, s.sub2, s.sub3, s.sub4, s.sub5)

  if (existing) return Number(existing['id'])

  db()
    .prepare(
      `INSERT INTO link (item_id, short_url, sub1, sub2, sub3, sub4, sub5, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(itemId, shortUrl, s.sub1, s.sub2, s.sub3, s.sub4, s.sub5, now)

  const row = db().prepare('SELECT last_insert_rowid() AS id').get()
  return Number(row?.['id'])
}

export function insertPost(
  channel: string,
  linkId: number | null,
  itemId: string,
  variant: string,
  postedAt: string,
  externalId: string | null,
): void {
  db()
    .prepare(
      `INSERT INTO post (channel, link_id, item_id, posted_at, variant, external_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(channel, linkId, itemId, postedAt, variant, externalId)
}

// --- Đơn hàng ---------------------------------------------------------------

export function upsertConversion(c: ConversionInput): void {
  db()
    .prepare(
      `INSERT INTO conversion
         (order_id, item_id, source, sub1, sub2, sub3, sub4, sub5,
          order_value_vnd, commission_vnd, status, ordered_at, validated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(order_id, item_id) DO UPDATE SET
         order_value_vnd = excluded.order_value_vnd,
         commission_vnd  = excluded.commission_vnd,
         status          = excluded.status,
         validated_at    = excluded.validated_at`,
    )
    .run(
      c.orderId,
      c.itemId,
      c.source,
      c.subIds.sub1 ?? '',
      c.subIds.sub2 ?? '',
      c.subIds.sub3 ?? '',
      c.subIds.sub4 ?? '',
      c.subIds.sub5 ?? '',
      Math.round(c.orderValueVnd),
      Math.round(c.commissionVnd),
      c.status,
      c.orderedAt,
      c.validatedAt,
    )
}

// --- Báo cáo ----------------------------------------------------------------

export type ConversionBucket = {
  bucket: string
  orders: number
  commissionVnd: number
  gmvVnd: number
}

export function conversionsBy(column: string, since: string): ConversionBucket[] {
  return db()
    .prepare(
      `SELECT ${column} AS bucket,
              COUNT(*) AS orders,
              SUM(commission_vnd) AS commission,
              SUM(order_value_vnd) AS gmv
       FROM conversion
       WHERE COALESCE(ordered_at, '') >= ?
         AND status NOT IN ('cancelled', 'huy')
       GROUP BY bucket
       ORDER BY commission DESC`,
    )
    .all(since)
    .map((r) => ({
      bucket: String(r['bucket'] ?? ''),
      orders: Number(r['orders']),
      commissionVnd: Number(r['commission'] ?? 0),
      gmvVnd: Number(r['gmv'] ?? 0),
    }))
}

export type PostBucket = { bucket: string; posts: number; clicks: number }

export function postsBy(subColumn: string, since: string): PostBucket[] {
  return db()
    .prepare(
      `SELECT l.${subColumn} AS bucket,
              COUNT(p.id) AS posts,
              SUM(COALESCE(p.clicks, 0)) AS clicks
       FROM post p
       JOIN link l ON l.id = p.link_id
       WHERE p.posted_at >= ?
       GROUP BY bucket`,
    )
    .all(since)
    .map((r) => ({
      bucket: String(r['bucket'] ?? ''),
      posts: Number(r['posts']),
      clicks: Number(r['clicks'] ?? 0),
    }))
}

// --- Nhật ký job ------------------------------------------------------------

export function startIngestRun(source: string, startedAt: string): number {
  db()
    .prepare('INSERT INTO ingest_run (source, started_at) VALUES (?, ?)')
    .run(source, startedAt)
  return Number(db().prepare('SELECT last_insert_rowid() AS id').get()?.['id'])
}

export function finishIngestRun(
  id: number,
  seen: number,
  blocked: number,
  error: string | null,
): void {
  db()
    .prepare(
      `UPDATE ingest_run
       SET finished_at = ?, items_seen = ?, items_blocked = ?, error = ?
       WHERE id = ?`,
    )
    .run(new Date().toISOString(), seen, blocked, error, id)
}
