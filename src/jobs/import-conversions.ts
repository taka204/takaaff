import { upsertConversion } from '../db/repo.ts'
import type { ConversionSource } from '../sources/types.ts'

/**
 * Nạp đơn hàng vào DB từ bất kỳ nguồn nào.
 *
 * Job này không biết dữ liệu đến từ CSV xuất tay hay từ Open API — đúng như lớp
 * ingest không biết offer đến từ đâu. Nhờ vậy vòng phản hồi chạy được ngay hôm
 * nay, và ngày được cấp quyền API chỉ là đổi một tham số.
 */

export type ImportResult = {
  fetched: number
  stored: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
  /** Chỉ đơn đã hoàn tất đối soát — tiền chắc chắn. */
  confirmedCommissionVnd: number
  /** Gồm cả đơn còn treo, trừ đơn huỷ — trần trên. */
  pendingCommissionVnd: number
}

export async function importConversions(
  source: ConversionSource,
  opts: { from: Date; to: Date },
): Promise<ImportResult> {
  const records = await source.fetchConversions(opts)

  const result: ImportResult = {
    fetched: records.length,
    stored: 0,
    byStatus: {},
    bySource: {},
    confirmedCommissionVnd: 0,
    pendingCommissionVnd: 0,
  }

  for (const r of records) {
    await upsertConversion({
      orderId: r.orderId,
      itemId: r.itemId,
      source: r.source,
      subIds: r.subIds,
      orderValueVnd: r.orderValueVnd,
      commissionVnd: r.commissionVnd,
      status: r.status,
      orderedAt: r.orderedAt,
      validatedAt: r.validatedAt,
    })

    result.stored += 1
    result.byStatus[r.status] = (result.byStatus[r.status] ?? 0) + 1
    result.bySource[r.source] = (result.bySource[r.source] ?? 0) + 1
    if (r.status === 'completed') result.confirmedCommissionVnd += r.commissionVnd
    if (r.status !== 'cancelled') result.pendingCommissionVnd += r.commissionVnd
  }

  return result
}
