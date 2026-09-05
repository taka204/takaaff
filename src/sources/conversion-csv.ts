import { readFileSync } from 'node:fs'
import { parseCsv, mapHeader } from './manual-csv.ts'
import { normalizeStatus, parseFlexibleDate } from './types.ts'
import type { ConversionFetchOptions, ConversionRecord, ConversionSource } from './types.ts'

/**
 * Đọc báo cáo đơn hàng xuất tay từ dashboard affiliate.
 *
 * Đây là thứ đóng vòng phản hồi mà không cần quyền Open API. Không có nó, engine
 * chọn được hàng nhưng không bao giờ biết mình chọn đúng hay sai — tức là chỉ có
 * bốn lớp đầu của kiến trúc, còn lớp thứ năm nằm chờ một quyết định của Shopee.
 */

const HEADER_ALIASES: Record<string, string[]> = {
  orderId: ['order_id', 'orderid', 'ma_don_hang', 'ma_don', 'conversion_id', 'conversionid', 'ma_dat_hang'],
  itemId: ['item_id', 'itemid', 'ma_san_pham', 'product_id', 'productid'],
  orderValueVnd: ['order_value', 'order_value_vnd', 'gia_tri_don_hang', 'gia_tri', 'doanh_thu', 'item_price', 'gia_san_pham'],
  commissionVnd: ['commission', 'commission_vnd', 'hoa_hong', 'hoa_hong_uoc_tinh', 'net_commission', 'item_total_commission'],
  status: ['status', 'trang_thai', 'trang_thai_don_hang', 'order_status'],
  orderedAt: ['ordered_at', 'order_time', 'purchase_time', 'thoi_gian_dat_hang', 'ngay_dat_hang', 'ngay_dat', 'thoi_gian_dat'],
  validatedAt: ['validated_at', 'validated_time', 'thoi_gian_doi_soat', 'ngay_doi_soat'],
  sourceType: ['campaign_type', 'loai_chien_dich', 'nguon', 'source', 'kenh'],
  sub1: ['sub_id1', 'sub_id_1', 'subid1', 'sub1'],
  sub2: ['sub_id2', 'sub_id_2', 'subid2', 'sub2'],
  sub3: ['sub_id3', 'sub_id_3', 'subid3', 'sub3'],
  sub4: ['sub_id4', 'sub_id_4', 'subid4', 'sub4'],
  sub5: ['sub_id5', 'sub_id_5', 'subid5', 'sub5'],
}

export type ConversionCsvOptions = {
  /** Dùng khi file không có cột phân biệt nguồn. Dashboard cũ thường thiếu cột này. */
  defaultSource?: 'link' | 'video'
}

export class ManualConversionCsvSource implements ConversionSource {
  readonly name = 'conversion-csv'
  readonly #filePath: string
  readonly #defaultSource: 'link' | 'video'

  constructor(filePath: string, opts: ConversionCsvOptions = {}) {
    this.#filePath = filePath
    this.#defaultSource = opts.defaultSource ?? 'link'
  }

  async fetchConversions(opts: ConversionFetchOptions): Promise<ConversionRecord[]> {
    const rows = parseCsv(readFileSync(this.#filePath, 'utf8'))
    if (rows.length === 0) return []

    const header = rows[0] as string[]
    const index = mapHeader(header, HEADER_ALIASES)

    if (index['orderId'] === undefined) {
      throw new Error(
        `CSV thiếu cột mã đơn hàng. Cột nhận diện được: ${header.join(', ')}`,
      )
    }

    const fromMs = opts.from.getTime()
    const toMs = opts.to.getTime()
    const records: ConversionRecord[] = []

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] as string[]
      if (row.length === 0 || row.every((c) => c.trim() === '')) continue

      const get = (key: string): string => {
        const at = index[key]
        return at === undefined ? '' : (row[at] ?? '').trim()
      }

      const orderId = get('orderId')
      if (orderId === '') continue

      const orderedAt = parseFlexibleDate(get('orderedAt'))

      // Lọc theo khoảng thời gian. Đơn không có mốc thời gian vẫn được nhận —
      // loại bỏ chúng sẽ âm thầm đánh mất doanh thu chỉ vì thiếu một cột.
      if (orderedAt !== null) {
        const ms = Date.parse(orderedAt)
        if (ms < fromMs || ms > toMs) continue
      }

      records.push({
        orderId,
        itemId: get('itemId'),
        source: detectSource(get('sourceType'), this.#defaultSource),
        subIds: {
          sub1: get('sub1'),
          sub2: get('sub2'),
          sub3: get('sub3'),
          sub4: get('sub4'),
          sub5: get('sub5'),
        },
        orderValueVnd: toNumber(get('orderValueVnd')),
        commissionVnd: toNumber(get('commissionVnd')),
        status: normalizeStatus(get('status')),
        orderedAt,
        validatedAt: parseFlexibleDate(get('validatedAt')),
      })
    }

    return records
  }
}

export function detectSource(raw: string, fallback: 'link' | 'video'): 'link' | 'video' {
  const t = raw.toLowerCase()
  if (t === '') return fallback
  if (t.includes('video') || t.includes('livestream') || t.includes('live')) return 'video'
  if (t.includes('link') || t.includes('product')) return 'link'
  return fallback
}

function toNumber(raw: string): number {
  if (raw === '') return 0
  const cleaned = raw.replace(/[đ₫\s]/gi, '').replace(/[.,](?=\d{3}\b)/g, '')
  const parsed = Number(cleaned.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}
