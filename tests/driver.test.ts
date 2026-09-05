import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { applyDialectTokens, toPgPlaceholders } from '../src/db/driver.ts'

const MIGRATIONS = join(process.cwd(), 'src/db/migrations')

describe('toPgPlaceholders', () => {
  test('đánh số tăng dần', () => {
    assert.equal(
      toPgPlaceholders('INSERT INTO t (a, b, c) VALUES (?, ?, ?)'),
      'INSERT INTO t (a, b, c) VALUES ($1, $2, $3)',
    )
  })

  test('KHÔNG đụng vào dấu hỏi nằm trong chuỗi literal', () => {
    // repo.ts có nhiều câu chứa '' và literal; dịch nhầm ở đây sẽ tạo ra SQL
    // hỏng chỉ trên Postgres, tức là bug chỉ lộ ra trên production.
    assert.equal(
      toPgPlaceholders("SELECT * FROM t WHERE note = 'sao?' AND id = ?"),
      "SELECT * FROM t WHERE note = 'sao?' AND id = $1",
    )
  })

  test('xử lý được nháy đơn thoát bên trong chuỗi', () => {
    assert.equal(
      toPgPlaceholders("SELECT 'a''b?' AS x WHERE id = ?"),
      "SELECT 'a''b?' AS x WHERE id = $1",
    )
  })

  test('câu không có placeholder thì giữ nguyên', () => {
    const sql = 'SELECT COUNT(*) FROM conversion'
    assert.equal(toPgPlaceholders(sql), sql)
  })

  test('COALESCE(ordered_at, \'\') giữ nguyên chuỗi rỗng', () => {
    assert.equal(
      toPgPlaceholders("WHERE COALESCE(ordered_at, '') >= ?"),
      "WHERE COALESCE(ordered_at, '') >= $1",
    )
  })
})

describe('applyDialectTokens', () => {
  test('SQLite dùng AUTOINCREMENT', () => {
    assert.equal(
      applyDialectTokens('id {{SERIAL_PK}},', 'sqlite'),
      'id INTEGER PRIMARY KEY AUTOINCREMENT,',
    )
  })

  test('Postgres dùng IDENTITY', () => {
    assert.equal(
      applyDialectTokens('id {{SERIAL_PK}},', 'postgres'),
      'id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,',
    )
  })

  test('thay tất cả, không chỉ chỗ đầu tiên', () => {
    const out = applyDialectTokens('a {{SERIAL_PK}} b {{SERIAL_PK}}', 'postgres')
    assert.equal(out.includes('{{SERIAL_PK}}'), false)
  })
})

describe('migration chạy được trên cả hai phương ngữ', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))

  test('có ít nhất một migration', () => {
    assert.ok(files.length > 0)
  })

  for (const file of files) {
    test(`${file} không còn token nào chưa thay`, () => {
      const raw = readFileSync(join(MIGRATIONS, file), 'utf8')
      for (const dialect of ['sqlite', 'postgres'] as const) {
        const out = applyDialectTokens(raw, dialect)
        assert.equal(
          /\{\{[A-Z_]+\}\}/.test(out),
          false,
          `${file} còn token chưa xử lý cho ${dialect}`,
        )
      }
    })

    test(`${file} không dùng cú pháp chỉ có ở SQLite`, () => {
      const raw = readFileSync(join(MIGRATIONS, file), 'utf8')
      // Những thứ này chạy trên SQLite nhưng gãy trên Postgres. Bắt ở test thay
      // vì đợi migration đổ vỡ giữa lúc deploy.
      assert.equal(/AUTOINCREMENT/i.test(raw), false, 'dùng {{SERIAL_PK}} thay vì AUTOINCREMENT')
      assert.equal(/\bPRAGMA\b/i.test(raw), false, 'PRAGMA thuộc về driver, không thuộc migration')
      assert.equal(/last_insert_rowid/i.test(raw), false, 'dùng RETURNING id thay thế')
    })
  }
})
