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
