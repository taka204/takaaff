import { readFileSync } from 'node:fs'
import { normalizeRate } from './types.ts'
import type { FetchOptions, Offer, OfferSource } from './types.ts'

/**
 * Đọc file CSV xuất tay từ dashboard affiliate.
 *
 * Đây là đường lui cho rủi ro số một của dự án: nếu Open API bị từ chối, engine
 * vẫn chạy đủ, chỉ mất tính tức thời. Cũng là nguồn dữ liệu để phát triển và
 * test toàn bộ M1/M2 trong lúc còn chờ duyệt API.
 */

const HEADER_ALIASES: Record<string, string[]> = {
  itemId: ['item_id', 'itemid', 'ma_san_pham', 'product_id'],
  shopId: ['shop_id', 'shopid', 'ma_shop'],
  name: ['name', 'product_name', 'ten_san_pham', 'tieu_de'],
  categoryPath: ['category_path', 'category', 'nganh_hang', 'danh_muc'],
  url: ['url', 'product_link', 'link', 'duong_dan'],
  priceVnd: ['price', 'price_vnd', 'gia', 'gia_ban'],
  originalPriceVnd: ['original_price', 'original_price_vnd', 'gia_goc'],
  baseCommissionRate: ['base_commission_rate', 'commission_rate', 'hoa_hong', 'hoa_hong_co_ban'],
  xtraCommissionRate: ['xtra_commission_rate', 'xtra_rate', 'hoa_hong_xtra', 'xtra'],
  salesCount: ['sales_count', 'sales', 'da_ban', 'so_luong_ban'],
  rating: ['rating', 'danh_gia', 'diem_danh_gia'],
  inStock: ['in_stock', 'con_hang', 'stock'],
}

export class ManualCsvSource implements OfferSource {
  readonly name = 'manual-csv'
  readonly #filePath: string

  constructor(filePath: string) {
    this.#filePath = filePath
  }

  async fetchOffers(opts: FetchOptions): Promise<Offer[]> {
    const raw = readFileSync(this.#filePath, 'utf8')
    const rows = parseCsv(raw)
    if (rows.length === 0) return []

    const header = rows[0] as string[]
    const index = mapHeader(header, HEADER_ALIASES)

    const missing = ['itemId', 'name', 'priceVnd'].filter((k) => index[k] === undefined)
    if (missing.length > 0) {
      throw new Error(
        `CSV thiếu cột bắt buộc: ${missing.join(', ')}. Cột nhận diện được: ${header.join(', ')}`,
      )
    }

    const offers: Offer[] = []
    for (let i = 1; i < rows.length && offers.length < opts.limit; i += 1) {
      const row = rows[i] as string[]
      if (row.length === 0 || row.every((c) => c.trim() === '')) continue

      const get = (key: string): string => {
        const at = index[key]
        return at === undefined ? '' : (row[at] ?? '').trim()
      }

      const itemId = get('itemId')
      if (itemId === '') continue

      if (opts.keyword !== undefined && opts.keyword !== '') {
        const needle = opts.keyword.toLowerCase()
        if (!get('name').toLowerCase().includes(needle)) continue
      }

      const inStockRaw = get('inStock').toLowerCase()
      offers.push({
        itemId,
        shopId: get('shopId'),
        name: get('name'),
        categoryPath: get('categoryPath'),
        url: get('url'),
        priceVnd: toNumber(get('priceVnd')),
        originalPriceVnd: toNumber(get('originalPriceVnd')),
        baseCommissionRate: normalizeRate(get('baseCommissionRate')),
        xtraCommissionRate: normalizeRate(get('xtraCommissionRate')),
        salesCount: toNumber(get('salesCount')),
        rating: toNumber(get('rating')),
        inStock: inStockRaw === '' ? true : !['0', 'false', 'no', 'khong', 'không'].includes(inStockRaw),
      })
    }
    return offers
  }
}

function toNumber(raw: string): number {
  if (raw === '') return 0
  // Bỏ dấu phân cách nghìn kiểu Việt Nam ("1.250.000" và "1,250,000").
  const cleaned = raw.replace(/[đ₫\s]/gi, '').replace(/[.,](?=\d{3}\b)/g, '')
  const parsed = Number(cleaned.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Khớp tên cột thật với tên trường nội bộ.
 *
 * Chuẩn hoá về chữ thường không dấu trước khi so, nên "Giá trị đơn hàng",
 * "gia_tri_don_hang" và "GIA TRI DON HANG" đều khớp cùng một alias. Dùng chung
 * cho cả CSV sản phẩm lẫn CSV đơn hàng.
 */
export function mapHeader(
  header: string[],
  aliasTable: Record<string, string[]>,
): Record<string, number> {
  const normalized = header.map((h) =>
    h
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
  )

  const index: Record<string, number> = {}
  for (const [field, aliases] of Object.entries(aliasTable)) {
    const at = normalized.findIndex((h) => aliases.includes(h))
    if (at !== -1) index[field] = at
  }
  return index
}

/** Parser CSV tối thiểu: hỗ trợ dấu ngoặc kép, ngoặc kép lồng, xuống dòng trong ô. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Bỏ BOM nếu có.
  const first = rows[0]
  if (first && first[0] !== undefined) {
    first[0] = first[0].replace(/^\uFEFF/, '')
  }
  return rows
}
