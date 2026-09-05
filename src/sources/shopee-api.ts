import { graphql } from '../shopee/client.ts'
import { PRODUCT_OFFER_QUERY } from '../shopee/queries.ts'
import type { FetchOptions, Offer, OfferSource } from './types.ts'
import { normalizeRate } from './types.ts'

type ProductOfferNode = {
  itemId?: string | number
  shopId?: string | number
  productName?: string
  productLink?: string
  offerLink?: string
  priceMin?: string | number
  priceMax?: string | number
  priceDiscountRate?: string | number
  commissionRate?: string | number
  sales?: string | number
  ratingStar?: string | number
  productCatIds?: Array<string | number>
}

type ProductOfferResponse = {
  productOfferV2: {
    nodes: ProductOfferNode[]
    pageInfo?: { hasNextPage?: boolean }
  }
}

/**
 * Nguồn dữ liệu qua Shopee Affiliate Open API.
 *
 * LƯU Ý VỀ HOA HỒNG XTRA: `productOfferV2` trả về `commissionRate` gộp, tài liệu
 * công khai không tách rõ phần cơ bản và phần XTRA. Ở đây toàn bộ được ghi vào
 * `baseCommissionRate` và `xtraCommissionRate` để 0 — cách này khiến engine
 * đánh giá thấp hàng XTRA (mất hệ số thưởng 1.15) chứ không đánh giá cao nhầm,
 * tức là sai theo hướng an toàn. Khi có quyền API thật, đối chiếu lại phản hồi
 * và tách hai phần ở đúng chỗ này.
 */
export class ShopeeOpenApiSource implements OfferSource {
  readonly name = 'shopee-open-api'

  async fetchOffers(opts: FetchOptions): Promise<Offer[]> {
    const data = await graphql<ProductOfferResponse>(PRODUCT_OFFER_QUERY, {
      keyword: opts.keyword ?? '',
      limit: opts.limit,
      page: opts.page ?? 1,
      sortType: 2,
    })

    return (data.productOfferV2?.nodes ?? []).map((n) => {
      const price = toNum(n.priceMin)
      const discountRate = toNum(n.priceDiscountRate) / 100
      return {
        itemId: String(n.itemId ?? ''),
        shopId: String(n.shopId ?? ''),
        name: n.productName ?? '',
        categoryPath: (n.productCatIds ?? []).join('/'),
        url: n.offerLink ?? n.productLink ?? '',
        priceVnd: price,
        originalPriceVnd: discountRate > 0 && discountRate < 1 ? price / (1 - discountRate) : 0,
        baseCommissionRate: normalizeRate(n.commissionRate ?? 0),
        xtraCommissionRate: 0,
        salesCount: toNum(n.sales),
        rating: toNum(n.ratingStar),
        inStock: true,
      }
    })
  }
}

function toNum(v: string | number | undefined): number {
  if (v === undefined) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
