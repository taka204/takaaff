import { readFileSync } from 'node:fs'
import { mapHeader, parseCsv } from '../sources/manual-csv.ts'
import { setClicksBySubIds, setClicksByUrl } from '../db/repo.ts'

/**
 * Nạp số click từ báo cáo dashboard.
 *
 * Không có click thì không có EPC, mà EPC là chỉ số bắc đẩu — báo cáo phải lùi
 * về "hoa hồng trên mỗi bài", vẫn so sánh được nhưng thô hơn nhiều vì nó trộn
 * lẫn chất lượng nội dung với quy mô kênh.
 *
 * Shopee không trả số click theo subId qua Open API, chỉ hiện trên dashboard,
 * nên đây là đường duy nhất — kể cả sau khi được cấp quyền API.
 */

const HEADER_ALIASES: Record<string, string[]> = {
  clicks: ['clicks', 'click', 'luot_click', 'so_luot_click', 'luot_nhap', 'total_clicks'],
  shortUrl: ['short_url', 'link', 'url', 'duong_dan', 'lien_ket'],
  sub1: ['sub_id1', 'sub_id_1', 'subid1', 'sub1'],
  sub2: ['sub_id2', 'sub_id_2', 'subid2', 'sub2'],
  sub3: ['sub_id3', 'sub_id_3', 'subid3', 'sub3'],
  sub4: ['sub_id4', 'sub_id_4', 'subid4', 'sub4'],
  sub5: ['sub_id5', 'sub_id_5', 'subid5', 'sub5'],
}

export type ClickImportResult = {
  rows: number
  matched: number
  unmatched: number
  totalClicks: number
  /** Vài dòng không khớp được, để còn biết đường sửa. */
  unmatchedSamples: string[]
}

export function importClicks(filePath: string): ClickImportResult {
  const rows = parseCsv(readFileSync(filePath, 'utf8'))
  const result: ClickImportResult = {
    rows: 0,
    matched: 0,
    unmatched: 0,
    totalClicks: 0,
    unmatchedSamples: [],
  }
  if (rows.length === 0) return result

  const header = rows[0] as string[]
  const index = mapHeader(header, HEADER_ALIASES)

  if (index['clicks'] === undefined) {
    throw new Error(`CSV thiếu cột số click. Cột nhận diện được: ${header.join(', ')}`)
  }

  const hasSubIds = index['sub1'] !== undefined
  if (!hasSubIds && index['shortUrl'] === undefined) {
    throw new Error(
      'CSV cần cột sub_id1..sub_id5 hoặc cột link để khớp được với dữ liệu đã lưu.',
    )
  }

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] as string[]
    if (row.length === 0 || row.every((c) => c.trim() === '')) continue

    const get = (key: string): string => {
      const at = index[key]
      return at === undefined ? '' : (row[at] ?? '').trim()
    }

    const clicks = toNumber(get('clicks'))
    if (clicks <= 0) continue
    result.rows += 1

    // Khớp theo tổ hợp subId trước — đó là độ hạt dashboard báo cáo. Rơi về
    // khớp theo URL khi file không có cột subId.
    let changed = 0
    let label = ''

    if (hasSubIds) {
      const subIds = {
        sub1: get('sub1'),
        sub2: get('sub2'),
        sub3: get('sub3'),
        sub4: get('sub4'),
        sub5: get('sub5'),
      }
      label = Object.values(subIds).join('|')
      changed = setClicksBySubIds(subIds, clicks)
    }

    if (changed === 0 && get('shortUrl') !== '') {
      label = get('shortUrl')
      changed = setClicksByUrl(get('shortUrl'), clicks)
    }

    if (changed > 0) {
      result.matched += changed
      result.totalClicks += clicks
    } else {
      result.unmatched += 1
      if (result.unmatchedSamples.length < 5) result.unmatchedSamples.push(label)
    }
  }

  return result
}

function toNumber(raw: string): number {
  if (raw === '') return 0
  const cleaned = raw.replace(/\s/g, '').replace(/[.,](?=\d{3}\b)/g, '')
  const parsed = Number(cleaned.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}
