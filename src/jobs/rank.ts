import { config } from '../config.ts'
import { insertScores, listCandidates, topScores } from '../db/repo.ts'
import type { RankedRow } from '../db/repo.ts'
import { scoreCandidate } from '../scoring/score.ts'

/**
 * Chấm điểm toàn bộ ứng viên rồi lưu lại một lượt chạy.
 *
 * Điểm được ghi thành bản mới mỗi lần chạy chứ không ghi đè, vì cần so được
 * bảng xếp hạng hôm nay với hôm qua khi công thức thay đổi.
 */
export function rank(limit: number): { computedAt: string; scored: number; rows: RankedRow[] } {
  const computedAt = new Date().toISOString()
  const candidates = listCandidates()

  const params = {
    perOrderCapVnd: config.perOrderCapVnd,
    minPriceVnd: config.minPriceVnd,
    maxPriceVnd: config.maxPriceVnd,
  }

  const scores = candidates.map((c) => {
    const s = scoreCandidate(c, params)
    return {
      itemId: s.itemId,
      computedAt,
      evPerClick: s.evPerClick,
      pConvert: s.pConvert,
      effectiveRate: s.effectiveRate,
      cappedCommissionVnd: s.cappedCommissionVnd,
      reasons: s.reasons,
    }
  })

  insertScores(scores)

  return { computedAt, scored: scores.length, rows: topScores(limit, computedAt) }
}
