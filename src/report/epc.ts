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
  commissionVnd: number
  gmvVnd: number
  posts: number
  clicks: number
  /** null khi chưa có số liệu click. */
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

    const commissionVnd = conv?.commissionVnd ?? 0
    const clicks = post?.clicks ?? 0
    const postCount = post?.posts ?? 0

    rows.push({
      bucket: bucket === '' ? '(trống)' : bucket,
      orders: conv?.orders ?? 0,
      commissionVnd,
      gmvVnd: conv?.gmvVnd ?? 0,
      posts: postCount,
      clicks,
      epcVnd: clicks > 0 ? commissionVnd / clicks : null,
      commissionPerPostVnd: postCount > 0 ? commissionVnd / postCount : null,
    })
  }

  return rows.sort((a, b) => b.commissionVnd - a.commissionVnd)
}
