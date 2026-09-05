import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { convertProbability, BASE_CONVERT_RATE } from '../src/scoring/convert-prob.ts'
import { scoreCandidate, salesPerDay, discountDepth } from '../src/scoring/score.ts'
import type { Candidate } from '../src/db/repo.ts'

const PARAMS = { perOrderCapVnd: 30_000, minPriceVnd: 50_000, maxPriceVnd: 1_000_000 }

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    itemId: '1',
    shopId: '9',
    name: 'Sản phẩm mẫu',
    categoryPath: 'Nhà cửa',
    url: 'https://shopee.vn/product/9/1',
    priceVnd: 250_000,
    originalPriceVnd: 400_000,
    baseCommissionRate: 0.025,
    xtraCommissionRate: 0.15,
    salesCount: 1000,
    rating: 4.6,
    capturedAt: '2026-09-05T12:00:00.000Z',
    prevSalesCount: 900,
    prevCapturedAt: '2026-09-04T12:00:00.000Z',
    ...over,
  }
}

describe('convertProbability', () => {
  test('luôn nằm trong biên [0.001, 0.12]', () => {
    const extreme = convertProbability({
      priceVnd: 200_000,
      discountDepth: 1,
      salesPerDay: 100_000,
      rating: 5,
      hasXtra: true,
      minPriceVnd: 50_000,
      maxPriceVnd: 1_000_000,
    })
    assert.ok(extreme.p <= 0.12, `p=${extreme.p} vượt trần`)

    const awful = convertProbability({
      priceVnd: 5_000_000,
      discountDepth: 0,
      salesPerDay: 0,
      rating: 1,
      hasXtra: false,
      minPriceVnd: 50_000,
      maxPriceVnd: 1_000_000,
    })
    assert.ok(awful.p >= 0.001, `p=${awful.p} dưới sàn`)
  })

  test('đánh giá dưới 4 sao bị phạt nặng hơn hẳn', () => {
    const base = {
      priceVnd: 200_000,
      discountDepth: 0.3,
      salesPerDay: 20,
      hasXtra: false,
      minPriceVnd: 50_000,
      maxPriceVnd: 1_000_000,
    }
    const good = convertProbability({ ...base, rating: 4.5 })
    const bad = convertProbability({ ...base, rating: 3.9 })
    assert.ok(bad.p < good.p * 0.75, 'hàng dưới 4 sao phải tụt rõ rệt')
  })

  test('chưa có đánh giá thì không bị phạt như hàng điểm thấp', () => {
    const base = {
      priceVnd: 200_000,
      discountDepth: 0.3,
      salesPerDay: 20,
      hasXtra: false,
      minPriceVnd: 50_000,
      maxPriceVnd: 1_000_000,
    }
    const unknown = convertProbability({ ...base, rating: 0 })
    const bad = convertProbability({ ...base, rating: 3.5 })
    assert.ok(unknown.p > bad.p)
  })

  test('hệ số cơ sở đúng như hằng số công bố', () => {
    const r = convertProbability({
      priceVnd: 200_000,
      discountDepth: 0,
      salesPerDay: 0,
      rating: 0,
      hasXtra: false,
      minPriceVnd: 50_000,
      maxPriceVnd: 1_000_000,
    })
    assert.equal(r.base, BASE_CONVERT_RATE)
  })
})

describe('salesPerDay', () => {
  test('tính từ chênh lệch hai ảnh chụp', () => {
    assert.equal(salesPerDay(candidate()), 100)
  })

  test('không có ảnh chụp trước thì trả 0', () => {
    assert.equal(salesPerDay(candidate({ prevSalesCount: null, prevCapturedAt: null })), 0)
  })

  test('chặn sàn 1 giờ để khoảng cách ngắn không thổi phồng tốc độ', () => {
    const c = candidate({
      capturedAt: '2026-09-05T12:05:00.000Z',
      prevCapturedAt: '2026-09-05T12:00:00.000Z',
      salesCount: 1001,
      prevSalesCount: 1000,
    })
    // 1 đơn trong 5 phút mà không chặn sàn sẽ ra 288/ngày.
    assert.equal(salesPerDay(c), 24)
  })

  test('số bán giảm (Shopee đổi cách đếm) không cho ra giá trị âm', () => {
    assert.equal(salesPerDay(candidate({ salesCount: 800, prevSalesCount: 900 })), 0)
  })
})

describe('discountDepth', () => {
  test('tính đúng tỉ lệ giảm', () => {
    assert.equal(discountDepth(candidate({ priceVnd: 300_000, originalPriceVnd: 400_000 })), 0.25)
  })

  test('không có giá gốc thì trả 0', () => {
    assert.equal(discountDepth(candidate({ originalPriceVnd: 0 })), 0)
  })
})

describe('scoreCandidate', () => {
  test('trần hoa hồng được áp trong công thức, không phải lọc sau', () => {
    const expensive = candidate({
      priceVnd: 1_000_000,
      baseCommissionRate: 0.03,
      xtraCommissionRate: 0.1,
    })
    const s = scoreCandidate(expensive, PARAMS)

    // 1.000.000 × 13% = 130.000 nhưng trần là 30.000.
    assert.equal(s.cappedCommissionVnd, 30_000)
    assert.equal(s.reasons.cappedByLimit, true)
    assert.equal(s.reasons.grossCommissionVnd, 130_000)
  })

  test('dưới trần thì giữ nguyên hoa hồng thực', () => {
    const cheap = candidate({
      priceVnd: 100_000,
      baseCommissionRate: 0.02,
      xtraCommissionRate: 0.05,
    })
    const s = scoreCandidate(cheap, PARAMS)
    assert.ok(Math.abs(s.cappedCommissionVnd - 7_000) < 1e-6)
    assert.equal(s.reasons.cappedByLimit, false)
  })

  test('hàng XTRA thắng hàng cùng giá không XTRA', () => {
    const withXtra = scoreCandidate(candidate({ xtraCommissionRate: 0.15 }), PARAMS)
    const withoutXtra = scoreCandidate(candidate({ xtraCommissionRate: 0 }), PARAMS)
    assert.ok(
      withXtra.evPerClick > withoutXtra.evPerClick,
      'engine tồn tại để ưu tiên hàng XTRA — bất biến này không được phép gãy',
    )
  })

  test('effectiveRate là tổng hoa hồng cơ bản và XTRA', () => {
    const s = scoreCandidate(candidate({ baseCommissionRate: 0.025, xtraCommissionRate: 0.15 }), PARAMS)
    assert.ok(Math.abs(s.effectiveRate - 0.175) < 1e-9)
  })

  test('hàng đắt vượt trần bị hàng rẻ hơn trong vùng giá tốt vượt mặt', () => {
    const expensive = scoreCandidate(
      candidate({ priceVnd: 2_000_000, baseCommissionRate: 0.03, xtraCommissionRate: 0.1 }),
      PARAMS,
    )
    const sweet = scoreCandidate(
      candidate({ priceVnd: 250_000, baseCommissionRate: 0.03, xtraCommissionRate: 0.1 }),
      PARAMS,
    )
    assert.ok(
      sweet.evPerClick > expensive.evPerClick,
      'trần hoa hồng phải khiến hàng giá trị lớn tự tụt hạng',
    )
  })
})
