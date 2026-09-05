import { config, hasTelegramCredentials } from '../config.ts'
import { withDisclosure } from '../compliance/disclosure.ts'
import { insertPost, upsertLink } from '../db/repo.ts'
import type { RankedRow } from '../db/repo.ts'
import { appendSubIds, makeSubIds, slug } from '../subid.ts'
import type { Channel, PostType, Variant } from '../subid.ts'

const vnd = new Intl.NumberFormat('vi-VN')

export type ComposeOptions = {
  channel: Channel
  postType: PostType
  variant: Variant
  at: Date
}

export type ComposedPost = {
  itemId: string
  text: string
  url: string
  subIds: ReturnType<typeof makeSubIds>
}

/**
 * Soạn nội dung bài đăng.
 *
 * Cố ý KHÔNG hiển thị tỉ lệ hoa hồng: đó là số liệu vận hành của mình, không
 * phải thông tin hữu ích cho người mua, và phô ra chỉ làm giảm độ tin cậy.
 * Người đọc cần giá, mức giảm, đánh giá và số đã bán.
 */
export function compose(row: RankedRow, opts: ComposeOptions): ComposedPost {
  const subIds = makeSubIds({
    channel: opts.channel,
    postType: opts.postType,
    category: slug(row.categoryPath || 'khac'),
    at: opts.at,
    variant: opts.variant,
  })

  const url = row.url === '' ? '' : appendSubIds(row.url, subIds)

  const lines: string[] = []
  lines.push(headline(opts.postType, row.name))
  lines.push('')

  const discount =
    row.originalPriceVnd > row.priceVnd && row.originalPriceVnd > 0
      ? Math.round(((row.originalPriceVnd - row.priceVnd) / row.originalPriceVnd) * 100)
      : 0

  lines.push(
    discount > 0
      ? `💰 ${vnd.format(row.priceVnd)}đ — giảm ${discount}% từ ${vnd.format(row.originalPriceVnd)}đ`
      : `💰 ${vnd.format(row.priceVnd)}đ`,
  )

  const stats: string[] = []
  if (row.rating > 0) stats.push(`⭐ ${row.rating.toFixed(1)}`)
  if (row.salesCount > 0) stats.push(`đã bán ${vnd.format(row.salesCount)}`)
  if (stats.length > 0) lines.push(stats.join(' · '))

  if (url !== '') {
    lines.push('')
    lines.push(`👉 ${url}`)
  }

  return { itemId: row.itemId, text: withDisclosure(lines.join('\n')), url, subIds }
}

function headline(postType: PostType, name: string): string {
  const prefix: Record<PostType, string> = {
    flash: '⚡ GIÁ TỐT HÔM NAY',
    restock: '📦 CÓ HÀNG LẠI',
    review: '🔍 ĐÁNG CHÚ Ý',
    compare: '⚖️ SO SÁNH',
    evergreen: '🛒 GỢI Ý',
  }
  return `${prefix[postType]}\n${name}`
}

export type PublishResult = {
  composed: ComposedPost
  sent: boolean
  reason?: string
}

/**
 * Đăng lên Telegram. `dryRun` in ra đúng nội dung sẽ gửi mà không gửi và không
 * ghi DB — đây là chế độ dùng suốt giai đoạn M2.
 */
export async function publish(
  row: RankedRow,
  opts: ComposeOptions & { dryRun: boolean },
): Promise<PublishResult> {
  const composed = compose(row, opts)

  if (opts.dryRun) {
    return { composed, sent: false, reason: 'dry-run' }
  }

  if (!hasTelegramCredentials()) {
    return { composed, sent: false, reason: 'thiếu TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID' }
  }

  const res = await fetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text: composed.text,
        disable_web_page_preview: false,
      }),
    },
  )

  const body = (await res.json()) as { ok?: boolean; description?: string; result?: { message_id?: number } }
  if (!res.ok || body.ok !== true) {
    return { composed, sent: false, reason: body.description ?? `HTTP ${res.status}` }
  }

  const now = new Date().toISOString()
  const linkId =
    composed.url === ''
      ? null
      : await upsertLink(row.itemId, composed.url, composed.subIds, now)
  await insertPost(
    opts.channel,
    linkId,
    row.itemId,
    opts.variant,
    now,
    body.result?.message_id === undefined ? null : String(body.result.message_id),
  )

  return { composed, sent: true }
}
