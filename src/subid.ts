/**
 * Lược đồ subId — thiết kế một lần, dùng mãi.
 *
 * Shopee cho phép gắn 5 tham số subId lên mỗi link tiếp thị và trả chúng lại
 * trong conversionReport. Đặt sai lược đồ này thì ba tháng sau có dữ liệu mà
 * không phân tích được, nên nó được cố định từ bài đăng đầu tiên.
 *
 *   sub1  kênh          -> kênh nào đáng đầu tư tiếp?
 *   sub2  loại bài      -> định dạng nào chốt tốt?
 *   sub3  ngành hàng    -> ngách nào nên tập trung?
 *   sub4  khung đăng    -> khung giờ nào hiệu quả?
 *   sub5  biến thể A/B  -> tiêu đề nào thắng?
 */

export const CHANNELS = ['tg', 'zalo', 'fb', 'web', 'video'] as const
export type Channel = (typeof CHANNELS)[number]

export const POST_TYPES = ['flash', 'restock', 'review', 'compare', 'evergreen'] as const
export type PostType = (typeof POST_TYPES)[number]

export const VARIANTS = ['a', 'b'] as const
export type Variant = (typeof VARIANTS)[number]

export type SubIds = {
  sub1: Channel
  sub2: PostType
  sub3: string
  sub4: string
  sub5: Variant
}

export function isChannel(v: string): v is Channel {
  return (CHANNELS as readonly string[]).includes(v)
}

export function isPostType(v: string): v is PostType {
  return (POST_TYPES as readonly string[]).includes(v)
}

export function isVariant(v: string): v is Variant {
  return (VARIANTS as readonly string[]).includes(v)
}

/**
 * Chuẩn hoá chuỗi bất kỳ thành slug an toàn cho subId: chữ thường ASCII, số và
 * dấu gạch ngang, tối đa 20 ký tự. Bỏ dấu tiếng Việt để giá trị trong báo cáo
 * của Shopee không bị mã hoá lung tung.
 */
export function slug(input: string, maxLength = 20): string {
  const stripped = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (stripped || 'khac').slice(0, maxLength).replace(/-+$/g, '')
}

/** Khung đăng dạng yymmdd-hh theo giờ địa phương, ví dụ `260915-20`. */
export function postSlot(at: Date): string {
  const yy = String(at.getFullYear() % 100).padStart(2, '0')
  const mm = String(at.getMonth() + 1).padStart(2, '0')
  const dd = String(at.getDate()).padStart(2, '0')
  const hh = String(at.getHours()).padStart(2, '0')
  return `${yy}${mm}${dd}-${hh}`
}

export function makeSubIds(opts: {
  channel: Channel
  postType: PostType
  category: string
  at: Date
  variant: Variant
}): SubIds {
  return {
    sub1: opts.channel,
    sub2: opts.postType,
    sub3: slug(opts.category),
    sub4: postSlot(opts.at),
    sub5: opts.variant,
  }
}

export function toArray(s: SubIds): [string, string, string, string, string] {
  return [s.sub1, s.sub2, s.sub3, s.sub4, s.sub5]
}

/** Gắn subId vào một URL Shopee thường, dùng khi chưa có generateShortLink. */
export function appendSubIds(url: string, s: SubIds): string {
  const u = new URL(url)
  const values = toArray(s)
  for (let i = 0; i < values.length; i += 1) {
    u.searchParams.set(`sub_id${i + 1}`, values[i] as string)
  }
  return u.toString()
}
