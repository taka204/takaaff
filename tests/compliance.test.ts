import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { checkBlocked } from '../src/compliance/blocklist.ts'
import { withDisclosure, hasDisclosure, AFFILIATE_DISCLOSURE, AI_LABEL_DEFAULT_ON } from '../src/compliance/disclosure.ts'

describe('blocklist', () => {
  test('chặn thực phẩm chức năng', () => {
    const r = checkBlocked('Viên uống collagen', 'Sắc đẹp/Thực phẩm chức năng')
    assert.equal(r.blocked, true)
  })

  test('chặn thiết bị y tế', () => {
    const r = checkBlocked('Máy đo huyết áp bắp tay tự động', 'Sức khỏe/Thiết bị y tế')
    assert.equal(r.blocked, true)
  })

  test('chặn mỹ phẩm có tuyên bố trị liệu', () => {
    const r = checkBlocked('Kem đặc trị nám tàn nhang', 'Sắc đẹp/Chăm sóc da')
    assert.equal(r.blocked, true)
  })

  test('chặn được cả khi tên né tránh nhưng ngành hàng lộ ra', () => {
    const r = checkBlocked('Combo chăm sóc sức khỏe mỗi ngày', 'Sức khỏe/Thực phẩm chức năng')
    assert.equal(r.blocked, true)
  })

  test('không chặn nhầm hàng thường', () => {
    for (const [name, cat] of [
      ['Serum dưỡng ẩm HA cấp nước 30ml', 'Sắc đẹp/Chăm sóc da mặt'],
      ['Nồi chiên không dầu 5L', 'Nhà cửa/Thiết bị gia dụng'],
      ['Áo thun cotton form rộng', 'Thời trang nữ/Áo'],
      ['Bỉm tã dán size M', 'Mẹ và bé/Tã bỉm'],
    ] as const) {
      assert.equal(checkBlocked(name, cat).blocked, false, `không nên chặn: ${name}`)
    }
  })
})

describe('disclosure', () => {
  test('chèn câu công bố vào cuối bài', () => {
    const out = withDisclosure('Nội dung bài')
    assert.ok(out.endsWith(AFFILIATE_DISCLOSURE))
    assert.ok(hasDisclosure(out))
  })

  test('không chèn lặp khi gọi nhiều lần', () => {
    const once = withDisclosure('Nội dung bài')
    const twice = withDisclosure(once)
    assert.equal(once, twice)
    const occurrences = twice.split(AFFILIATE_DISCLOSURE).length - 1
    assert.equal(occurrences, 1)
  })

  test('nhãn AI mặc định BẬT', () => {
    // Đảo mặc định này biến một nghĩa vụ pháp lý thành thứ phụ thuộc trí nhớ.
    assert.equal(AI_LABEL_DEFAULT_ON, true)
  })
})
