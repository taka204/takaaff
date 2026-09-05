/**
 * Ranh giới quan trọng nhất của codebase.
 *
 * Quyền truy cập Shopee Affiliate Open API chưa được cấp và có thể bị từ chối
 * (lỗi 10035). Mọi thứ phía trên interface này — chấm điểm, xếp hạng, sinh link,
 * đăng bài, báo cáo — được viết để chạy trên `Offer`, không biết dữ liệu đến từ
 * API hay từ file CSV xuất tay. Nhờ vậy việc bị từ chối API làm engine mất tính
 * tức thời chứ không làm mất một dòng logic nào.
 */

export type Offer = {
  itemId: string
  shopId: string
  name: string
  categoryPath: string
  url: string
  priceVnd: number
  /** Giá gốc trước giảm. 0 nghĩa là không rõ. */
  originalPriceVnd: number
  /** Tỉ lệ dạng phân số: 0.0368 = 3,68%. */
  baseCommissionRate: number
  /** Hoa hồng XTRA do người bán trả, cộng dồn lên mức cơ bản. */
  xtraCommissionRate: number
  salesCount: number
  /** Thang 0–5. 0 nghĩa là chưa có đánh giá. */
  rating: number
  inStock: boolean
}

export type FetchOptions = {
  keyword?: string
  limit: number
  page?: number
}

export interface OfferSource {
  readonly name: string
  fetchOffers(opts: FetchOptions): Promise<Offer[]>
}

// ---------------------------------------------------------------------------
// Đơn hàng — cùng một ranh giới, áp cho chiều ngược lại.
//
// Đơn đi vào hệ thống cũng qua interface thay vì gọi thẳng API, vì lý do y hệt
// lớp offer: dashboard xuất được báo cáo đơn ra CSV, nên vòng phản hồi — thứ
// tạo ra toàn bộ giá trị của engine — chạy được mà không cần quyền Open API.
// ---------------------------------------------------------------------------

export const CONVERSION_STATUSES = ['pending', 'completed', 'cancelled'] as const
export type ConversionStatus = (typeof CONVERSION_STATUSES)[number]

export type ConversionRecord = {
  orderId: string
  itemId: string
  /** 'video' = đơn từ giỏ hàng in-app của Shopee Video, không mang subId. */
  source: 'link' | 'video'
  subIds: { sub1: string; sub2: string; sub3: string; sub4: string; sub5: string }
  orderValueVnd: number
  commissionVnd: number
  status: ConversionStatus
  /** ISO 8601, hoặc null nếu nguồn không cung cấp. */
  orderedAt: string | null
  validatedAt: string | null
}

export type ConversionFetchOptions = {
  from: Date
  to: Date
}

export interface ConversionSource {
  readonly name: string
  fetchConversions(opts: ConversionFetchOptions): Promise<ConversionRecord[]>
}

/**
 * Chuẩn hoá trạng thái đơn về ba giá trị.
 *
 * Quan trọng hơn vẻ ngoài: dashboard tiếng Việt trả "Đã hủy", API trả
 * "cancelled". Không chuẩn hoá thì đơn huỷ lọt vào báo cáo doanh thu và EPC bị
 * thổi phồng — sai theo đúng hướng nguy hiểm nhất, vì nó khiến bạn tin một kênh
 * đang hiệu quả trong khi không phải.
 *
 * Giá trị lạ được coi là 'pending' chứ không phải 'completed': chưa biết thì
 * không tính là tiền.
 */
export function normalizeStatus(raw: string): ConversionStatus {
  const t = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')

  if (t === '') return 'pending'
  if (/huy|cancel|refund|hoan tra|tra hang|invalid|khong hop le/.test(t)) return 'cancelled'
  if (/hoan thanh|complete|paid|da doi soat|validated|thanh cong|fulfilled/.test(t)) {
    return 'completed'
  }
  return 'pending'
}

/**
 * Đọc mốc thời gian từ nhiều định dạng: ISO, "yyyy-mm-dd hh:mm:ss", unix giây,
 * và dd/mm/yyyy.
 *
 * Định dạng gạch chéo được hiểu là NGÀY/THÁNG/NĂM theo quy ước Việt Nam. Với
 * ngày ≤ 12 thì không có cách nào phân biệt được với mm/dd, nên đây là giả định
 * cố ý — dashboard Shopee Việt Nam dùng dd/mm.
 */
export function parseFlexibleDate(raw: string): string | null {
  const t = raw.trim()
  if (t === '') return null

  if (/^\d{9,13}$/.test(t)) {
    const n = Number(t)
    const ms = t.length <= 10 ? n * 1000 : n
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (slash) {
    const [, dd, mm, yyyy, hh = '0', mi = '0', ss = '0'] = slash
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss),
    )
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const d = new Date(t.includes('T') ? t : t.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Chuẩn hoá tỉ lệ hoa hồng về dạng phân số.
 *
 * Dữ liệu vào rất tạp: dashboard xuất ra "12%", API trả 0.12, người nhập tay gõ
 * 12. Quy ước: có ký tự % thì chia 100; giá trị lớn hơn 1 thì coi là phần trăm.
 * Hệ quả là 1 được hiểu là 1% chứ không phải 100% — đúng với thực tế vì không
 * có hoa hồng 100%.
 */
export function normalizeRate(raw: string | number): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return 0
    return raw > 1 ? raw / 100 : raw
  }
  const text = raw.trim()
  if (text === '') return 0
  const hasPercent = text.includes('%')
  const parsed = Number(text.replace(/[%\s,]/g, ''))
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  if (hasPercent) return parsed / 100
  return parsed > 1 ? parsed / 100 : parsed
}
