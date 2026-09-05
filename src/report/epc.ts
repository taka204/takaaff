import { conversionsBy, postsBy } from '../db/repo.ts'

/**
 * EPC — hoa hồng thực nhận trên mỗi click — là chỉ số bắc đẩu của cả hệ thống.
 *
 * Lưu ý về dữ liệu click: Shopee không trả số click theo subId qua API mà chỉ
 * hiển thị trên dashboard, nên cột `post.clicks` phải nhập tay cho tới khi tìm
 * được đường lấy tự động. Khi chưa có click, báo cáo lùi về hoa hồng trên mỗi
 * bài — vẫn so sánh được giữa các kênh, chỉ kém chính xác hơn.
 */

export const DIMENSIONS = {
  channel: { conversionColumn: 'sub1', subColumn: 'sub1', label: 'Kênh' },
  type: { conversionColumn: 'sub2', subColumn: 'sub2', label: 'Loại bài' },
  category: { conversionColumn: 'sub3', subColumn: 'sub3', label: 'Ngành hàng' },
  slot: { conversionColumn: 'sub4', subColumn: 'sub4', label: 'Khung đăng' },
  variant: { conversionColumn: 'sub5', subColumn: 'sub5', label: 'Biến thể' },
  source: { conversionColumn: 'source', subColumn: null, label: 'Nguồn đơn' },
} as const

export type Dimension = keyof typeof DIMENSIONS

export type EpcRow = {
  bucket: string
  orders: number
  confirmedOrders: number
  /** Tiền đã chắc — chỉ đơn hoàn tất đối soát. */
  confirmedCommissionVnd: number
  /** Trần trên — gồm cả đơn còn treo. */
  pendingCommissionVnd: number
  gmvVnd: number
  posts: number
  clicks: number
  /** EPC tính trên hoa hồng ĐÃ ĐỐI SOÁT. null khi chưa có số liệu click. */
  epcVnd: number | null
  commissionPerPostVnd: number | null
}

export function epcReport(dimension: Dimension, days: number): EpcRow[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const dim = DIMENSIONS[dimension]

  const conversions = conversionsBy(dim.conversionColumn, since)
  const posts = dim.subColumn === null ? [] : postsBy(dim.subColumn, since)

  const postsByBucket = new Map(posts.map((p) => [p.bucket, p]))
  const buckets = new Set([...conversions.map((c) => c.bucket), ...posts.map((p) => p.bucket)])

  const rows: EpcRow[] = []
  for (const bucket of buckets) {
    const conv = conversions.find((c) => c.bucket === bucket)
    const post = postsByBucket.get(bucket)

    // EPC dùng hoa hồng ĐÃ ĐỐI SOÁT, không dùng con số gộp: chỉ số bắc đẩu mà
    // tính trên tiền chưa chắc có thì mọi quyết định phía sau đều lệch.
    const confirmed = conv?.confirmedCommissionVnd ?? 0
    const clicks = post?.clicks ?? 0
    const postCount = post?.posts ?? 0

    rows.push({
      bucket: bucket === '' ? '(trống)' : bucket,
      orders: conv?.orders ?? 0,
      confirmedOrders: conv?.confirmedOrders ?? 0,
      confirmedCommissionVnd: confirmed,
      pendingCommissionVnd: conv?.pendingCommissionVnd ?? 0,
      gmvVnd: conv?.gmvVnd ?? 0,
      posts: postCount,
      clicks,
      epcVnd: clicks > 0 ? confirmed / clicks : null,
      commissionPerPostVnd: postCount > 0 ? confirmed / postCount : null,
    })
  }

  return rows.sort(
    (a, b) =>
      b.confirmedCommissionVnd - a.confirmedCommissionVnd ||
      b.pendingCommissionVnd - a.pendingCommissionVnd,
  )
}
