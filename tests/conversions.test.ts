import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { ManualConversionCsvSource, detectSource } from '../src/sources/conversion-csv.ts'
import { normalizeStatus, parseFlexibleDate } from '../src/sources/types.ts'

const FIXTURE = 'data/fixtures/conversions-sample.csv'
const WIDE = { from: new Date('2020-01-01'), to: new Date('2030-01-01') }

describe('normalizeStatus', () => {
  test('nhận trạng thái tiếng Việt từ dashboard', () => {
    assert.equal(normalizeStatus('Hoàn thành'), 'completed')
    assert.equal(normalizeStatus('Đã hủy'), 'cancelled')
    assert.equal(normalizeStatus('Chờ xác nhận'), 'pending')
  })

  test('phân biệt "Hoàn thành" với "Hoàn trả"', () => {
    // Hai chuỗi này chỉ khác một từ nhưng ngược nhau hoàn toàn về nghĩa tiền bạc.
    assert.equal(normalizeStatus('Hoàn thành'), 'completed')
    assert.equal(normalizeStatus('Hoàn trả'), 'cancelled')
  })

  test('nhận trạng thái tiếng Anh từ API', () => {
    assert.equal(normalizeStatus('completed'), 'completed')
    assert.equal(normalizeStatus('cancelled'), 'cancelled')
    assert.equal(normalizeStatus('refunded'), 'cancelled')
  })

  test('giá trị lạ hoặc rỗng được coi là pending, không phải completed', () => {
    // Chưa biết thì không tính là tiền.
    assert.equal(normalizeStatus('trạng thái nào đó'), 'pending')
    assert.equal(normalizeStatus(''), 'pending')
  })
})

describe('parseFlexibleDate', () => {
  test('đọc ISO', () => {
    assert.equal(parseFlexibleDate('2026-09-05T12:00:00.000Z'), '2026-09-05T12:00:00.000Z')
  })

  test('đọc "yyyy-mm-dd hh:mm:ss"', () => {
    const iso = parseFlexibleDate('2026-09-05 12:30:00')
    assert.ok(iso !== null)
    assert.equal(new Date(iso).getFullYear(), 2026)
  })

  test('đọc dd/mm/yyyy theo quy ước Việt Nam', () => {
    const iso = parseFlexibleDate('02/09/2026')
    assert.ok(iso !== null)
    const d = new Date(iso)
    assert.equal(d.getDate(), 2)
    assert.equal(d.getMonth(), 8) // tháng 9 — không phải ngày 9 tháng 2
  })

  test('đọc unix giây', () => {
    assert.equal(parseFlexibleDate('1757068800'), new Date(1_757_068_800_000).toISOString())
  })

  test('rỗng hoặc rác trả null', () => {
    assert.equal(parseFlexibleDate(''), null)
    assert.equal(parseFlexibleDate('không phải ngày'), null)
  })
})

describe('detectSource', () => {
  test('nhận đơn từ Shopee Video', () => {
    assert.equal(detectSource('Shopee Video', 'link'), 'video')
    assert.equal(detectSource('livestream', 'link'), 'video')
  })

  test('nhận đơn từ link sản phẩm', () => {
    assert.equal(detectSource('Product Link', 'video'), 'link')
  })

  test('cột trống thì dùng giá trị mặc định', () => {
    assert.equal(detectSource('', 'video'), 'video')
    assert.equal(detectSource('', 'link'), 'link')
  })
})

describe('ManualConversionCsvSource', () => {
  test('đọc được header tiếng Việt có dấu', async () => {
    const rows = await new ManualConversionCsvSource(FIXTURE).fetchConversions(WIDE)
    assert.equal(rows.length, 10)

    const first = rows[0]
    assert.ok(first)
    assert.equal(first.orderId, 'ORD00001')
    assert.equal(first.itemId, '100001')
    assert.equal(first.status, 'completed')
  })

  test('bỏ dấu chấm phân cách nghìn kiểu Việt Nam', async () => {
    const rows = await new ManualConversionCsvSource(FIXTURE).fetchConversions(WIDE)
    const first = rows.find((r) => r.orderId === 'ORD00001')
    assert.ok(first)
    assert.equal(first.orderValueVnd, 189_000)
    assert.equal(first.commissionVnd, 34_020)
  })

  test('tách đúng đơn video và đơn link', async () => {
    const rows = await new ManualConversionCsvSource(FIXTURE).fetchConversions(WIDE)
    const video = rows.filter((r) => r.source === 'video')
    assert.equal(video.length, 2)
    // Đơn video đi qua giỏ hàng in-app nên không mang subId — đúng như thiết kế.
    assert.equal(video[0]?.subIds.sub1, '')
  })

  test('đọc subId của đơn từ link', async () => {
    const rows = await new ManualConversionCsvSource(FIXTURE).fetchConversions(WIDE)
    const r = rows.find((x) => x.orderId === 'ORD00002')
    assert.ok(r)
    assert.deepEqual(r.subIds, {
      sub1: 'tg',
      sub2: 'flash',
      sub3: 'sac-dep',
      sub4: '260901-20',
      sub5: 'b',
    })
  })

  test('đánh dấu đơn huỷ và đơn hoàn trả là cancelled', async () => {
    const rows = await new ManualConversionCsvSource(FIXTURE).fetchConversions(WIDE)
    const cancelled = rows.filter((r) => r.status === 'cancelled').map((r) => r.orderId)
    assert.deepEqual(cancelled.sort(), ['ORD00004', 'ORD00009'])
  })

  test('lọc theo khoảng thời gian', async () => {
    const rows = await new ManualConversionCsvSource(FIXTURE).fetchConversions({
      from: new Date('2026-09-04T00:00:00Z'),
      to: new Date('2026-09-06T00:00:00Z'),
    })
    assert.ok(rows.length < 10, 'phải lọc bớt')
    assert.ok(rows.every((r) => r.orderedAt !== null && r.orderedAt >= '2026-09-04'))
  })

  test('đọc được ngày dạng dd/mm/yyyy lẫn trong file', async () => {
    const rows = await new ManualConversionCsvSource(FIXTURE).fetchConversions(WIDE)
    const r = rows.find((x) => x.orderId === 'ORD00003')
    assert.ok(r)
    assert.ok(r.orderedAt !== null)
    assert.equal(new Date(r.orderedAt).getMonth(), 8)
  })

  test('--default-source đổi cách hiểu cột nguồn trống', async () => {
    const asVideo = new ManualConversionCsvSource(FIXTURE, { defaultSource: 'video' })
    const rows = await asVideo.fetchConversions(WIDE)
    // Fixture có cột "Loại chiến dịch" điền đủ nên mặc định không được lấn át.
    assert.equal(rows.filter((r) => r.source === 'video').length, 2)
  })
})
