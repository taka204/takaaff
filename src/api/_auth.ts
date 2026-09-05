import { timingSafeEqual } from 'node:crypto'
import { config } from '../config.ts'

/**
 * Bảo vệ dashboard.
 *
 * Vercel Hobby không có deployment protection cho production, nên phải tự làm.
 * Dashboard hiển thị bảng xếp hạng, hoa hồng và EPC — dữ liệu kinh doanh, không
 * phải thứ để công khai.
 *
 * Token trống nghĩa là API bị KHOÁ hoàn toàn chứ không phải mở toang. Cấu hình
 * thiếu thì phải hỏng theo hướng an toàn.
 */
export function unauthorized(request: Request): Response | null {
  const expected = config.dashboardToken
  if (expected === '') {
    return json({ error: 'DASHBOARD_TOKEN chưa được cấu hình nên API đang khoá.' }, 503)
  }

  const url = new URL(request.url)
  const provided =
    request.headers.get('x-takaaff-token') ?? url.searchParams.get('token') ?? ''

  return safeEqual(provided, expected) ? null : json({ error: 'Token không đúng.' }, 401)
}

/** So sánh thời gian hằng định để chữ ký không bị dò từng ký tự. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function intParam(url: URL, name: string, fallback: number, max: number): number {
  const raw = url.searchParams.get(name)
  if (raw === null) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(1, Math.trunc(n)), max)
}
