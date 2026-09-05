import { ManualCsvSource } from './manual-csv.ts'
import { ShopeeOpenApiSource } from './shopee-api.ts'
import type { OfferSource } from './types.ts'

export type SourceKind = 'csv' | 'api'

export function createSource(kind: SourceKind, filePath?: string): OfferSource {
  if (kind === 'csv') {
    if (!filePath) {
      throw new Error('Nguồn csv cần --file=<đường dẫn>')
    }
    return new ManualCsvSource(filePath)
  }
  return new ShopeeOpenApiSource()
}

export { ManualCsvSource, ShopeeOpenApiSource }
export type { OfferSource } from './types.ts'
export type { Offer, FetchOptions } from './types.ts'
