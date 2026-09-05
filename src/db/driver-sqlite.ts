import { DatabaseSync } from 'node:sqlite'
import type { Driver, RunResult, SqlRow } from './driver.ts'

/**
 * Driver SQLite cho máy cá nhân và test.
 *
 * `node:sqlite` là API đồng bộ; các hàm ở đây bọc thành Promise để `repo.ts`
 * chỉ cần biết một giao diện duy nhất. Không có chi phí thật vì SQLite trong
 * tiến trình vốn đã đồng bộ — chỉ là để hai driver dùng chung chữ ký hàm.
 *
 * File này được import ĐỘNG từ index.ts để bundler của Vercel không phải đụng
 * tới `node:sqlite`, thứ không tồn tại trong môi trường serverless của họ.
 */
export class SqliteDriver implements Driver {
  readonly dialect = 'sqlite' as const
  readonly #db: DatabaseSync

  constructor(pathOrInstance: string | DatabaseSync) {
    this.#db =
      typeof pathOrInstance === 'string' ? new DatabaseSync(pathOrInstance) : pathOrInstance

    // WAL không áp dụng được cho DB in-memory dùng trong test.
    try {
      this.#db.exec('PRAGMA journal_mode = WAL')
    } catch {
      // bỏ qua — in-memory
    }
    this.#db.exec('PRAGMA foreign_keys = ON')
  }

  async all(sql: string, params: unknown[] = []): Promise<SqlRow[]> {
    return this.#db.prepare(sql).all(...(params as never[])) as SqlRow[]
  }

  async get(sql: string, params: unknown[] = []): Promise<SqlRow | null> {
    const row = this.#db.prepare(sql).get(...(params as never[]))
    return (row as SqlRow | undefined) ?? null
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const info = this.#db.prepare(sql).run(...(params as never[]))
    return { changes: Number(info.changes) }
  }

  async exec(sql: string): Promise<void> {
    this.#db.exec(sql)
  }

  async close(): Promise<void> {
    this.#db.close()
  }
}
