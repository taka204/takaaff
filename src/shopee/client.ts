import { createHash } from 'node:crypto'
import { config } from '../config.ts'

/**
 * Transport GraphQL có ký cho Shopee Affiliate Open API.
 *
 *   Signature = SHA256(AppId + Timestamp + Payload + Secret)
 *   Header:     Authorization: SHA256 Credential=<AppId>, Timestamp=<unix giây>, Signature=<hex>
 *   Endpoint:   https://open-api.affiliate.shopee.vn/graphql   (luôn POST, kể cả query)
 *
 * `Payload` phải là ĐÚNG chuỗi JSON được gửi đi. Ký lại từ object rồi serialize
 * lần nữa sẽ cho chuỗi khác (thứ tự khoá, khoảng trắng) và dính `Invalid
 * Signature` — đây là lỗi phổ biến nhất khi tích hợp API này.
 */

export const SHOPEE_ERROR = {
  RATE_LIMIT: 10030,
  NO_ACCESS: 10035,
} as const

export class ShopeeApiError extends Error {
  readonly code: number
  constructor(code: number, message: string) {
    super(`Shopee API ${code}: ${message}`)
    this.name = 'ShopeeApiError'
    this.code = code
  }
}

export function sign(appId: string, timestamp: number, payload: string, secret: string): string {
  return createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`).digest('hex')
}

export type GraphQLResponse<T> = {
  data?: T
  errors?: Array<{ message: string; extensions?: { code?: number } }>
}

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const { appId, secret, endpoint } = config.shopee
  if (appId === '' || secret === '') {
    throw new Error(
      'Thiếu SHOPEE_APP_ID / SHOPEE_SECRET. Chưa được cấp quyền Open API thì dùng --source=csv.',
    )
  }

  // Serialize MỘT LẦN rồi dùng đúng chuỗi đó cho cả chữ ký lẫn body.
  const payload = JSON.stringify({ query, variables })
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = sign(appId, timestamp, payload, secret)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  })

  if (!res.ok) {
    throw new ShopeeApiError(res.status, `HTTP ${res.status} ${res.statusText}`)
  }

  const json = (await res.json()) as GraphQLResponse<T>

  if (json.errors && json.errors.length > 0) {
    const first = json.errors[0]
    throw new ShopeeApiError(first?.extensions?.code ?? -1, first?.message ?? 'unknown error')
  }
  if (!json.data) {
    throw new ShopeeApiError(-1, 'Phản hồi không có trường data')
  }
  return json.data
}
