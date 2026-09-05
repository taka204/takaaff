import { intParam, json, unauthorized } from './_auth.ts'
import { toNodeHandler } from './_node.ts'
import { latestScoreRun, topScores } from '../db/repo.ts'
import { config } from '../config.ts'

/**
 * Bảng xếp hạng của lượt chấm điểm gần nhất.
 *
 * Chỉ đọc. Dashboard không sửa dữ liệu — mọi thay đổi đi qua CLI, nơi có test
 * bảo vệ. Một endpoint ghi trên internet là bề mặt tấn công không cần thiết cho
 * thứ mà chỉ một người dùng.
 */
export async function handle(request: Request): Promise<Response> {
  const denied = unauthorized(request)
  if (denied) return denied

  const url = new URL(request.url)
  const limit = intParam(url, 'limit', 20, 200)

  const run = await latestScoreRun()
  if (run === null) {
    return json({ computedAt: null, perOrderCapVnd: config.perOrderCapVnd, rows: [] })
  }

  const rows = await topScores(limit, run)

  return json({
    computedAt: run,
    perOrderCapVnd: config.perOrderCapVnd,
    rows: rows.map((r) => ({
      itemId: r.itemId,
      name: r.name,
      url: r.url,
      categoryPath: r.categoryPath,
      priceVnd: r.priceVnd,
      originalPriceVnd: r.originalPriceVnd,
      rating: r.rating,
      salesCount: r.salesCount,
      effectiveRate: r.effectiveRate,
      hasXtra: r.xtraCommissionRate > 0,
      cappedCommissionVnd: r.cappedCommissionVnd,
      evPerClick: r.evPerClick,
    })),
  })
}

export default toNodeHandler(handle)
