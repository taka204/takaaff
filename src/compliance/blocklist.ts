/**
 * Danh sách chặn áp dụng ngay ở tầng ingest — hàng thuộc nhóm này không bao giờ
 * vào DB, nên không có đường nào để nó lọt ra bài đăng.
 *
 * Lý do không phải là khẩu vị rủi ro mà là pháp lý: Luật Quảng cáo 75/2025/QH15
 * (hiệu lực 01/01/2026) quy định người chuyển tải sản phẩm quảng cáo chịu
 * TRÁCH NHIỆM LIÊN ĐỚI nếu sản phẩm không đúng như quảng cáo. Với thực phẩm
 * chức năng, thuốc và thiết bị y tế, rủi ro đó là thật và không đáng đổi lấy
 * vài phần trăm hoa hồng.
 */

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Thực phẩm chức năng và thuốc
  { pattern: /thực phẩm chức năng|tpcn/i, reason: 'thực phẩm chức năng' },
  { pattern: /thực phẩm bảo vệ sức khỏe|thuc pham bao ve suc khoe/i, reason: 'TPBVSK' },
  { pattern: /\bthuốc\b|\bthuoc\b(?!\s*l[áa])/i, reason: 'thuốc' },
  { pattern: /kê đơn|ke don|biệt dược/i, reason: 'thuốc kê đơn' },
  { pattern: /viên uống|vien uong|viên sủi|thực phẩm bổ sung/i, reason: 'viên uống/bổ sung' },

  // Thiết bị y tế
  { pattern: /thiết bị y tế|thiet bi y te/i, reason: 'thiết bị y tế' },
  { pattern: /máy đo huyết áp|máy đo đường huyết|máy trợ thính|nhiệt kế y tế/i, reason: 'thiết bị y tế' },
  { pattern: /kim tiêm|ống nghe y tế|máy xông khí dung/i, reason: 'thiết bị y tế' },

  // Mỹ phẩm hứa hẹn trị liệu — phần rủi ro nhất của ngành làm đẹp
  { pattern: /đặc trị|dac tri/i, reason: 'tuyên bố trị liệu' },
  { pattern: /\btrị (mụn|nám|sẹo|hói|rụng tóc|viêm)/i, reason: 'tuyên bố trị liệu' },
  { pattern: /chữa (khỏi|bệnh)|điều trị bệnh/i, reason: 'tuyên bố trị liệu' },
  { pattern: /giảm cân cấp tốc|giảm \d+\s*kg|tăng cân cấp tốc/i, reason: 'tuyên bố hiệu quả' },
  { pattern: /kích thích mọc tóc|trắng da cấp tốc|tan mỡ/i, reason: 'tuyên bố hiệu quả' },
]

export type BlockCheck = { blocked: false } | { blocked: true; reason: string }

/**
 * Kiểm tra tên sản phẩm và đường dẫn ngành hàng. Kiểm tra cả hai vì hàng bị cấm
 * hay được đặt tên né tránh nhưng vẫn nằm đúng ngành hàng, và ngược lại.
 */
export function checkBlocked(name: string, categoryPath = ''): BlockCheck {
  const haystack = `${name} ${categoryPath}`
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(haystack)) {
      return { blocked: true, reason }
    }
  }
  return { blocked: false }
}
