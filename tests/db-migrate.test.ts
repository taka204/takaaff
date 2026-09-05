import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Phải đặt trước khi import config, vì config đọc env lúc nạp module.
const dir = mkdtempSync(join(tmpdir(), 'takaaff-'))
process.env['TAKAAFF_DB_PATH'] = join(dir, 'test.db')
process.env['DATABASE_URL'] = ''

const { db, migrateSchema, closeDatabase } = await import('../src/db/index.ts')

after(async () => {
  await closeDatabase()
  rmSync(dir, { recursive: true, force: true })
})

/**
 * Bảo vệ ranh giới kết nối / migration.
 *
 * Trước đây `db()` tự chạy migration, và điều đó chỉ hỏng trên Vercel: bundler
 * không đóng gói file `.sql` nên handler đọc `migrations/` là ENOENT lúc chạy
 * thật. Test dưới đây giữ ranh giới đó ở chỗ kiểm tra được, thay vì đợi một lần
 * deploy hỏng mới biết.
 */
describe('db() không tự migrate', () => {
  test('mở kết nối xong vẫn chưa có bảng nào', async () => {
    const driver = await db()
    const tables = await driver.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    assert.deepEqual(tables, [], 'db() đã tạo bảng — serverless sẽ cần file .sql')
  })

  test('migrateSchema() mới tạo schema, và gọi lại được nhiều lần', async () => {
    await migrateSchema()
    const driver = await db()

    const names = (
      await driver.all("SELECT name FROM sqlite_master WHERE type = 'table'")
    ).map((r) => String(r['name']))

    for (const expected of ['product', 'product_snapshot', 'score', 'link', 'post', 'conversion']) {
      assert.ok(names.includes(expected), `thiếu bảng ${expected}`)
    }

    // Chạy lại phải là no-op: Actions gọi CLI nhiều lần trên cùng một DB.
    await migrateSchema()
    const applied = await driver.all('SELECT name FROM _migration')
    const unique = new Set(applied.map((r) => String(r['name'])))
    assert.equal(applied.length, unique.size, 'migration bị ghi trùng')
  })
})
