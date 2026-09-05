import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { config } from '../config.ts'
import { applyDialectTokens } from './driver.ts'
import type { Driver } from './driver.ts'

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations')

let driver: Driver | null = null
let ready: Promise<Driver> | null = null

/**
 * Mở kết nối. KHÔNG chạy migration.
 *
 * Chọn driver theo `DATABASE_URL`: có thì Postgres (cloud), không thì SQLite
 * (máy cá nhân). Driver SQLite được import động để bundler của Vercel không
 * phải đụng tới `node:sqlite`.
 *
 * Migration tách khỏi kết nối vì hai lý do, cả hai chỉ lộ ra trên cloud:
 * bundler của Vercel không đóng gói file `.sql` (nó chỉ lần theo import JS/TS),
 * nên serverless mà tự migrate là ENOENT lúc chạy thật; và nhiều cold start gọi
 * cùng lúc sẽ đua nhau tạo bảng. Đường ghi schema chỉ có một, ở CLI — xem
 * `migrateSchema`.
 */
export function db(): Promise<Driver> {
  if (ready) return ready
  ready = open()
  return ready
}

/**
 * Nâng schema lên bản mới nhất. Gọi từ CLI và test, không gọi từ serverless.
 */
export async function migrateSchema(): Promise<Driver> {
  const target = await db()
  await migrate(target)
  return target
}

async function open(): Promise<Driver> {
  if (config.databaseUrl !== '') {
    const { PgDriver } = await import('./driver-pg.ts')
    driver = new PgDriver(config.databaseUrl)
  } else {
    const path = resolve(process.cwd(), config.dbPath)
    mkdirSync(dirname(path), { recursive: true })
    const { SqliteDriver } = await import('./driver-sqlite.ts')
    driver = new SqliteDriver(path)
  }

  return driver
}

/** Chỉ dùng trong test, để mỗi test chạy trên một DB riêng. */
export async function useDriver(instance: Driver): Promise<void> {
  driver = instance
  ready = Promise.resolve(instance)
  await migrate(instance)
}

export async function closeDatabase(): Promise<void> {
  await driver?.close()
  driver = null
  ready = null
}

async function migrate(target: Driver): Promise<void> {
  await target.exec(`
    CREATE TABLE IF NOT EXISTS _migration (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const rows = await target.all('SELECT name FROM _migration')
  const applied = new Set(rows.map((r) => String(r['name'])))

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    await target.exec(applyDialectTokens(raw, target.dialect))
    await target.run('INSERT INTO _migration (name, applied_at) VALUES (?, ?)', [
      file,
      new Date().toISOString(),
    ])
  }
}
