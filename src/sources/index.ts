import { ManualCsvSource } from './manual-csv.ts'
import { ShopeeOpenApiSource } from './shopee-api.ts'
import { ManualConversionCsvSource } from './conversion-csv.ts'
import { ShopeeConversionApiSource } from './conversion-api.ts'
import type { ConversionSource, OfferSource } from './types.ts'

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

export function createConversionSource(
  kind: SourceKind,
  filePath?: string,
  defaultSource: 'link' | 'video' = 'link',
): ConversionSource {
  if (kind === 'csv') {
    if (!filePath) {
      throw new Error('Nguồn csv cần --file=<đường dẫn>')
    }
    return new ManualConversionCsvSource(filePath, { defaultSource })
  }
  return new ShopeeConversionApiSource()
}

export { ManualCsvSource, ShopeeOpenApiSource, ManualConversionCsvSource, ShopeeConversionApiSource }
export type { OfferSource, ConversionSource } from './types.ts'
export type { Offer, FetchOptions, ConversionRecord, ConversionStatus } from './types.ts'
