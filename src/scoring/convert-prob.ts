/**
 * Ước lượng xác suất một click chuyển thành đơn hợp lệ.
 *
 * Đây là bản v0 dùng heuristic nhân — cố ý đặt trong file riêng vì sau khoảng
 * 500 đơn thật, toàn bộ file này sẽ được thay bằng mô hình fit trên bảng
 * `conversion`. Mọi thứ gọi vào đây chỉ phụ thuộc chữ ký hàm, không phụ thuộc
 * cách tính, nên việc thay thế không lan ra chỗ khác.
 *
 * Các hệ số đều được chặn biên để một tín hiệu bất thường (ví dụ salesCount
 * nhảy vọt do Shopee đổi cách đếm) không thể một mình kéo cả bảng xếp hạng.
 */

export const BASE_CONVERT_RATE = 0.015

export type ConvertInputs = {
  priceVnd: number
  /** 0..1 — 0.3 nghĩa là giảm 30% so với giá gốc. */
  discountDepth: number
  /** Số sản phẩm bán ra mỗi ngày, ước từ chênh lệch giữa hai ảnh chụp. */
  salesPerDay: number
  /** Thang 0–5. 0 nghĩa là chưa có đánh giá. */
  rating: number
  hasXtra: boolean
  minPriceVnd: number
  maxPriceVnd: number
}

export type ConvertBreakdown = {
  base: number
  discount: number
  velocity: number
  rating: number
  priceBand: number
  xtra: number
  p: number
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo
  return Math.min(hi, Math.max(lo, v))
}

/** Giảm càng sâu càng dễ chốt, nhưng bão hoà nhanh. */
function discountFactor(depth: number): number {
  return clamp(0.8 + clamp(depth, 0, 1) * 0.6, 0.8, 1.4)
}

/**
 * Hàng đang bán chạy là bằng chứng mạnh nhất rằng nó chốt được — nhưng theo
 * thang log, vì 500 đơn/ngày không tốt gấp 10 lần 50 đơn/ngày.
 */
function velocityFactor(salesPerDay: number): number {
  const v = Math.max(0, salesPerDay)
  const scaled = Math.log10(1 + v) / Math.log10(51)
  return clamp(0.7 + clamp(scaled, 0, 1) * 0.8, 0.7, 1.5)
}

/** Dưới 4.0 sao bị phạt nặng: hàng đó tỉ lệ hoàn cao, đơn hoàn thì mất hoa hồng. */
function ratingFactor(rating: number): number {
  if (rating <= 0) return 0.9 // chưa có đánh giá — không thưởng, không phạt nặng
  if (rating < 4) return 0.6
  return clamp(0.8 + (rating - 4) * 0.4, 0.8, 1.2)
}

/**
 * Vùng giá quyết định mua nhanh. Đỉnh ở khoảng giữa dải cấu hình; quá rẻ thì
 * hoa hồng không bõ, quá đắt thì người mua cân nhắc lâu và dễ mua ở nơi khác
 * trong cửa sổ 7 ngày.
 */
function priceBandFactor(price: number, minPrice: number, maxPrice: number): number {
  if (price <= 0) return 0.7
  const sweetLow = minPrice * 3
  const sweetHigh = Math.min(maxPrice, minPrice * 8)

  if (price >= sweetLow && price <= sweetHigh) return 1.2
  if (price < minPrice) return 0.85
  if (price > maxPrice) return 0.7

  if (price < sweetLow) {
    const t = (price - minPrice) / Math.max(1, sweetLow - minPrice)
    return clamp(0.85 + t * 0.35, 0.85, 1.2)
  }
  const t = (price - sweetHigh) / Math.max(1, maxPrice - sweetHigh)
  return clamp(1.2 - t * 0.5, 0.7, 1.2)
}

export function convertProbability(i: ConvertInputs): ConvertBreakdown {
  const base = BASE_CONVERT_RATE
  const discount = discountFactor(i.discountDepth)
  const velocity = velocityFactor(i.salesPerDay)
  const rating = ratingFactor(i.rating)
  const priceBand = priceBandFactor(i.priceVnd, i.minPriceVnd, i.maxPriceVnd)
  const xtra = i.hasXtra ? 1.15 : 1

  const p = clamp(base * discount * velocity * rating * priceBand * xtra, 0.001, 0.12)

  return { base, discount, velocity, rating, priceBand, xtra, p }
}
