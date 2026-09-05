/**
 * Công bố tiếp thị liên kết và nhãn AI.
 *
 * Cả hai đều là nghĩa vụ, không phải phép lịch sự:
 *  - Luật Quảng cáo 75/2025/QH15 (01/01/2026) buộc người chuyển tải sản phẩm
 *    quảng cáo công bố quan hệ tài trợ.
 *  - Luật Công nghiệp công nghệ số 71/2025/QH15 (01/01/2026) yêu cầu sản phẩm
 *    tạo bởi AI phải có dấu hiệu nhận dạng; Shopee cũng bắt bật nhãn riêng.
 *
 * Vì vậy việc chèn nằm ở tầng code, không phụ thuộc trí nhớ lúc 11 giờ đêm.
 */

export const AFFILIATE_DISCLOSURE =
  'Bài viết có chứa link tiếp thị liên kết. Mình có thể nhận hoa hồng khi bạn mua qua link; giá bạn trả không thay đổi.'

/**
 * Nhãn AI MẶC ĐỊNH BẬT. Chỉ tắt thủ công khi video thực sự được quay bằng tay
 * thật. Đảo ngược logic này — mặc định tắt, nhớ thì bật — là thiết kế sai, vì
 * nó biến một nghĩa vụ pháp lý thành thứ phụ thuộc vào việc có nhớ hay không.
 */
export const AI_LABEL_DEFAULT_ON = true

/** Chèn câu công bố vào cuối nội dung, không chèn lặp nếu đã có. */
export function withDisclosure(body: string): string {
  if (body.includes(AFFILIATE_DISCLOSURE)) return body
  return `${body.trimEnd()}\n\n${AFFILIATE_DISCLOSURE}`
}

export function hasDisclosure(body: string): boolean {
  return body.includes(AFFILIATE_DISCLOSURE)
}
