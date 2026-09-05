import { checkBlocked } from '../compliance/blocklist.ts'
import { finishIngestRun, insertSnapshot, startIngestRun, upsertProduct } from '../db/repo.ts'
import type { OfferSource } from '../sources/types.ts'

export type IngestResult = {
  seen: number
  stored: number
  blocked: number
  blockedSamples: Array<{ name: string; reason: string }>
}

/**
 * Thu thập offer rồi ghi vào DB.
 *
 * Danh sách chặn tuân thủ chạy Ở ĐÂY, trước khi ghi. Hàng bị chặn không bao giờ
 * vào DB, nên không tồn tại đường nào để nó lọt ra bài đăng — kể cả khi các lớp
 * phía sau có bug.
 */
export async function ingest(
  source: OfferSource,
  opts: { keyword?: string; limit: number },
): Promise<IngestResult> {
  const startedAt = new Date().toISOString()
  const runId = await startIngestRun(source.name, startedAt)

  const result: IngestResult = { seen: 0, stored: 0, blocked: 0, blockedSamples: [] }

  try {
    const offers = await source.fetchOffers({ limit: opts.limit, keyword: opts.keyword })
    result.seen = offers.length

    const capturedAt = new Date().toISOString()

    for (const offer of offers) {
      const check = checkBlocked(offer.name, offer.categoryPath)
      if (check.blocked) {
        result.blocked += 1
        if (result.blockedSamples.length < 5) {
          result.blockedSamples.push({ name: offer.name, reason: check.reason })
        }
        continue
      }

      await upsertProduct(
        {
          itemId: offer.itemId,
          shopId: offer.shopId,
          name: offer.name,
          categoryPath: offer.categoryPath,
          url: offer.url,
        },
        capturedAt,
      )

      await insertSnapshot(
        {
          itemId: offer.itemId,
          priceVnd: offer.priceVnd,
          originalPriceVnd: offer.originalPriceVnd,
          baseCommissionRate: offer.baseCommissionRate,
          xtraCommissionRate: offer.xtraCommissionRate,
          salesCount: offer.salesCount,
          rating: offer.rating,
          inStock: offer.inStock,
        },
        capturedAt,
      )

      result.stored += 1
    }

    await finishIngestRun(runId, result.seen, result.blocked, null)
    return result
  } catch (err) {
    await finishIngestRun(runId, result.seen, result.blocked, String(err))
    throw err
  }
}
