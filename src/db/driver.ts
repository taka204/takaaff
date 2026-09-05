/**
 * Lớp driver mỏng cho hai phương ngữ SQL.
 *
 * SQLite chạy trên máy cá nhân (nhanh, offline, test không cần mạng), Postgres
 * chạy trên cloud (GitHub Actions và Vercel không có filesystem bền). `repo.ts`
 * giữ nguyên MỘT bản SQL viết trong tập giao của hai phương ngữ, driver lo phần
 * còn lại.
 *
 * Khảo sát trước khi làm cho thấy chỉ có 4 điểm lệch trên 22 câu SQL, nên cái
 * giá của việc giữ cả hai là nhỏ — còn cái được là vòng lặp phát triển hằng
 * ngày không phụ thuộc vào mạng và một Postgres đang sống.
 */

export type SqlRow = Record<string, unknown>

export type RunResult = {
  /** Số dòng bị ảnh hưởng. SQLite trả `changes`, Postgres trả `rowCount`. */
  changes: number
}

export interface Driver {
  readonly dialect: 'sqlite' | 'postgres'
  all(sql: string, params?: unknown[]): Promise<SqlRow[]>
  get(sql: string, params?: unknown[]): Promise<SqlRow | null>
  run(sql: string, params?: unknown[]): Promise<RunResult>
  /** Chạy một khối SQL nhiều câu lệnh — dùng cho migration. */
  exec(sql: string): Promise<void>
  close(): Promise<void>
}

/**
 * Đổi placeholder `?` sang `$1..$n` cho Postgres.
 *
 * Bỏ qua dấu `?` nằm trong chuỗi nháy đơn để không phá câu lệnh có literal chứa
 * dấu hỏi. Không xử lý nháy kép vì Postgres dùng nó cho định danh, và trong
 * repo.ts không có định danh nào chứa `?`.
 */
export function toPgPlaceholders(sql: string): string {
  let out = ''
  let index = 0
  let inString = false

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i] as string

    if (ch === "'") {
      // Hai nháy đơn liền nhau là ký tự nháy đơn thoát, không phải kết thúc chuỗi.
      if (inString && sql[i + 1] === "'") {
        out += "''"
        i += 1
        continue
      }
      inString = !inString
      out += ch
      continue
    }

    if (ch === '?' && !inString) {
      index += 1
      out += `$${index}`
      continue
    }

    out += ch
  }

  return out
}

/**
 * Thay token phương ngữ trong migration.
 *
 * Chỉ có một token: khoá chính tự tăng. Giữ schema ở MỘT bản thay vì hai thư
 * mục migration song song — hai bản sẽ trôi lệch nhau, và lệch schema là loại
 * bug chỉ lộ ra trên production.
 */
export function applyDialectTokens(sql: string, dialect: 'sqlite' | 'postgres'): string {
  const serialPk =
    dialect === 'sqlite'
      ? 'INTEGER PRIMARY KEY AUTOINCREMENT'
      : 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY'
  return sql.replaceAll('{{SERIAL_PK}}', serialPk)
}
