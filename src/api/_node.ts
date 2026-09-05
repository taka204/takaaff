import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Chuyển handler chuẩn Web sang chữ ký Node mà Vercel gọi.
 *
 * Vercel chạy hàm serverless theo kiểu `(req, res)` của `node:http`, nơi
 * `req.url` chỉ là đường dẫn (`/api/rank?limit=3`) chứ không phải URL tuyệt đối.
 * Viết thẳng logic theo kiểu đó thì `new URL(req.url)` ném lỗi, và đó đúng là
 * cách bản deploy đầu tiên hỏng.
 *
 * Lớp bọc này giữ phần lõi ở `Request`/`Response` — dạng chạy được ở mọi nơi và
 * test được bằng một dòng, không cần dựng server giả.
 */
export type WebHandler = (request: Request) => Promise<Response>

export function toNodeHandler(handle: WebHandler) {
  return async function nodeHandler(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    // Sau proxy của Vercel, host thật nằm ở x-forwarded-host. Giá trị dự phòng
    // chỉ để `new URL` có gốc hợp lệ — không đường dẫn nào phụ thuộc vào host.
    const proto = header(req, 'x-forwarded-proto') ?? 'https'
    const host = header(req, 'x-forwarded-host') ?? header(req, 'host') ?? 'localhost'
    const url = new URL(req.url ?? '/', `${proto}://${host}`)

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value)
      else if (Array.isArray(value)) headers.set(key, value.join(', '))
    }

    // API chỉ đọc nên không cần chuyển tiếp body.
    const response = await handle(new Request(url, { method: req.method ?? 'GET', headers }))

    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  }
}

function header(req: IncomingMessage, name: string): string | null {
  const v = req.headers[name]
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v[0] ?? null
  return null
}
