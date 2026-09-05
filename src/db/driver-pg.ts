import pg from 'pg'
import { toPgPlaceholders } from './driver.ts'
import type { Driver, RunResult, SqlRow } from './driver.ts'

/**
 * Driver Postgres cho cloud.
 *
 * Dùng `pg` chứ không dùng driver riêng của Neon để không khoá vào một nhà cung
 * cấp — đổi sang Supabase hay bất kỳ Postgres nào khác chỉ là đổi chuỗi kết nối.
 *
 * Pool giữ tối đa 3 kết nối: Neon bậc miễn phí ngủ compute sau 5 phút và tự
 * thức khi có query, còn cron thì chạy ngắn rồi thoát, nên pool lớn chỉ tốn
 * thời gian bắt tay chứ không nhanh hơn.
 */
export class PgDriver implements Driver {
  readonly dialect = 'postgres' as const
  readonly #pool: pg.Pool

  constructor(connectionString: string) {
    this.#pool = new pg.Pool({
      connectionString,
      max: 3,
      // Neon và hầu hết Postgres hosted đều bắt buộc TLS.
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  }

  async all(sql: string, params: unknown[] = []): Promise<SqlRow[]> {
    const res = await this.#pool.query(toPgPlaceholders(sql), params)
    return res.rows as SqlRow[]
  }

  async get(sql: string, params: unknown[] = []): Promise<SqlRow | null> {
    const res = await this.#pool.query(toPgPlaceholders(sql), params)
    return (res.rows[0] as SqlRow | undefined) ?? null
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const res = await this.#pool.query(toPgPlaceholders(sql), params)
    return { changes: res.rowCount ?? 0 }
  }

  async exec(sql: string): Promise<void> {
    await this.#pool.query(sql)
  }

  async close(): Promise<void> {
    await this.#pool.end()
  }
}
