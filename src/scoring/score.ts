import { convertProbability } from './convert-prob.ts'
import type { ConvertBreakdown } from './convert-prob.ts'
import type { Candidate } from '../db/repo.ts'

/**
 * Giá trị kỳ vọng mỗi click.
 *
 *   effective_rate = base_rate + xtra_rate
 *   commission     = min(price * effective_rate, PER_ORDER_CAP)
 *   ev_per_click   = commission * p_convert
 *
 * Trần hoa hồng nằm TRONG công thức chứ không phải là bộ lọc chạy sau. Nếu chỉ
 * lọc sau, engine sẽ vẫn xếp hạng cao cho hàng giá trị lớn rồi mới phát hiện
 * hoa hồng bị chặn; đưa trần vào đây khiến hàng đắt tự động tụt hạng đúng mức.
 */

export type ScoreParams = {
  perOrderCapVnd: number
  minPriceVnd: number
  maxPriceVnd: number
}

export type ScoreResult = {
  itemId: string
  evPerClick: number
  pConvert: number
  effectiveRate: number
  cappedCommissionVnd: number
  reasons: {
    baseRate: number
    xtraRate: number
    grossCommissionVnd: number
    cappedByLimit: boolean
    discountDepth: number
    salesPerDay: number
    convert: ConvertBreakdown
  }
}

/** Ước tốc độ bán từ chênh lệch giữa hai ảnh chụp gần nhất. */
export function salesPerDay(c: Candidate): number {
  if (c.prevSalesCount === null || c.prevCapturedAt === null) return 0

  const deltaUnits = c.salesCount - c.prevSalesCount
  if (deltaUnits <= 0) return 0

  const deltaMs = Date.parse(c.capturedAt) - Date.parse(c.prevCapturedAt)
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0

  const deltaDays = deltaMs / 86_400_000
  // Khoảng cách quá ngắn thì nhiễu lớn: một đơn duy nhất trong 5 phút sẽ suy ra
  // 288 đơn/ngày. Chặn sàn ở 1 giờ để không thổi phồng.
  return deltaUnits / Math.max(deltaDays, 1 / 24)
}

export function discountDepth(c: Candidate): number {
  if (c.originalPriceVnd <= 0 || c.priceVnd <= 0) return 0
  if (c.originalPriceVnd <= c.priceVnd) return 0
  return Math.min(1, (c.originalPriceVnd - c.priceVnd) / c.originalPriceVnd)
}

export function scoreCandidate(c: Candidate, params: ScoreParams): ScoreResult {
  const effectiveRate = c.baseCommissionRate + c.xtraCommissionRate
  const grossCommission = c.priceVnd * effectiveRate
  const cappedCommission = Math.min(grossCommission, params.perOrderCapVnd)

  const depth = discountDepth(c)
  const velocity = salesPerDay(c)

  const convert = convertProbability({
    priceVnd: c.priceVnd,
    discountDepth: depth,
    salesPerDay: velocity,
    rating: c.rating,
    hasXtra: c.xtraCommissionRate > 0,
    minPriceVnd: params.minPriceVnd,
    maxPriceVnd: params.maxPriceVnd,
  })

  return {
    itemId: c.itemId,
    evPerClick: cappedCommission * convert.p,
    pConvert: convert.p,
    effectiveRate,
    cappedCommissionVnd: cappedCommission,
    reasons: {
      baseRate: c.baseCommissionRate,
      xtraRate: c.xtraCommissionRate,
      grossCommissionVnd: grossCommission,
      cappedByLimit: grossCommission > params.perOrderCapVnd,
      discountDepth: depth,
      salesPerDay: velocity,
      convert,
    },
  }
}
