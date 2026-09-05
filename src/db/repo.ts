import { db } from './index.ts'
import type { SqlRow } from './driver.ts'
import type { SubIds } from '../subid.ts'

/**
 * Toàn bộ SQL của dự án nằm ở đây, viết trong tập giao của SQLite và Postgres.
 * Driver lo phần khác biệt — xem `driver.ts`.
 */

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

export async function upsertProduct(p: ProductInput, now: string): Promise<void> {
  await (await db()).run(
    `INSERT INTO product (item_id, shop_id, name, category_path, url, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       shop_id       = excluded.shop_id,
       name          = excluded.name,
       category_path = excluded.category_path,
       url           = excluded.url,
       last_seen_at  = excluded.last_seen_at`,
    [p.itemId, p.shopId, p.name, p.categoryPath, p.url, now, now],
  )
}

export async function insertSnapshot(s: SnapshotInput, capturedAt: string): Promise<void> {
  await (await db()).run(
    `INSERT INTO product_snapshot
       (item_id, captured_at, price_vnd, original_price_vnd,
        base_commission_rate, xtra_commission_rate, sales_count, rating, in_stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.itemId,
      capturedAt,
      Math.round(s.priceVnd),
      Math.round(s.originalPriceVnd),
      s.baseCommissionRate,
      s.xtraCommissionRate,
      Math.round(s.salesCount),
      s.rating,
      s.inStock ? 1 : 0,
    ],
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

function mapCandidate(r: SqlRow): Candidate {
  return {
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
    prevSalesCount:
      r['prev_sales_count'] === null || r['prev_sales_count'] === undefined
        ? null
        : Number(r['prev_sales_count']),
    prevCapturedAt:
      r['prev_captured_at'] === null || r['prev_captured_at'] === undefined
        ? null
        : String(r['prev_captured_at']),
  }
}

export async function listCandidates(): Promise<Candidate[]> {
  const rows = await (await db()).all(CANDIDATES_SQL)
  return rows.map(mapCandidate)
}

// --- Điểm -------------------------------------------------------------------

export async function insertScores(rows: ScoreInput[]): Promise<void> {
  const d = await db()
  for (const r of rows) {
    await d.run(
      `INSERT INTO score
         (item_id, computed_at, ev_per_click, p_convert, effective_rate,
          capped_commission_vnd, reasons_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        r.itemId,
        r.computedAt,
        r.evPerClick,
        r.pConvert,
        r.effectiveRate,
        Math.round(r.cappedCommissionVnd),
        JSON.stringify(r.reasons),
      ],
    )
  }
}

export async function topScores(limit: number, computedAt: string): Promise<RankedRow[]> {
  const rows = await (await db()).all(
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
    [computedAt, limit],
  )

  return rows.map((r) => ({
    ...mapCandidate(r),
    evPerClick: Number(r['ev_per_click']),
    pConvert: Number(r['p_convert']),
    effectiveRate: Number(r['effective_rate']),
    cappedCommissionVnd: Number(r['capped_commission_vnd']),
  }))
}

export async function latestScoreRun(): Promise<string | null> {
  const row = await (await db()).get('SELECT MAX(computed_at) AS ts FROM score')
  const ts = row?.['ts']
  return ts === null || ts === undefined ? null : String(ts)
}

// --- Link và bài đăng -------------------------------------------------------

/**
 * Ghi link, trả về id. Dùng ON CONFLICT trên chính unique index của 5 subId nên
 * thao tác là nguyên tử — trước đây SELECT rồi INSERT riêng có thể chạy đua khi
 * hai job cùng đăng một sản phẩm.
 */
export async function upsertLink(
  itemId: string,
  shortUrl: string,
  s: SubIds,
  now: string,
): Promise<number> {
  const row = await (await db()).get(
    `INSERT INTO link (item_id, short_url, sub1, sub2, sub3, sub4, sub5, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id, sub1, sub2, sub3, sub4, sub5)
       DO UPDATE SET short_url = excluded.short_url
     RETURNING id`,
    [itemId, shortUrl, s.sub1, s.sub2, s.sub3, s.sub4, s.sub5, now],
  )
  return Number(row?.['id'])
}

export async function insertPost(
  channel: string,
  linkId: number | null,
  itemId: string,
  variant: string,
  postedAt: string,
  externalId: string | null,
): Promise<void> {
  await (await db()).run(
    `INSERT INTO post (channel, link_id, item_id, posted_at, variant, external_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [channel, linkId, itemId, postedAt, variant, externalId],
  )
}

// --- Đơn hàng ---------------------------------------------------------------

export async function upsertConversion(c: ConversionInput): Promise<void> {
  await (await db()).run(
    `INSERT INTO conversion
       (order_id, item_id, source, sub1, sub2, sub3, sub4, sub5,
        order_value_vnd, commission_vnd, status, ordered_at, validated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(order_id, item_id) DO UPDATE SET
       order_value_vnd = excluded.order_value_vnd,
       commission_vnd  = excluded.commission_vnd,
       status          = excluded.status,
       validated_at    = excluded.validated_at`,
    [
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
    ],
  )
}

// --- Báo cáo ----------------------------------------------------------------

export type ConversionBucket = {
  bucket: string
  orders: number
  /** Chỉ đơn đã hoàn tất đối soát. Đây là tiền thật. */
  confirmedOrders: number
  confirmedCommissionVnd: number
  /** Gồm cả đơn chưa đối soát. Là trần trên, không phải tiền đã chắc. */
  pendingCommissionVnd: number
  gmvVnd: number
}

/**
 * Tách bạch đơn đã đối soát với đơn còn treo.
 *
 * Gộp hai loại vào một con số là cách âm thầm thổi phồng hiệu quả: chu kỳ đối
 * soát khoảng T+30 nên trong tháng đầu gần như mọi đơn đều đang treo, và một
 * phần trong đó sẽ bị huỷ hoặc hoàn. Quyết định dựa trên con số gộp là quyết
 * định dựa trên tiền chưa chắc có.
 *
 * Nhưng cũng không thể chỉ đếm đơn đã đối soát, vì như vậy suốt 30 ngày đầu báo
 * cáo sẽ trống trơn. Nên báo cáo hiện cả hai.
 */
export async function conversionsBy(column: string, since: string): Promise<ConversionBucket[]> {
  const rows = await (await db()).all(
    `SELECT ${column} AS bucket,
            COUNT(*) AS orders,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS confirmed_orders,
            SUM(CASE WHEN status = 'completed' THEN commission_vnd ELSE 0 END) AS confirmed_commission,
            SUM(commission_vnd) AS pending_commission,
            SUM(order_value_vnd) AS gmv
     FROM conversion
     WHERE COALESCE(ordered_at, '') >= ?
       AND status <> 'cancelled'
     GROUP BY ${column}
     ORDER BY confirmed_commission DESC, pending_commission DESC`,
    [since],
  )

  return rows.map((r) => ({
    bucket: String(r['bucket'] ?? ''),
    orders: Number(r['orders']),
    confirmedOrders: Number(r['confirmed_orders'] ?? 0),
    confirmedCommissionVnd: Number(r['confirmed_commission'] ?? 0),
    pendingCommissionVnd: Number(r['pending_commission'] ?? 0),
    gmvVnd: Number(r['gmv'] ?? 0),
  }))
}

/**
 * Đơn không có mốc thời gian sẽ bị mọi báo cáo theo khoảng thời gian bỏ qua —
 * không xếp được vào cửa sổ nào cả. Đếm riêng để báo cáo còn nói ra được điều
 * đó thay vì âm thầm giấu doanh thu.
 */
export async function countUndatedConversions(): Promise<number> {
  const row = await (await db()).get(
    `SELECT COUNT(*) AS c FROM conversion
     WHERE COALESCE(ordered_at, '') = '' AND status <> 'cancelled'`,
  )
  return Number(row?.['c'] ?? 0)
}

export type PostBucket = { bucket: string; posts: number; clicks: number }

/**
 * Gộp theo link chứ không theo bài đăng.
 *
 * Click nằm trên `link` vì dashboard báo theo tổ hợp sub_id. Nếu join thẳng
 * post → link rồi cộng, một link được đăng lại hai lần sẽ bị đếm click hai lần.
 * Đếm số bài trong subquery riêng để mỗi link chỉ đóng góp click đúng một lần.
 */
export async function postsBy(subColumn: string, since: string): Promise<PostBucket[]> {
  const rows = await (await db()).all(
    `SELECT l.${subColumn} AS bucket,
            SUM(COALESCE(l.clicks, 0)) AS clicks,
            SUM(COALESCE(pc.n, 0)) AS posts
     FROM link l
     LEFT JOIN (SELECT link_id, COUNT(*) AS n FROM post GROUP BY link_id) pc
       ON pc.link_id = l.id
     WHERE l.created_at >= ?
     GROUP BY l.${subColumn}`,
    [since],
  )

  return rows.map((r) => ({
    bucket: String(r['bucket'] ?? ''),
    posts: Number(r['posts'] ?? 0),
    clicks: Number(r['clicks'] ?? 0),
  }))
}

// --- Click -----------------------------------------------------------------

export type LinkRow = {
  id: number
  itemId: string
  name: string
  shortUrl: string
  sub1: string
  sub2: string
  sub3: string
  sub4: string
  sub5: string
  clicks: number | null
  createdAt: string
}

function mapLinkRow(r: SqlRow): LinkRow {
  return {
    id: Number(r['id']),
    itemId: String(r['item_id']),
    name: String(r['name'] ?? ''),
    shortUrl: String(r['short_url']),
    sub1: String(r['sub1']),
    sub2: String(r['sub2']),
    sub3: String(r['sub3']),
    sub4: String(r['sub4']),
    sub5: String(r['sub5']),
    clicks: r['clicks'] === null || r['clicks'] === undefined ? null : Number(r['clicks']),
    createdAt: String(r['created_at']),
  }
}

const LINK_SELECT = `
  SELECT l.id, l.item_id, l.short_url, l.sub1, l.sub2, l.sub3, l.sub4, l.sub5,
         l.clicks, l.created_at, p.name
  FROM link l
  LEFT JOIN product p ON p.item_id = l.item_id
`

export async function setLinkClicks(linkId: number, clicks: number): Promise<boolean> {
  const res = await (await db()).run(
    'UPDATE link SET clicks = ?, clicks_updated_at = ? WHERE id = ?',
    [Math.max(0, Math.round(clicks)), new Date().toISOString(), linkId],
  )
  return res.changes > 0
}

/** Khớp theo đúng tổ hợp 5 subId — cách dashboard báo cáo click. */
export async function setClicksBySubIds(
  s: { sub1: string; sub2: string; sub3: string; sub4: string; sub5: string },
  clicks: number,
): Promise<number> {
  const res = await (await db()).run(
    `UPDATE link SET clicks = ?, clicks_updated_at = ?
     WHERE sub1 = ? AND sub2 = ? AND sub3 = ? AND sub4 = ? AND sub5 = ?`,
    [
      Math.max(0, Math.round(clicks)),
      new Date().toISOString(),
      s.sub1,
      s.sub2,
      s.sub3,
      s.sub4,
      s.sub5,
    ],
  )
  return res.changes
}

export async function setClicksByUrl(shortUrl: string, clicks: number): Promise<number> {
  const res = await (await db()).run(
    'UPDATE link SET clicks = ?, clicks_updated_at = ? WHERE short_url = ?',
    [Math.max(0, Math.round(clicks)), new Date().toISOString(), shortUrl],
  )
  return res.changes
}

/** Link chưa có số click — danh sách việc cần nhập tay mỗi ngày. */
export async function linksMissingClicks(limit: number): Promise<LinkRow[]> {
  const rows = await (await db()).all(
    `${LINK_SELECT} WHERE l.clicks IS NULL ORDER BY l.created_at DESC LIMIT ?`,
    [limit],
  )
  return rows.map(mapLinkRow)
}

export async function findLinkById(linkId: number): Promise<LinkRow | null> {
  const row = await (await db()).get(`${LINK_SELECT} WHERE l.id = ?`, [linkId])
  return row ? mapLinkRow(row) : null
}

// --- Nhật ký job ------------------------------------------------------------

export async function startIngestRun(source: string, startedAt: string): Promise<number> {
  const row = await (await db()).get(
    'INSERT INTO ingest_run (source, started_at) VALUES (?, ?) RETURNING id',
    [source, startedAt],
  )
  return Number(row?.['id'])
}

export async function finishIngestRun(
  id: number,
  seen: number,
  blocked: number,
  error: string | null,
): Promise<void> {
  await (await db()).run(
    `UPDATE ingest_run
     SET finished_at = ?, items_seen = ?, items_blocked = ?, error = ?
     WHERE id = ?`,
    [new Date().toISOString(), seen, blocked, error, id],
  )
}
