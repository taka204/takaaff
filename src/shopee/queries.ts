/**
 * Các truy vấn GraphQL của Shopee Affiliate Open API.
 *
 * Tên trường dựa trên tài liệu công khai và các bản tích hợp hiện có. Khi được
 * cấp quyền, việc đầu tiên cần làm là đối chiếu lại danh sách trường với tài
 * liệu chính thức tại affiliate.shopee.vn/open_api/list — schema có thể đã đổi.
 */

export const PRODUCT_OFFER_QUERY = `
query ProductOffer($keyword: String, $limit: Int, $page: Int, $sortType: Int) {
  productOfferV2(keyword: $keyword, limit: $limit, page: $page, sortType: $sortType) {
    nodes {
      itemId
      shopId
      productName
      productLink
      offerLink
      imageUrl
      priceMin
      priceMax
      priceDiscountRate
      commissionRate
      commission
      sales
      ratingStar
      shopName
      productCatIds
    }
    pageInfo {
      page
      limit
      hasNextPage
    }
  }
}`

export const SHOP_OFFER_QUERY = `
query ShopOffer($keyword: String, $limit: Int, $page: Int) {
  shopOfferV2(keyword: $keyword, limit: $limit, page: $page) {
    nodes {
      shopId
      shopName
      commissionRate
      offerLink
      originalLink
      shopType
      remainingBudget
    }
    pageInfo {
      page
      limit
      hasNextPage
    }
  }
}`

export const GENERATE_SHORT_LINK_MUTATION = `
mutation GenerateShortLink($input: ShortLinkInput!) {
  generateShortLink(input: $input) {
    shortLink
  }
}`

export const CONVERSION_REPORT_QUERY = `
query ConversionReport($purchaseTimeStart: Int, $purchaseTimeEnd: Int, $limit: Int, $scrollId: String) {
  conversionReport(
    purchaseTimeStart: $purchaseTimeStart
    purchaseTimeEnd: $purchaseTimeEnd
    limit: $limit
    scrollId: $scrollId
  ) {
    nodes {
      conversionId
      purchaseTime
      clickTime
      orderStatus
      campaignType
      utmContent
      linkedProductInfo {
        itemId
        itemName
        itemPrice
        qty
        itemTotalCommission
      }
    }
    pageInfo {
      hasNextPage
      scrollId
    }
  }
}`
