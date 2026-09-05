import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { config } from '../config.ts'

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations')

let handle: DatabaseSync | null = null

/**
 * Mở DB và chạy migration còn thiếu. Gọi bao nhiêu lần cũng được, chỉ mở một lần.
 */
export function db(): DatabaseSync {
  if (handle) return handle

  const path = resolve(process.cwd(), config.dbPath)
  mkdirSync(dirname(path), { recursive: true })

  handle = new DatabaseSync(path)
  handle.exec('PRAGMA journal_mode = WAL')
  handle.exec('PRAGMA foreign_keys = ON')
  migrate(handle)
  return handle
}

/** Chỉ dùng trong test, để mỗi test chạy trên một DB in-memory riêng. */
export function useDatabase(instance: DatabaseSync): void {
  handle = instance
  instance.exec('PRAGMA foreign_keys = ON')
  migrate(instance)
}

export function closeDatabase(): void {
  handle?.close()
  handle = null
}

function migrate(target: DatabaseSync): void {
  target.exec(`
    CREATE TABLE IF NOT EXISTS _migration (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const applied = new Set(
    target.prepare('SELECT name FROM _migration').all().map((r) => String(r['name'])),
  )

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    target.exec(sql)
    target
      .prepare('INSERT INTO _migration (name, applied_at) VALUES (?, ?)')
      .run(file, new Date().toISOString())
  }
}
