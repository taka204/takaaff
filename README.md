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
npm test          # 93 test, không cần mạng
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
link    --item=<id> [--channel=] [--type=]     sinh link kèm subId, lưu lại
publish [--dry-run] [--limit=3]                đăng lên Telegram
clicks:pending [--limit=20]                    link chưa có số click
clicks:set --link=<id> --clicks=<N>            nhập click cho một link
clicks:import --file=<csv>                     nạp click hàng loạt từ dashboard
conversions:import --file=<csv> [--from=] [--to=] [--default-source=link|video]
                                               nạp đơn từ CSV dashboard
sync    [--from=] [--to=]                      như trên, nhưng lấy qua API
epc     [--by=channel|type|category|slot|variant|source] [--days=30]
shopee:ping                                    kiểm tra trạng thái quyền API
```

## Vòng phản hồi chạy được mà không cần API

`ConversionSource` áp đúng mẫu của `OfferSource` cho chiều ngược lại: đơn hàng vào hệ
thống qua interface, nên đọc từ CSV dashboard hay từ `conversionReport` đều cùng một job.

```bash
npm run conversions:import -- --file=data/exports/don-hang.csv
npm run epc -- --by=source
```

Báo cáo tách **"đã đối soát"** khỏi **"còn treo"**. Gộp hai con số là cách âm thầm thổi
phồng hiệu quả: chu kỳ đối soát khoảng T+30 nên trong tháng đầu gần như mọi đơn đều đang
treo, và một phần sẽ bị huỷ hoặc hoàn. EPC luôn tính trên cột đã đối soát.

Số click phải nhập tay vì Shopee không trả click theo subId qua API — chỉ hiện trên
dashboard. Đây là giới hạn của nền tảng, không phải của công cụ, nên vẫn đúng cả sau khi
được cấp quyền API.

```bash
npm run clicks:pending                       # link nào còn thiếu
npm run clicks:set -- --link=3 --clicks=157  # nhập từng cái
npm run clicks:import -- --file=click.csv    # hoặc nạp hàng loạt
```

Click nằm trên bảng `link`, không phải `post`: dashboard báo theo tổ hợp sub_id tức là
theo link, nên để ở `post` thì một link đăng lại hai lần sẽ bị đếm click hai lần.

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

## Chạy trên cloud

Máy cá nhân tắt thì cron không chạy, mà cửa sổ ghi nhận của Shopee chỉ có 7 ngày —
đăng trễ một ngày là mất đơn chứ không phải hoãn đơn. Nên phần tự động chuyển lên
cloud, còn máy cá nhân giữ nguyên vai trò chỗ phát triển.

Ba mảnh, đều ở bậc miễn phí:

| Mảnh | Việc | Vì sao chỗ đó |
|---|---|---|
| Neon (Postgres) | Lưu dữ liệu | Actions và Vercel không có ổ đĩa bền |
| GitHub Actions | Cron: ingest → rank → publish | Đã có sẵn repo, không thêm nhà cung cấp |
| Vercel | Dashboard chỉ đọc | Xem bảng xếp hạng và EPC từ điện thoại |

### 1. Postgres

Tạo một database ở Neon (hoặc bất kỳ Postgres nào — code dùng `pg` chuẩn, không
khoá vào nhà cung cấp), lấy chuỗi kết nối, rồi nâng schema **từ máy cá nhân**:

```bash
DATABASE_URL='postgresql://...' npm run db:init
```

Migration chỉ chạy từ CLI, không bao giờ chạy từ serverless: bundler của Vercel
không đóng gói file `.sql`, và nhiều cold start cùng lúc sẽ đua nhau tạo bảng.
Sau này thêm migration mới thì chạy lại đúng lệnh trên.

Cùng một schema chạy trên cả hai phương ngữ: `src/db/driver.ts` chỉ phải xử lý
4 điểm lệch trên 22 câu SQL, và có test chặn cú pháp chỉ-có-ở-SQLite lọt vào
migration.

### 2. GitHub Actions

Trong repo, đặt `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` vào
**Secrets**, và `TAKAAFF_PER_ORDER_CAP_VND` vào **Variables**.

`.github/workflows/takaaff.yml` chạy ingest+rank mỗi 2 tiếng, đăng bài trước hai
khung giờ vàng, và kéo báo cáo đơn mỗi sáng. Lịch đặt sớm hơn giờ mong muốn vì
Actions trễ 10–30 phút lúc cao điểm.

Chưa có quyền Open API thì đường nạp dữ liệu là **push file CSV vào
`data/exports/`** — workflow tự kích hoạt và ingest file mới nhất.

Hai điều kiện của Actions đáng biết trước: scheduled workflow **bị vô hiệu hoá ở
repo private trên tài khoản miễn phí**, và lịch tự tắt sau 60 ngày repo không có
hoạt động.

### 3. Dashboard

```bash
npx vercel deploy --prod
```

Đặt `DATABASE_URL` và `DASHBOARD_TOKEN` trong environment variables của Vercel,
rồi mở `https://<dự-án>.vercel.app/?token=<DASHBOARD_TOKEN>`.

Dashboard **chỉ đọc**. Mọi thay đổi dữ liệu đi qua CLI, nơi có test bảo vệ — một
endpoint ghi trên internet là bề mặt tấn công không cần thiết cho thứ mà chỉ một
người dùng. `DASHBOARD_TOKEN` để trống thì API trả 503 chứ không mở toang.

## Trạng thái

Đã xong **M1** (lõi: thu thập, chấm điểm, xếp hạng, tuân thủ) và **M2** (phân
phối: subId, công bố, Telegram có dry-run).

**M3** (client API đã ký sẵn, `ShopeeOpenApiSource`, `generateShortLink`) đã viết
xong nhưng chưa chạy được vì chưa có credential — cần đối chiếu lại tên trường
với tài liệu chính thức khi được cấp quyền.

**M4** (`sync-conversions`, báo cáo EPC) chạy được về mặt code, nhưng cách Shopee
trả `subId` trong `conversionReport` chưa xác minh được — xem ghi chú trong
`src/jobs/sync-conversions.ts`.

**M5** (chạy trên cloud: lớp driver SQLite/Postgres, cron GitHub Actions, dashboard
Vercel chỉ đọc) đã xong về code và chạy được trên SQLite. Đường Postgres đúng về mặt
phương ngữ và có test chặn cú pháp lệch, nhưng **chưa chạy trên một Postgres thật** —
bước xác minh đầu tiên là `DATABASE_URL='postgresql://...' npm run db:init`.
