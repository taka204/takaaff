import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { closeDatabase, useDatabase } from '../src/db/index.ts'
import {
  findLinkById,
  linksMissingClicks,
  postsBy,
  setClicksBySubIds,
  setClicksByUrl,
  setLinkClicks,
  insertPost,
  upsertLink,
  upsertProduct,
} from '../src/db/repo.ts'
import { importClicks } from '../src/jobs/import-clicks.ts'
import type { SubIds } from '../src/subid.ts'

const SUBS_A: SubIds = { sub1: 'tg', sub2: 'flash', sub3: 'sac-dep', sub4: '260905-12', sub5: 'a' }
const SUBS_B: SubIds = { sub1: 'tg', sub2: 'flash', sub3: 'sac-dep', sub4: '260905-12', sub5: 'b' }

let tmp: string
let linkA = 0
let linkB = 0

before(() => {
  tmp = mkdtempSync(join(tmpdir(), 'takaaff-'))
  useDatabase(new DatabaseSync(':memory:'))

  const now = '2026-09-05T12:00:00.000Z'
  upsertProduct(
    { itemId: '1', shopId: '9', name: 'Serum mẫu', categoryPath: 'Sắc đẹp', url: 'https://x/1' },
    now,
  )
  linkA = upsertLink('1', 'https://shopee.vn/a', SUBS_A, now)
  linkB = upsertLink('1', 'https://shopee.vn/b', SUBS_B, now)
})

after(() => {
  closeDatabase()
  rmSync(tmp, { recursive: true, force: true })
})

describe('setLinkClicks', () => {
  test('ghi được số click và đọc lại đúng', () => {
    assert.equal(setLinkClicks(linkA, 250), true)
    assert.equal(findLinkById(linkA)?.clicks, 250)
  })

  test('id không tồn tại thì trả false thay vì ném lỗi', () => {
    assert.equal(setLinkClicks(999_999, 10), false)
  })

  test('số âm bị kẹp về 0', () => {
    setLinkClicks(linkB, -5)
    assert.equal(findLinkById(linkB)?.clicks, 0)
  })
})

describe('setClicksBySubIds', () => {
  test('khớp đúng tổ hợp 5 subId', () => {
    assert.equal(setClicksBySubIds(SUBS_A, 300), 1)
    assert.equal(findLinkById(linkA)?.clicks, 300)
  })

  test('chỉ khác sub5 thì không được ghi nhầm sang link khác', () => {
    setClicksBySubIds(SUBS_A, 111)
    setClicksBySubIds(SUBS_B, 222)
    assert.equal(findLinkById(linkA)?.clicks, 111)
    assert.equal(findLinkById(linkB)?.clicks, 222)
  })

  test('tổ hợp không tồn tại trả về 0 dòng thay đổi', () => {
    assert.equal(setClicksBySubIds({ ...SUBS_A, sub3: 'khong-co' }, 50), 0)
  })
})

describe('setClicksByUrl', () => {
  test('khớp theo URL', () => {
    assert.equal(setClicksByUrl('https://shopee.vn/a', 77), 1)
    assert.equal(findLinkById(linkA)?.clicks, 77)
  })
})

describe('linksMissingClicks', () => {
  test('chỉ liệt kê link chưa có click', () => {
    const link3 = upsertLink(
      '1',
      'https://shopee.vn/c',
      { ...SUBS_A, sub4: '260906-20' },
      '2026-09-06T20:00:00.000Z',
    )
    const pending = linksMissingClicks(50).map((l) => l.id)
    assert.ok(pending.includes(link3), 'link mới phải nằm trong danh sách chờ')
    assert.ok(!pending.includes(linkA), 'link đã có click thì không liệt kê')
  })
})

describe('postsBy — không đếm click hai lần', () => {
  test('một link đăng lại nhiều lần vẫn chỉ tính click một lần', () => {
    useDatabase(new DatabaseSync(':memory:'))
    const now = '2026-09-05T12:00:00.000Z'
    upsertProduct(
      { itemId: '2', shopId: '9', name: 'Sản phẩm', categoryPath: 'Nhà cửa', url: 'https://x/2' },
      now,
    )
    const id = upsertLink('2', 'https://shopee.vn/d', SUBS_A, now)
    setLinkClicks(id, 100)

    // Cùng một link, đăng hai lần.
    insertPost('tg', id, '2', 'a', now, 'm1')
    insertPost('tg', id, '2', 'a', now, 'm2')

    const buckets = postsBy('sub1', '2026-01-01T00:00:00.000Z')
    const tg = buckets.find((b) => b.bucket === 'tg')
    assert.ok(tg)
    assert.equal(tg.posts, 2, 'phải đếm đủ 2 bài')
    assert.equal(tg.clicks, 100, 'nhưng click chỉ được tính một lần')
  })
})

describe('importClicks', () => {
  test('nạp theo subId và báo cáo dòng không khớp', () => {
    useDatabase(new DatabaseSync(':memory:'))
    const now = '2026-09-05T12:00:00.000Z'
    upsertProduct(
      { itemId: '3', shopId: '9', name: 'Sản phẩm', categoryPath: 'Sắc đẹp', url: 'https://x/3' },
      now,
    )
    const id = upsertLink('3', 'https://shopee.vn/e', SUBS_A, now)

    const file = join(tmp, 'clicks.csv')
    writeFileSync(
      file,
      'sub_id1,sub_id2,sub_id3,sub_id4,sub_id5,Lượt click\n' +
        `${SUBS_A.sub1},${SUBS_A.sub2},${SUBS_A.sub3},${SUBS_A.sub4},${SUBS_A.sub5},1.240\n` +
        'tg,flash,khong-ton-tai,999999-99,a,50\n',
      'utf8',
    )

    const r = importClicks(file)
    assert.equal(r.matched, 1)
    assert.equal(r.unmatched, 1)
    assert.equal(r.totalClicks, 1240, 'phải bỏ dấu chấm phân cách nghìn')
    assert.equal(findLinkById(id)?.clicks, 1240)
    assert.equal(r.unmatchedSamples.length, 1)
  })

  test('thiếu cột click thì báo lỗi rõ ràng', () => {
    const file = join(tmp, 'bad.csv')
    writeFileSync(file, 'sub_id1,sub_id2\ntg,flash\n', 'utf8')
    assert.throws(() => importClicks(file), /thiếu cột số click/)
  })
})
