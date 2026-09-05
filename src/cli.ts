import { parseArgs } from 'node:util'
import { config, hasShopeeCredentials } from './config.ts'
import { db } from './db/index.ts'
import { latestScoreRun, topScores } from './db/repo.ts'
import { ingest } from './jobs/ingest.ts'
import { rank } from './jobs/rank.ts'
import { syncConversions } from './jobs/sync-conversions.ts'
import { epcReport, DIMENSIONS } from './report/epc.ts'
import type { Dimension } from './report/epc.ts'
import { compose, publish } from './publish/telegram.ts'
import { createSource } from './sources/index.ts'
import type { SourceKind } from './sources/index.ts'
import { graphql, ShopeeApiError, SHOPEE_ERROR } from './shopee/client.ts'
import { PRODUCT_OFFER_QUERY } from './shopee/queries.ts'
import { isChannel, isPostType, isVariant } from './subid.ts'
import type { Channel, PostType, Variant } from './subid.ts'

const vnd = new Intl.NumberFormat('vi-VN')

const { values, positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
})

const command = positionals[0] ?? 'help'

function flag(name: string, fallback = ''): string {
  const v = values[name]
  if (v === undefined) return fallback
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return Array.isArray(v) ? String(v.at(-1) ?? fallback) : String(v)
}

function intFlag(name: string, fallback: number): number {
  const raw = flag(name)
  if (raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function boolFlag(name: string): boolean {
  return values[name] === true || flag(name) === 'true'
}

async function main(): Promise<void> {
  switch (command) {
    case 'db:init': {
      db()
      console.log(`DB sẵn sàng tại ${config.dbPath}`)
      break
    }

    case 'ingest': {
      const kind = (flag('source', 'csv') === 'api' ? 'api' : 'csv') as SourceKind
      const file = flag('file', 'data/fixtures/offers-sample.csv')
      const source = createSource(kind, file)

      const result = await ingest(source, {
        limit: intFlag('limit', 200),
        keyword: flag('keyword') || undefined,
      })

      console.log(
        `[${source.name}] thấy ${result.seen}, lưu ${result.stored}, chặn ${result.blocked}`,
      )
      for (const s of result.blockedSamples) {
        console.log(`  chặn: ${s.name}  (${s.reason})`)
      }
      break
    }

    case 'rank': {
      const limit = intFlag('limit', 20)
      const { computedAt, scored, rows } = rank(limit)

      if (boolFlag('json')) {
        console.log(JSON.stringify(rows, null, 2))
        break
      }

      console.log(`Đã chấm ${scored} sản phẩm lúc ${computedAt}`)
      console.log(`Trần hoa hồng đang dùng: ${vnd.format(config.perOrderCapVnd)}đ/đơn\n`)
      printRanking(rows)
      break
    }

    case 'link': {
      const itemId = flag('item')
      if (itemId === '') throw new Error('Cần --item=<item_id>')
      const run = latestScoreRun()
      if (run === null) throw new Error('Chưa có lượt chấm điểm nào. Chạy `npm run rank` trước.')

      const row = topScores(10_000, run).find((r) => r.itemId === itemId)
      if (!row) throw new Error(`Không tìm thấy ${itemId} trong lượt chấm điểm gần nhất`)

      const composed = compose(row, {
        channel: channelFlag(),
        postType: postTypeFlag(),
        variant: variantFlag(),
        at: new Date(),
      })
      console.log(composed.url === '' ? '(sản phẩm không có URL)' : composed.url)
      console.log(`subId: ${Object.values(composed.subIds).join(' | ')}`)
      break
    }

    case 'publish': {
      const dryRun = boolFlag('dry-run')
      const limit = intFlag('limit', 3)
      const run = latestScoreRun()
      if (run === null) throw new Error('Chưa có lượt chấm điểm nào. Chạy `npm run rank` trước.')

      const rows = topScores(limit, run)
      if (rows.length === 0) {
        console.log('Không có gì để đăng.')
        break
      }

      for (const row of rows) {
        const result = await publish(row, {
          channel: channelFlag(),
          postType: postTypeFlag(),
          variant: variantFlag(),
          at: new Date(),
          dryRun,
        })

        console.log('─'.repeat(60))
        console.log(result.composed.text)
        console.log('─'.repeat(60))
        console.log(result.sent ? '✓ đã gửi' : `✗ không gửi — ${result.reason}`)
        console.log()
      }
      break
    }

    case 'sync': {
      const from = new Date(flag('from', isoDaysAgo(30)))
      const to = new Date(flag('to', new Date().toISOString()))
      const result = await syncConversions(from, to)
      console.log(`Lấy về ${result.fetched} đơn, ghi ${result.stored} dòng.`)
      break
    }

    case 'epc': {
      const by = flag('by', 'channel')
      if (!(by in DIMENSIONS)) {
        throw new Error(`--by phải là một trong: ${Object.keys(DIMENSIONS).join(', ')}`)
      }
      const days = intFlag('days', 30)
      const rows = epcReport(by as Dimension, days)

      if (rows.length === 0) {
        console.log(`Chưa có dữ liệu trong ${days} ngày qua.`)
        break
      }

      console.log(`${DIMENSIONS[by as Dimension].label} — ${days} ngày qua\n`)
      console.log(
        pad('Nhóm', 18) +
          pad('Đơn', 7) +
          pad('Hoa hồng', 14) +
          pad('Bài', 6) +
          pad('Click', 8) +
          'EPC',
      )
      for (const r of rows) {
        console.log(
          pad(r.bucket, 18) +
            pad(String(r.orders), 7) +
            pad(`${vnd.format(Math.round(r.commissionVnd))}đ`, 14) +
            pad(String(r.posts), 6) +
            pad(String(r.clicks), 8) +
            (r.epcVnd === null
              ? r.commissionPerPostVnd === null
                ? '—'
                : `${vnd.format(Math.round(r.commissionPerPostVnd))}đ/bài`
              : `${vnd.format(Math.round(r.epcVnd))}đ`),
        )
      }
      break
    }

    case 'shopee:ping': {
      if (!hasShopeeCredentials()) {
        console.log('Chưa cấu hình SHOPEE_APP_ID / SHOPEE_SECRET — vẫn đang chờ cấp quyền API.')
        console.log('Trong lúc chờ, dùng: npm run ingest -- --source=csv --file=<đường dẫn>')
        break
      }
      try {
        await graphql(PRODUCT_OFFER_QUERY, { keyword: '', limit: 1, page: 1, sortType: 2 })
        console.log('✓ Open API trả lời bình thường. Đã có quyền truy cập.')
      } catch (err) {
        if (err instanceof ShopeeApiError) {
          if (err.code === SHOPEE_ERROR.NO_ACCESS) {
            console.log('✗ 10035 — tài khoản chưa được cấp quyền Open API. Đơn xin vẫn đang chờ.')
          } else if (err.code === SHOPEE_ERROR.RATE_LIMIT) {
            console.log('✗ 10030 — vượt rate limit. Có quyền, chỉ cần gọi thưa hơn.')
          } else {
            console.log(`✗ ${err.message}`)
          }
        } else {
          console.log(`✗ ${String(err)}`)
        }
      }
      break
    }

    default:
      printHelp()
  }
}

function printRanking(rows: Array<Parameters<typeof compose>[0]>): void {
  console.log(pad('#', 4) + pad('EV/click', 11) + pad('HH', 10) + pad('Giá', 12) + 'Sản phẩm')
  rows.forEach((r, i) => {
    const xtra = r.xtraCommissionRate > 0 ? '★' : ' '
    console.log(
      pad(String(i + 1), 4) +
        pad(`${r.evPerClick.toFixed(1)}đ`, 11) +
        pad(`${xtra}${(r.effectiveRate * 100).toFixed(1)}%`, 10) +
        pad(`${vnd.format(r.priceVnd)}đ`, 12) +
        truncate(r.name, 46),
    )
  })
  console.log('\n★ = có Hoa hồng XTRA')
}

function pad(s: string, width: number): string {
  return s.length >= width ? `${s.slice(0, width - 1)} ` : s.padEnd(width)
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function channelFlag(): Channel {
  const v = flag('channel', 'tg')
  if (!isChannel(v)) throw new Error(`--channel không hợp lệ: ${v}`)
  return v
}

function postTypeFlag(): PostType {
  const v = flag('type', 'flash')
  if (!isPostType(v)) throw new Error(`--type không hợp lệ: ${v}`)
  return v
}

function variantFlag(): Variant {
  const v = flag('variant', 'a')
  if (!isVariant(v)) throw new Error(`--variant không hợp lệ: ${v}`)
  return v
}

function printHelp(): void {
  console.log(`TakaAff — deal engine cho Shopee Affiliate

  db:init                                        tạo/nâng cấp schema
  ingest  --source=csv|api [--file=] [--limit=]  thu thập offer vào DB
  rank    [--limit=20] [--json]                  chấm điểm và xếp hạng
  link    --item=<id> [--channel=] [--type=]     sinh link kèm subId
  publish [--dry-run] [--limit=3]                đăng lên Telegram
  sync    [--from=] [--to=]                      kéo conversionReport
  epc     [--by=channel|type|category|slot|variant|source] [--days=30]
  shopee:ping                                    kiểm tra trạng thái quyền API
`)
}

main().catch((err) => {
  console.error(`Lỗi: ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
})
