# Việc làm trong lúc chờ duyệt Open API

Nguyên tắc sắp xếp: ưu tiên không theo độ khó mà theo **mức mất mát nếu trì hoãn**.
Có những việc chậm một tuần là mất luôn một tháng; có những việc làm lúc nào cũng thế.

---

## Nhóm 1 — Mất giá trị nếu trì hoãn. Làm tuần này.

### [ ] 1.1 Xác minh 4 tham số trong dashboard

Bạn đã có tài khoản affiliate nên không cần chờ ai. Đây là việc chặn nhiều thứ nhất.

- [ ] **Trần hoa hồng mỗi đơn.** Sửa `TAKAAFF_PER_ORDER_CAP_VND` trong `.env`.
      Đang mặc định 30.000. Nếu thực tế là 70.000 thì **thứ tự bảng xếp hạng đổi hẳn**
      — hàng giá 500k–1tr đang bị dìm sẽ leo lên. Chạy sai tham số này thì mọi dữ liệu
      thu được trong lúc chờ đều lệch.
- [ ] **Ngưỡng thanh toán tối thiểu.** Không dùng trong code, nhưng quyết định bao giờ
      tiền thật về tài khoản.
- [ ] **Bảng hoa hồng cơ bản theo ngành hàng.** Đối chiếu với giả định 1,58–3,68%.
- [ ] **Kiểm tra dashboard có xuất được CSV không** — cả danh sách sản phẩm kèm tỉ lệ
      hoa hồng, lẫn báo cáo đơn. Hai thứ này quyết định mục 1.5 và 2.1 làm được tới đâu.
      Nếu không xuất được, đường lui là tự chép tay danh sách ngắn hơn (30–50 sản phẩm).

### [ ] 1.2 Hỏi Shopee về quy tắc nhãn AI tại Việt Nam

Gửi ticket cho bộ phận hỗ trợ affiliate, **xin trả lời bằng văn bản**:

> Khi bật nhãn "Video tạo bởi AI" trên Shopee Video, hoa hồng cơ bản của Shopee có bị
> tắt không? Hoa hồng AMS do người bán trả có còn được ghi nhận không?

Tài liệu Shopee Philippines và Malaysia nói rõ: gắn nhãn AI thì tắt hoa hồng cơ bản
nhưng **giữ hoa hồng AMS**. Bản Việt Nam chưa kiểm chứng được.

Vì sao gấp: nếu Việt Nam giống PH/MY thì Làn A (video AI, chi phí hàng ~0đ) là hướng
đi chính. Nếu Việt Nam tắt cả AMS thì **Làn A không tồn tại** và toàn bộ kế hoạch video
phải chuyển sang Làn B — tức là phải bỏ tiền mua hàng, tức là ngân sách và tiến độ khác
hẳn. Không thể lên kế hoạch video khi chưa biết câu trả lời.

### [ ] 1.3 Bắt đầu 5 video để mở giỏ hàng Shopee Video

**Đây là việc time-box duy nhất trong danh sách.** Điều kiện là 5 video gốc hợp lệ
**trong vòng 30 ngày**. Cửa sổ trượt, nên bắt đầu muộn một tuần là đẩy lùi cả giai đoạn.

Làm bằng **Làn B** (tay thật, sản phẩm thật, không gắn nhãn AI) cho đúng 5 video này,
vì đây là 5 video Shopee dùng để xét duyệt tài khoản — không phải chỗ để tiết kiệm.

Bám quy chuẩn kỹ thuật:
- 9:16, tối thiểu 540×960px, bitrate ≥516 kbps
- Sản phẩm xuất hiện ≥6 giây và chiếm >20% khung hình
- Ảnh tĩnh tối đa 20% thời lượng, cấm quay màn hình
- Không watermark/logo/phụ đề của nền tảng khác
- Có bàn tay thao tác với sản phẩm (thuật toán ưu tiên video có bộ phận cơ thể)

Quay bằng sản phẩm bạn **đang có sẵn trong nhà** — không mua gì cho bước này.

### [ ] 1.4 Mở kênh Telegram và đăng bài đầu tiên

Tăng trưởng khán giả là thứ **không nén được bằng nỗ lực**, chỉ cộng dồn theo thời gian.
Mỗi ngày chưa mở kênh là một ngày mất vĩnh viễn khỏi đường cong tăng trưởng.

- [ ] Tạo bot qua @BotFather, lấy token
- [ ] Tạo kênh, thêm bot làm admin, lấy `chat_id` (dạng `-100...`)
- [ ] Điền `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` vào `.env`
- [ ] `npm run publish -- --dry-run` xem lại nội dung lần cuối
- [ ] Bỏ `--dry-run`, đăng thật

### [ ] 1.5 Xuất CSV thật và chạy engine trên dữ liệu thật

Fixture 15 dòng của tôi chỉ chứng minh code chạy, không chứng minh **công thức đúng**.

```bash
npm run ingest -- --source=csv --file=data/exports/2026-09-08.csv
npm run rank
```

Rồi tự hỏi: **top 20 có phải thứ mình sẽ tự tay đem đi bán không?** Nếu không, vấn đề
nằm ở hệ số trong `src/scoring/convert-prob.ts` — và đây là lần duy nhất được phép chỉnh
hệ số bằng cảm quan, vì chưa có đơn thật để chỉnh bằng số liệu.

### [ ] 1.6 Xuất CSV mỗi ngày, kể cả khi chưa dùng đến

`product_snapshot` là append-only và **dữ liệu lịch sử không backfill được**. Biến động
giá và hoa hồng giữa các ngày chính là tín hiệu mà engine dùng để tính tốc độ bán; ảnh
chụp tĩnh thì không có tín hiệu đó.

5 phút mỗi ngày. Ngày nào bỏ là mất vĩnh viễn.

---

## Nhóm 2 — Code làm được ngay, không cần API

### [x] 2.1 `conversions:import` — nhập đơn từ CSV dashboard ⭐ ĐÃ XONG

Vòng phản hồi đã khép kín mà không cần API. `ConversionSource` có hai cài đặt
(`conversion-csv`, `conversion-api`) dùng chung một job, đúng mẫu đã áp cho lớp offer.

```bash
npm run conversions:import -- --file=data/exports/don-hang-thang-9.csv
npm run epc -- --by=source
```

Đọc được header tiếng Việt có dấu, dấu chấm phân cách nghìn, ngày dd/mm/yyyy, và tách
đúng đơn Shopee Video (không mang subId) khỏi đơn từ link.

**Việc còn lại của bạn:** kiểm tra tên cột thật trong file dashboard xuất ra. Bảng alias
trong `src/sources/conversion-csv.ts` đang đoán dựa trên tên thường gặp; thiếu cột nào
thì thêm một dòng vào `HEADER_ALIASES`.

### [x] 2.2 Nhập số click — ĐÃ XONG

EPC đã chạy được. Ba lệnh, dùng theo thứ tự này mỗi ngày:

```bash
npm run clicks:pending                                  # link nào còn thiếu
npm run clicks:set -- --link=3 --clicks=157             # nhập từng cái
npm run clicks:import -- --file=data/exports/click.csv  # hoặc nạp hàng loạt
```

`clicks:import` khớp theo tổ hợp 5 subId — đúng độ hạt dashboard báo cáo — và rơi về
khớp theo URL khi file không có cột subId. Dòng nào không khớp được sẽ hiện ra chứ không
bị nuốt im lặng.

Đi kèm một sửa chữa về độ hạt: cột `clicks` đã chuyển từ `post` sang `link`
(migration 002). Dashboard báo click theo tổ hợp sub_id tức là theo link; để ở `post` thì
một link đăng lại hai lần sẽ đếm click hai lần. Có test riêng cho đúng tình huống đó.

Lệnh `link` giờ cũng lưu link vào DB và in ra id — nếu không, bài đăng tay sẽ không có
chỗ nào để gắn click và bị mất khỏi EPC.

### [x] 2.3 Chạy tự động hàng ngày — ĐÃ XONG (code), CÒN PHẦN BẠN BẤM

Không dùng Task Scheduler nữa: máy cá nhân tắt thì cron không chạy, mà cửa sổ ghi
nhận của Shopee chỉ có 7 ngày — đăng trễ một ngày là **mất** đơn chứ không phải hoãn.
Lịch chuyển lên GitHub Actions, dữ liệu chuyển sang Postgres, kèm một dashboard chỉ
đọc trên Vercel để xem bảng xếp hạng và EPC từ điện thoại. Cả ba đều bậc miễn phí.

`.github/workflows/takaaff.yml`: ingest+rank mỗi 2 tiếng, đăng bài trước hai khung
giờ vàng **12:00–13:00** và **20:00–22:00**, kéo báo cáo đơn mỗi sáng. Giờ đặt sớm
hơn khung vàng vì Actions trễ 10–30 phút lúc cao điểm.

Cùng một schema chạy trên SQLite (máy cá nhân, test) và Postgres (cloud) —
`src/db/driver.ts`. Vòng lặp phát triển hằng ngày vẫn không cần mạng.

**Việc còn lại của bạn** (từng bước một, xem README mục "Chạy trên cloud"):

- [ ] Tạo Postgres ở Neon, rồi `DATABASE_URL='postgresql://...' npm run db:init`
- [ ] Đặt Secrets trong repo: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- [ ] Đặt Variable: `TAKAAFF_PER_ORDER_CAP_VND` (giá trị thật từ mục 1.1)
- [ ] `npx vercel deploy --prod`, đặt `DATABASE_URL` và `DASHBOARD_TOKEN`
- [ ] Bấm workflow_dispatch một lần với `task=ingest-rank` để kiểm tra trước khi tin cron

Hai điều kiện của Actions phải biết trước: scheduled workflow **bị vô hiệu hoá ở repo
private trên tài khoản miễn phí** (repo phải public, hoặc nâng GitHub Pro), và lịch tự
tắt sau 60 ngày repo không có hoạt động.

Bảng `ingest_run` đã có sẵn để phát hiện job chết âm thầm — nhớ ngó nó.

Lưu ý về mục 1.6: khi đã lên cloud, "xuất CSV mỗi ngày" trở thành **push CSV vào
`data/exports/`** — workflow tự kích hoạt và ingest file mới nhất. Không cần chạy tay.

### [ ] 2.4 Chọn biến thể A/B tự động

`subId5` đã có nhưng hiện phải truyền `--variant` bằng tay. Cho hệ thống tự luân phiên
a/b và tự chọn bên thắng dựa trên `epcReport('variant')`.

Chỉ đáng làm sau khi 2.1 và 2.2 xong — không có dữ liệu thì không có gì để chọn.

### [ ] 2.5 Publisher thứ hai (Zalo OA hoặc nhóm Facebook)

`subId1` đã hỗ trợ sẵn `zalo` và `fb`. Chỉ cần thêm một file trong `src/publish/`.

Mục đích không phải tăng sản lượng mà là **so EPC giữa các kênh** — phép so quyết định
60 ngày tiếp theo đổ công vào đâu.

---

## Nhóm 3 — Quyết định, không phải code

### [ ] 3.1 Chốt 1–2 ngành hàng và bám suốt 90 ngày

Ưu tiên nơi XTRA tập trung và tần suất mua lại cao: làm đẹp, đồ gia dụng nhỏ, mẹ và bé.
Tránh hẳn thực phẩm chức năng và thiết bị y tế — đã chặn cứng trong
`src/compliance/blocklist.ts`, lý do là trách nhiệm liên đới theo Luật Quảng cáo
75/2025/QH15.

### [ ] 3.2 Chuẩn hoá quy trình quay Làn B

Một góc máy cố định, một đèn, một nền. Mục tiêu là quay xong một video trong 10 phút.
Quy trình rẻ và lặp được quan trọng hơn video đẹp.

---

## Việc KHÔNG nên làm trong lúc chờ

Danh sách này quan trọng ngang danh sách trên.

**Đừng tinh chỉnh công thức chấm điểm.** Chưa có đơn thật thì không có tín hiệu để
chỉnh theo — mọi thay đổi chỉ là đổi phỏng đoán này lấy phỏng đoán khác, và còn làm mất
đường so sánh với dữ liệu đang tích luỹ. Ngoại lệ duy nhất là mục 1.5.

**Đừng dựng website SEO.** Đó là việc của tuần 9–12, sau khi đã biết ngành hàng nào và
loại nội dung nào cho EPC cao nhất. Dựng trước là viết nội dung cho ngách mà mình chưa
biết có đúng không.

**Đừng mua hàng để quay Làn B hàng loạt.** Cây cầu giữa hai làn chỉ có giá trị khi đi
đúng chiều: Làn A dò ra sản phẩm thắng trước, rồi mới bỏ tiền mua **đúng những sản phẩm
đã tự chứng minh**. Mua trước là quay lại đúng cái bẫy đoán mò mà cả hệ thống này sinh ra
để tránh. Ngoại lệ: 5 video ở mục 1.3, và chỉ dùng đồ có sẵn trong nhà.

**Đừng chạy quảng cáo.** Ngân sách seeding thuộc về tuần 9, sau khi có số liệu EPC để
biết đổ vào kênh nào. Dòng tiền hoa hồng trễ T+30 nên tiêu sớm là tự tạo áp lực vô ích.

**Đừng mở nhiều tài khoản.** Chính sách chống gian lận của Shopee xử lý rất nặng, quá
hai lần vi phạm là khoá vĩnh viễn kèm mất hoa hồng chưa đối soát. Với một hệ thống tự
động, mối nguy lớn nhất là vô tình tạo ra mẫu hành vi *trông giống* gian lận.

---

## Thứ tự đề xuất

Tuần 1: 1.1 → 1.2 → 1.4 → 1.3 (bắt đầu) → 1.5
Tuần 2: 2.1 → 2.2 → 1.6 (thành thói quen hàng ngày) → 1.3 (xong 5 video)
Tuần 3: 2.3 → 3.1 → 3.2
Tuần 4: 2.5 → 2.4

Nếu API được duyệt giữa chừng: chỉ cần đổi `--source=csv` thành `--source=api` và đối
chiếu lại tên trường trong `src/sources/shopee-api.ts` cùng `src/jobs/sync-conversions.ts`
(hai chỗ đã ghi sẵn cảnh báo). Không có việc nào ở trên phải làm lại.
