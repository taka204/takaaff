import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { slug, postSlot, makeSubIds, toArray, appendSubIds } from '../src/subid.ts'

describe('slug', () => {
  test('bỏ dấu tiếng Việt', () => {
    assert.equal(slug('Sắc đẹp'), 'sac-dep')
    assert.equal(slug('Mẹ và bé'), 'me-va-be')
    assert.equal(slug('Đồ gia dụng'), 'do-gia-dung')
  })

  test('giới hạn độ dài và không để lại gạch thừa ở cuối', () => {
    const out = slug('Thiết bị điện tử và phụ kiện công nghệ cao cấp')
    assert.ok(out.length <= 20)
    assert.ok(!out.endsWith('-'))
  })

  test('chuỗi rỗng cho giá trị dự phòng', () => {
    assert.equal(slug(''), 'khac')
    assert.equal(slug('!!!'), 'khac')
  })
})

describe('postSlot', () => {
  test('định dạng yymmdd-hh', () => {
    const d = new Date(2026, 8, 15, 20, 30, 0)
    assert.equal(postSlot(d), '260915-20')
  })

  test('đệm 0 cho tháng, ngày và giờ một chữ số', () => {
    const d = new Date(2026, 0, 5, 9, 0, 0)
    assert.equal(postSlot(d), '260105-09')
  })
})

describe('makeSubIds', () => {
  test('sinh đủ 5 tham số đúng thứ tự lược đồ', () => {
    const s = makeSubIds({
      channel: 'tg',
      postType: 'flash',
      category: 'Sắc đẹp',
      at: new Date(2026, 8, 15, 20, 0, 0),
      variant: 'a',
    })
    assert.deepEqual(toArray(s), ['tg', 'flash', 'sac-dep', '260915-20', 'a'])
  })
})

describe('appendSubIds', () => {
  test('gắn sub_id1..5 vào URL', () => {
    const s = makeSubIds({
      channel: 'tg',
      postType: 'flash',
      category: 'nha-cua',
      at: new Date(2026, 8, 15, 20, 0, 0),
      variant: 'b',
    })
    const url = appendSubIds('https://shopee.vn/product/9/1', s)
    const parsed = new URL(url)
    assert.equal(parsed.searchParams.get('sub_id1'), 'tg')
    assert.equal(parsed.searchParams.get('sub_id2'), 'flash')
    assert.equal(parsed.searchParams.get('sub_id3'), 'nha-cua')
    assert.equal(parsed.searchParams.get('sub_id4'), '260915-20')
    assert.equal(parsed.searchParams.get('sub_id5'), 'b')
  })

  test('giữ nguyên query có sẵn', () => {
    const s = makeSubIds({
      channel: 'fb',
      postType: 'review',
      category: 'x',
      at: new Date(2026, 8, 15, 12, 0, 0),
      variant: 'a',
    })
    const url = appendSubIds('https://shopee.vn/product/9/1?utm_source=abc', s)
    assert.equal(new URL(url).searchParams.get('utm_source'), 'abc')
  })
})
