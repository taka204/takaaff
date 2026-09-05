# TakaAff

Deal engine cho Shopee Affiliate: thu thập sản phẩm, chấm điểm theo giá trị kỳ vọng
mỗi click (ưu tiên hàng có Hoa hồng XTRA), sinh link gắn `subId` phân tầng, đăng bài
và học ngược từ báo cáo chuyển đổi.

Tài liệu chiến lược 90 ngày: `plan.html`.

## Chạy thử trong 30 giây

Không cần cài gì, không cần credential, không cần quyền Open API:

```bash
npm run db:init
npm run ingest                      # đọc data/fixtures/offers-sample.csv
npm run rank
npm run publish -- --dry-run --limit=2
```

Kiểm chứng:

```bash
npm test          # 47 test, không cần mạng
npm install       # chỉ cần cho typecheck
npm run typecheck
```

## Vì sao thiết kế như vậy

**Không phụ thuộc quyền Open API.** Quyền truy cập `open-api.affiliate.shopee.vn`
phải xin riêng và có thể bị từ chối (lỗi `10035`). Interface `OfferSource`
(`src/sources/types.ts`) tách nguồn dữ liệu khỏi mọi logic phía trên, và
`ManualCsvSource` đọc file xuất tay từ dashboard. Bị từ chối API thì engine mất
tính tức thời, không mất một dòng logic nào.

Kiểm tra trạng thái đơn xin API bất cứ lúc nào:

```bash
npm run shopee:ping
```

**Gần như không dependency.** Node 24 có sẵn `node:sqlite`, chạy TypeScript trực
tiếp không cần build, `fetch`, `node:crypto`, `node:test`. Dev dependency duy nhất
là `typescript` cho `npm run typecheck` — type stripping không kiểm tra kiểu.

Hệ quả: viết bằng *erasable syntax*. Không `enum`, không parameter property,
không `namespace` — dùng `const` object cộng union type thay cho enum.

**Trần hoa hồng nằm trong công thức, không phải bộ lọc chạy sau.**
`min(giá × hoa hồng thực, trần) × xác suất chốt` — nhờ vậy hàng giá trị lớn tự
tụt hạng đúng mức thay vì được xếp cao rồi mới phát hiện hoa hồng bị chặn.

**Tuân thủ ở tầng code, không ở thói quen.** Danh sách chặn chạy trong
`jobs/ingest.ts` *trước khi ghi DB*, nên hàng thuộc nhóm rủi ro pháp lý không bao
giờ tồn tại trong hệ thống. Câu công bố tiếp thị liên kết được chèn tự động trong
`publish/telegram.ts`, không phụ thuộc việc có nhớ hay không.

## Bốn tham số phải tự xác minh

Các nguồn công khai mâu thuẫn nhau. Sửa trong `.env` sau khi tra dashboard:

| Tham số | Mặc định | Ghi chú |
|---|---|---|
| `TAKAAFF_PER_ORDER_CAP_VND` | 30.000 | Nguồn ghi 30k / 50k / 70k. Đặt thấp là sai theo hướng an toàn. |
| Ngưỡng thanh toán tối thiểu | — | Chưa dùng trong code, cần biết để tính dòng tiền. |
| Bảng hoa hồng cơ bản theo ngành | — | Dashboard là nguồn đúng duy nhất. |
| Quy tắc nhãn AI trên Shopee Video | — | PH/MY: gắn nhãn tắt hoa hồng cơ bản, giữ hoa hồng AMS. Bản VN chưa kiểm chứng. |

## Lệnh

```
db:init                                        tạo/nâng cấp schema
ingest  --source=csv|api [--file=] [--limit=]  thu thập offer vào DB
rank    [--limit=20] [--json]                  chấm điểm và xếp hạng
link    --item=<id> [--channel=] [--type=]     sinh link kèm subId
publish [--dry-run] [--limit=3]                đăng lên Telegram
sync    [--from=] [--to=]                      kéo conversionReport
epc     [--by=channel|type|category|slot|variant|source] [--days=30]
shopee:ping                                    kiểm tra trạng thái quyền API
```

## Lược đồ subId

Cố định từ bài đăng đầu tiên. Đặt sai thì ba tháng sau có dữ liệu mà không phân
tích được.

| | Chiều đo | Ví dụ | Trả lời |
|---|---|---|---|
| `sub1` | Kênh | `tg` `zalo` `fb` `web` `video` | Kênh nào đáng đầu tư tiếp? |
| `sub2` | Loại bài | `flash` `restock` `review` | Định dạng nào chốt tốt? |
| `sub3` | Ngành hàng | `sac-dep` `nha-cua` | Ngách nào nên tập trung? |
| `sub4` | Khung đăng | `260915-20` | Khung giờ nào hiệu quả? |
| `sub5` | Biến thể A/B | `a` `b` | Tiêu đề nào thắng? |

## Trạng thái

Đã xong **M1** (lõi: thu thập, chấm điểm, xếp hạng, tuân thủ) và **M2** (phân
phối: subId, công bố, Telegram có dry-run).

**M3** (client API đã ký sẵn, `ShopeeOpenApiSource`, `generateShortLink`) đã viết
xong nhưng chưa chạy được vì chưa có credential — cần đối chiếu lại tên trường
với tài liệu chính thức khi được cấp quyền.

**M4** (`sync-conversions`, báo cáo EPC) chạy được về mặt code, nhưng cách Shopee
trả `subId` trong `conversionReport` chưa xác minh được — xem ghi chú trong
`src/jobs/sync-conversions.ts`.
