import { intParam, json, unauthorized } from './_auth.ts'
import { DIMENSIONS, epcReport } from '../src/report/epc.ts'
import type { Dimension } from '../src/report/epc.ts'
import { countUndatedConversions } from '../src/db/repo.ts'

export default async function handler(request: Request): Promise<Response> {
  const denied = unauthorized(request)
  if (denied) return denied

  const url = new URL(request.url)
  const by = url.searchParams.get('by') ?? 'channel'
  if (!(by in DIMENSIONS)) {
    return json({ error: `by phải là một trong: ${Object.keys(DIMENSIONS).join(', ')}` }, 400)
  }

  const days = intParam(url, 'days', 30, 3650)
  const rows = await epcReport(by as Dimension, days)

  return json({
    dimension: by,
    label: DIMENSIONS[by as Dimension].label,
    days,
    // Đơn không có mốc thời gian không nằm trong bất kỳ cửa sổ nào — báo ra
    // thay vì âm thầm giấu doanh thu.
    undatedConversions: await countUndatedConversions(),
    rows,
  })
}
