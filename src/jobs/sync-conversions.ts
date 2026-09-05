import { graphql } from '../shopee/client.ts'
import { CONVERSION_REPORT_QUERY } from '../shopee/queries.ts'
import { upsertConversion } from '../db/repo.ts'

/**
 * Kéo conversionReport về và khớp ngược subId — đây là lớp đóng vòng lặp.
 *
 * CẢNH BÁO: cách Shopee trả subId trong conversionReport chưa xác minh được từ
 * tài liệu công khai. Ở đây giả định chúng nằm trong `utmContent` dạng chuỗi
 * ngăn cách; khi được cấp quyền API, việc đầu tiên là in nguyên một bản ghi thật
 * ra rồi sửa `parseSubIds` cho khớp. Cho tới lúc đó, đơn vẫn được ghi nhận đầy
 * đủ, chỉ là các chiều phân tích có thể trống.
 */

type ConversionNode = {
  conversionId?: string | number
  purchaseTime?: number
  orderStatus?: string
  campaignType?: string
  utmContent?: string
  linkedProductInfo?: Array<{
    itemId?: string | number
    itemPrice?: string | number
    qty?: number
    itemTotalCommission?: string | number
  }>
}

type ConversionResponse = {
  conversionReport: {
    nodes: ConversionNode[]
    pageInfo?: { hasNextPage?: boolean; scrollId?: string }
  }
}

export function parseSubIds(utmContent: string | undefined): {
  sub1: string
  sub2: string
  sub3: string
  sub4: string
  sub5: string
} {
  const empty = { sub1: '', sub2: '', sub3: '', sub4: '', sub5: '' }
  if (!utmContent) return empty

  // Dạng đã thấy trong thực tế: JSON mảng, hoặc chuỗi ngăn cách bởi "_" / "|".
  if (utmContent.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(utmContent) as unknown[]
      return {
        sub1: String(arr[0] ?? ''),
        sub2: String(arr[1] ?? ''),
        sub3: String(arr[2] ?? ''),
        sub4: String(arr[3] ?? ''),
        sub5: String(arr[4] ?? ''),
      }
    } catch {
      return empty
    }
  }

  const parts = utmContent.split(/[|_]/)
  return {
    sub1: parts[0] ?? '',
    sub2: parts[1] ?? '',
    sub3: parts[2] ?? '',
    sub4: parts[3] ?? '',
    sub5: parts[4] ?? '',
  }
}

export type SyncResult = { fetched: number; stored: number }

export async function syncConversions(from: Date, to: Date): Promise<SyncResult> {
  const result: SyncResult = { fetched: 0, stored: 0 }
  let scrollId: string | undefined

  do {
    const data = await graphql<ConversionResponse>(CONVERSION_REPORT_QUERY, {
      purchaseTimeStart: Math.floor(from.getTime() / 1000),
      purchaseTimeEnd: Math.floor(to.getTime() / 1000),
      limit: 500,
      scrollId: scrollId ?? null,
    })

    const nodes = data.conversionReport?.nodes ?? []
    result.fetched += nodes.length

    for (const node of nodes) {
      const subIds = parseSubIds(node.utmContent)
      // campaignType phân biệt đơn từ link và đơn từ video — cần đối chiếu giá
      // trị thật khi có API, đây là chỗ duy nhất quyết định cột `source`.
      const source = (node.campaignType ?? '').toLowerCase().includes('video') ? 'video' : 'link'
      const orderedAt =
        node.purchaseTime === undefined ? null : new Date(node.purchaseTime * 1000).toISOString()

      const products = node.linkedProductInfo ?? [{}]
      for (const p of products) {
        upsertConversion({
          orderId: String(node.conversionId ?? ''),
          itemId: String(p.itemId ?? ''),
          source,
          subIds,
          orderValueVnd: Number(p.itemPrice ?? 0) * Number(p.qty ?? 1),
          commissionVnd: Number(p.itemTotalCommission ?? 0),
          status: node.orderStatus ?? 'pending',
          orderedAt,
          validatedAt: null,
        })
        result.stored += 1
      }
    }

    scrollId = data.conversionReport?.pageInfo?.hasNextPage
      ? data.conversionReport.pageInfo.scrollId
      : undefined
  } while (scrollId)

  return result
}
