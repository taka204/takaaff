import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { parseCsv, ManualCsvSource } from '../src/sources/manual-csv.ts'
import { normalizeRate } from '../src/sources/types.ts'
import { sign } from '../src/shopee/client.ts'
import { parseSubIds } from '../src/jobs/sync-conversions.ts'

describe('parseCsv', () => {
  test('đọc ô có dấu ngoặc kép và dấu phẩy bên trong', () => {
    const rows = parseCsv('a,b\n"x,1",y')
    assert.deepEqual(rows, [
      ['a', 'b'],
      ['x,1', 'y'],
    ])
  })

  test('đọc ngoặc kép lồng', () => {
    const rows = parseCsv('a\n"nói ""thế"" đấy"')
    assert.equal(rows[1]?.[0], 'nói "thế" đấy')
  })

  test('chịu được xuống dòng CRLF', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n')
    assert.deepEqual(rows, [
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('normalizeRate', () => {
  test('chuỗi phần trăm', () => {
    assert.equal(normalizeRate('18%'), 0.18)
    assert.equal(normalizeRate('3.68%'), 0.0368)
  })

  test('số lớn hơn 1 được hiểu là phần trăm', () => {
    assert.equal(normalizeRate(12), 0.12)
    assert.equal(normalizeRate('12'), 0.12)
  })

  test('phân số giữ nguyên', () => {
    assert.equal(normalizeRate(0.15), 0.15)
  })

  test('giá trị rỗng hoặc rác trả 0', () => {
    assert.equal(normalizeRate(''), 0)
    assert.equal(normalizeRate('n/a'), 0)
    assert.equal(normalizeRate(-5), 0)
  })
})

describe('ManualCsvSource', () => {
  test('đọc được file fixture và chuẩn hoá đúng', async () => {
    const source = new ManualCsvSource('data/fixtures/offers-sample.csv')
    const offers = await source.fetchOffers({ limit: 100 })

    assert.ok(offers.length >= 15, `mong đợi >= 15 dòng, nhận ${offers.length}`)

    const serum = offers.find((o) => o.itemId === '100001')
    assert.ok(serum, 'không tìm thấy sản phẩm 100001')
    assert.equal(serum.priceVnd, 189_000)
    assert.equal(serum.originalPriceVnd, 320_000)
    assert.equal(serum.baseCommissionRate, 0.025)
    assert.equal(serum.xtraCommissionRate, 0.18)
    assert.equal(serum.rating, 4.8)
    assert.equal(serum.inStock, true)
  })

  test('lọc theo từ khoá', async () => {
    const source = new ManualCsvSource('data/fixtures/offers-sample.csv')
    const offers = await source.fetchOffers({ limit: 100, keyword: 'serum' })
    assert.equal(offers.length, 1)
  })

  test('tôn trọng giới hạn limit', async () => {
    const source = new ManualCsvSource('data/fixtures/offers-sample.csv')
    const offers = await source.fetchOffers({ limit: 3 })
    assert.equal(offers.length, 3)
  })
})

describe('sign', () => {
  test('nối chuỗi đúng thứ tự AppId + Timestamp + Payload + Secret', () => {
    const expected = createHash('sha256').update('app1' + '1700000000' + '{"q":1}' + 'sec').digest('hex')
    assert.equal(sign('app1', 1_700_000_000, '{"q":1}', 'sec'), expected)
  })

  test('tất định', () => {
    const a = sign('app', 1, '{}', 's')
    const b = sign('app', 1, '{}', 's')
    assert.equal(a, b)
  })

  test('đổi bất kỳ thành phần nào cũng đổi chữ ký', () => {
    const base = sign('app', 1, '{}', 's')
    assert.notEqual(sign('app2', 1, '{}', 's'), base)
    assert.notEqual(sign('app', 2, '{}', 's'), base)
    assert.notEqual(sign('app', 1, '{ }', 's'), base)
    assert.notEqual(sign('app', 1, '{}', 's2'), base)
  })
})

describe('parseSubIds', () => {
  test('đọc dạng JSON mảng', () => {
    const r = parseSubIds('["tg","flash","sac-dep","260915-20","a"]')
    assert.equal(r.sub1, 'tg')
    assert.equal(r.sub5, 'a')
  })

  test('đọc dạng chuỗi ngăn cách', () => {
    const r = parseSubIds('tg|flash|sac-dep|260915-20|a')
    assert.equal(r.sub3, 'sac-dep')
  })

  test('rỗng hoặc hỏng thì trả về các chuỗi trống, không ném lỗi', () => {
    assert.equal(parseSubIds(undefined).sub1, '')
    assert.equal(parseSubIds('[hỏng').sub1, '')
  })
})
