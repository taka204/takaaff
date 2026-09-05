import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_FILE = resolve(process.cwd(), '.env')
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE)
}

function num(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} phải là số, nhận được: ${JSON.stringify(raw)}`)
  }
  return parsed
}

function str(key: string, fallback = ''): string {
  const raw = process.env[key]
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim()
}

export type Config = {
  /** Có giá trị thì dùng Postgres (cloud); để trống thì dùng SQLite (máy cá nhân). */
  databaseUrl: string
  dbPath: string
  /**
   * Trần hoa hồng mỗi đơn. Một trong bốn tham số chưa xác minh — các nguồn công
   * khai ghi 30.000 / 50.000 / 70.000. Không bao giờ hardcode giá trị này ở nơi
   * khác: công thức chấm điểm phụ thuộc trực tiếp vào nó.
   */
  perOrderCapVnd: number
  minPriceVnd: number
  maxPriceVnd: number
  shopee: {
    appId: string
    secret: string
    endpoint: string
  }
  telegram: {
    botToken: string
    chatId: string
  }
  /** Token bảo vệ dashboard. Trống nghĩa là API dashboard bị khoá hoàn toàn. */
  dashboardToken: string
}

export const config: Config = {
  databaseUrl: str('DATABASE_URL'),
  dbPath: str('TAKAAFF_DB_PATH', 'data/takaaff.db'),
  perOrderCapVnd: num('TAKAAFF_PER_ORDER_CAP_VND', 30_000),
  minPriceVnd: num('TAKAAFF_MIN_PRICE_VND', 50_000),
  maxPriceVnd: num('TAKAAFF_MAX_PRICE_VND', 1_000_000),
  shopee: {
    appId: str('SHOPEE_APP_ID'),
    secret: str('SHOPEE_SECRET'),
    endpoint: str('SHOPEE_API_ENDPOINT', 'https://open-api.affiliate.shopee.vn/graphql'),
  },
  telegram: {
    botToken: str('TELEGRAM_BOT_TOKEN'),
    chatId: str('TELEGRAM_CHAT_ID'),
  },
  dashboardToken: str('DASHBOARD_TOKEN'),
}

export function hasShopeeCredentials(): boolean {
  return config.shopee.appId !== '' && config.shopee.secret !== ''
}

export function hasTelegramCredentials(): boolean {
  return config.telegram.botToken !== '' && config.telegram.chatId !== ''
}
