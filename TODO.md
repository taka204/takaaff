# Việc làm trong lúc chờ duyệt Open API

Nguyên tắc sắp xếp: ưu tiên không theo độ khó mà theo **mức mất mát nếu trì hoãn**.
Có những việc chậm một tuần là mất luôn một tháng; có những việc làm lúc nào cũng thế.

**Cập nhật 05/09/2026 — đổi hướng kênh.** Telegram hoãn ưu tiên. Ba hướng mới: video
tự đăng, trang Facebook, và một công cụ cho người quen tự tạo link. Lịch cron đăng
Telegram đã tắt trong workflow (bấm tay vẫn chạy được).

Đổi hướng này làm **tăng** mức khẩn của ba việc, không giảm — lý do ở mục 1.1 và 1.2.

---

## Điều phải hiểu trước khi đọc phần còn lại

Cả ba hướng mới đều đứng trên một giả định chung mà **chưa ai kiểm chứng**: rằng link
hệ thống sinh ra là link ăn được hoa hồng.

Hiện tại `npm run link` lấy cột `url` trong CSV rồi gắn `sub_id1..5` vào
(`appendSubIds` trong `src/subid.ts`, chú thích ghi rõ "dùng khi chưa có
generateShortLink"). Nếu cột `url` là link Shopee thường — như fixture đang dùng,
`https://shopee.vn/product/9001/100001` — thì link đó **đo được nhưng không mang mã
tiếp thị, tức là không ra tiền**.

Đây không phải lỗi mới sinh ra. Nó nằm im được suốt M1–M4 vì chưa ai đăng thật. Nhưng
cả ba hướng mới đều là đăng thật, nên nó thành thứ chặn đầu tiên.

---

## Nhóm 1 — Mất giá trị nếu trì hoãn. Làm tuần này.

### [ ] 1.1 Xác minh link tiếp thị ⚠ CHẶN CẢ BA HƯỚNG MỚI

Mở dashboard affiliate, tự tay tạo link cho một sản phẩm bất kỳ, rồi trả lời:

- [ ] **Link tiếp thị trông như thế nào?** Dạng rút gọn `shope.ee/xxxx`, hay dạng dài
      có tham số? Chép nguyên một cái ra cho tôi.
- [ ] **CSV bạn xuất ra có cột link tiếp thị không**, hay chỉ có link sản phẩm thường?
      Nếu có, tên cột là gì — thêm một dòng vào bảng alias là xong.
- [ ] **Gắn thêm `?sub_id1=...` vào link tiếp thị có giữ được ghi nhận không?** Cách
      thử rẻ nhất: tạo một link có sub_id sẵn trong dashboard, so với link tự gắn tay,
      xem hai cái có cùng dạng không.

Vì sao chặn: nếu phải vào dashboard tạo link tay cho từng sản phẩm thì công cụ cho
người quen tự tạo link (mục 2.4) **không tự động hoá được** — nó chỉ hoán vị được
`sub_id` trên một link tiếp thị đã có sẵn. Lúc đó thiết kế phải đổi: lưu link tiếp thị
gốc theo từng sản phẩm, và bạn nạp chúng theo lô thay vì hệ thống tự sinh.

Biết sớm thì thiết kế đúng một lần. Biết muộn thì viết lại.

### [ ] 1.2 Hỏi Shopee về quy tắc nhãn AI ⚠ GIỜ LÀ CÂU HỎI QUYẾT ĐỊNH NHẤT

Trước đây đây là một câu hỏi quan trọng. Từ lúc video thành hướng chính, nó thành câu
hỏi **quyết định cả hướng đi**.

Gửi ticket cho bộ phận hỗ trợ affiliate, **xin trả lời bằng văn bản**:

> Khi bật nhãn "Video tạo bởi AI" trên Shopee Video, hoa hồng cơ bản của Shopee có bị
> tắt không? Hoa hồng AMS do người bán trả có còn được ghi nhận không?

Tài liệu Shopee Philippines và Malaysia nói rõ: gắn nhãn AI thì tắt hoa hồng cơ bản
nhưng **giữ hoa hồng AMS**. Bản Việt Nam chưa kiểm chứng được.

Nếu Việt Nam giống PH/MY thì Làn A (video AI, chi phí hàng ~0đ) chạy được và sản lượng
video gần như không giới hạn. Nếu Việt Nam tắt cả AMS thì **Làn A không tồn tại**: mỗi
video buộc phải có hàng thật trong tay, tức là mỗi video tốn tiền và tốn thời gian, tức
là "kênh tự đăng video" là một công việc thủ công chứ không phải một cái máy.

Hai câu trả lời dẫn tới hai kế hoạch khác hẳn nhau. Đừng đổ công vào quy trình video
trước khi biết.

### [ ] 1.3 Năm video để mở giỏ hàng Shopee Video ⚠ CỔNG VÀO CỦA HƯỚNG CHÍNH

**Việc time-box duy nhất trong danh sách.** Điều kiện là 5 video gốc hợp lệ **trong
vòng 30 ngày**. Cửa sổ trượt, nên bắt đầu muộn một tuần là đẩy lùi cả giai đoạn.

Làm bằng **Làn B** (tay thật, sản phẩm thật, không gắn nhãn AI) cho đúng 5 video này,
vì đây là 5 video Shopee dùng để xét duyệt tài khoản — không phải chỗ để tiết kiệm.

Bám quy chuẩn kỹ thuật:
- 9:16, tối thiểu 540×960px, bitrate ≥516 kbps
- Sản phẩm xuất hiện ≥6 giây và chiếm >20% khung hình
- Ảnh tĩnh tối đa 20% thời lượng, cấm quay màn hình
- Không watermark/logo/phụ đề của nền tảng khác
- Có bàn tay thao tác với sản phẩm (thuật toán ưu tiên video có bộ phận cơ thể)

Quay bằng sản phẩm bạn **đang có sẵn trong nhà** — không mua gì cho bước này.

### [ ] 1.4 Xác minh 4 tham số trong dashboard

- [ ] **Trần hoa hồng mỗi đơn.** Đang đặt 30.000 ở cả `.env` lẫn GitHub Variable
      `TAKAAFF_PER_ORDER_CAP_VND`. Nếu thực tế là 70.000 thì **thứ tự bảng xếp hạng
      đổi hẳn** — hàng giá 500k–1tr đang bị dìm sẽ leo lên. Sửa hai chỗ, một phút.
- [ ] **Ngưỡng thanh toán tối thiểu.** Không dùng trong code, nhưng quyết định bao giờ
      tiền thật về tài khoản.
- [ ] **Bảng hoa hồng cơ bản theo ngành hàng.** Đối chiếu với giả định 1,58–3,68%.
- [ ] **Dashboard xuất được CSV gì** — danh sách sản phẩm, báo cáo đơn, báo cáo click.
      Quyết định mục 1.1, 2.1 và 2.2 dùng được tới đâu.

### [ ] 1.5 Lập trang Facebook và đăng tay bài đầu tiên

Chưa cần code. `npm run link -- --item=<id> --channel=fb --type=flash` đã sinh được
link gắn subId và lưu vào DB để sau còn gắn click. Đăng tay trước, tự động hoá sau —
xem mục 2.5 để biết vì sao thứ tự này không phải là lười.

Tăng trưởng khán giả là thứ **không nén được bằng nỗ lực**, chỉ cộng dồn theo thời
gian. Ngày chưa lập trang là ngày mất vĩnh viễn khỏi đường cong.

### [ ] 1.6 Xuất CSV mỗi ngày, kể cả khi chưa dùng đến

`product_snapshot` là append-only và **dữ liệu lịch sử không backfill được**. Biến động
giá và hoa hồng giữa các ngày chính là tín hiệu engine dùng để tính tốc độ bán; ảnh
chụp tĩnh thì không có tín hiệu đó.

Từ lúc lên cloud, việc này là **push file CSV vào `data/exports/`** — workflow tự chạy
ingest + rank trên file mới nhất. Không cần mở máy chạy lệnh.

5 phút mỗi ngày. Ngày nào bỏ là mất vĩnh viễn.

---

## Nhóm 2 — Code

### [x] 2.1 `conversions:import` — nhập đơn từ CSV dashboard ⭐ ĐÃ XONG

Vòng phản hồi khép kín mà không cần API. `ConversionSource` có hai cài đặt
(`conversion-csv`, `conversion-api`) dùng chung một job.

```bash
npm run conversions:import -- --file=data/exports/don-hang-thang-9.csv
npm run epc -- --by=source
```

Đọc được header tiếng Việt có dấu, dấu chấm phân cách nghìn, ngày dd/mm/yyyy, và tách
đúng đơn Shopee Video (không mang subId) khỏi đơn từ link.

**Còn lại:** đối chiếu tên cột thật trong file dashboard xuất ra; thiếu cột nào thì
thêm một dòng vào `HEADER_ALIASES` trong `src/sources/conversion-csv.ts`.

### [x] 2.2 Nhập số click — ĐÃ XONG

```bash
npm run clicks:pending                                  # link nào còn thiếu
npm run clicks:set -- --link=3 --clicks=157             # nhập từng cái
npm run clicks:import -- --file=data/exports/click.csv  # hoặc nạp hàng loạt
```

Khớp theo tổ hợp 5 subId, rơi về khớp theo URL khi file không có cột subId. Dòng nào
không khớp được sẽ hiện ra chứ không bị nuốt im lặng.

Cột `clicks` nằm ở `link` chứ không ở `post` (migration 002): dashboard báo click theo
tổ hợp sub_id tức là theo link; để ở `post` thì một link đăng lại hai lần sẽ đếm click
hai lần.

### [x] 2.3 Chạy tự động trên cloud — ĐÃ XONG VÀ ĐÃ CHẠY THẬT

Không dùng Task Scheduler: máy cá nhân tắt thì cron không chạy, mà cửa sổ ghi nhận của
Shopee chỉ có 7 ngày — đăng trễ một ngày là mất đơn chứ không phải hoãn đơn.

- Repo: https://github.com/taka204/takaaff (public, để scheduled workflow chạy được)
- DB: Neon Postgres. Cùng một schema chạy trên SQLite (máy cá nhân, test) và Postgres
  (cloud) qua `src/db/driver.ts`.
- Cron: ingest + rank mỗi 2 tiếng; kéo báo cáo đơn 08:00 VN.
- Đã kiểm chứng đầu-cuối: runner GitHub ghi được vào Neon.

**Lịch đăng Telegram đã tắt** theo hướng đi mới. Job `publish` vẫn bấm tay được qua
workflow_dispatch. Mở lại bằng cách bỏ comment hai dòng cron trong workflow.

**Còn lại:** deploy dashboard lên Vercel.

### [ ] 2.4 Khung cộng tác viên — để người quen tự tạo link ⭐ VIỆC LỚN NHẤT CÒN LẠI

Phụ thuộc mục 1.1. Đọc mục đó trước.

**Ràng buộc thứ nhất: subId đã dùng hết 5 ô.** Lược đồ cố định từ bài đầu tiên và không
đổi được mà không mất đường so sánh với dữ liệu đang tích luỹ. Muốn biết đơn nào của ai
thì phải có một ô cho người.

Đề xuất: trong làn cộng tác viên, đặt `sub1 = ref` và **`sub5` mang mã người** thay vì
biến thể A/B. Lý do: A/B chỉ có nghĩa khi mình viết cả hai phiên bản tiêu đề — người
khác tự viết bài của họ, nên ô đó vốn đã vô nghĩa trong làn này. Bốn ô còn lại giữ
nguyên ý nghĩa. Không phải thoả hiệp: đây là ô duy nhất mà làn mới không dùng tới.

Kèm theo là một chiều đo mới trong `epcReport` lọc theo `sub1='ref'` rồi gom theo
`sub5` — trả lời "ai thực sự mang đơn về".

**Ràng buộc thứ hai: cần một endpoint GHI trên internet.** Điều này **đảo ngược** một
quyết định đã ghi rõ trong `api/rank.ts`: "Dashboard không sửa dữ liệu — một endpoint
ghi trên internet là bề mặt tấn công không cần thiết cho thứ mà chỉ một người dùng."

Tiền đề đó vừa mất hiệu lực: giờ có nhiều người dùng. Nhưng phải thay bằng hàng rào
khác chứ không phải bỏ trống:

- mỗi người một token riêng, thu hồi được từng cái (không dùng chung `DASHBOARD_TOKEN`)
- endpoint chỉ **sinh link** — không sửa được sản phẩm, điểm số hay đơn hàng
- giới hạn tần suất theo người
- ghi nhật ký ai tạo link nào, lúc nào

**Các bước:**

- [ ] Bảng `partner` (id, slug, tên, token băm, trạng thái, tạo lúc)
- [ ] Migration 003 — nhớ dùng `{{SERIAL_PK}}`, đã có test chặn cú pháp chỉ-có-ở-SQLite
- [ ] `sub5` mang mã người trong làn `ref`; thêm chiều đo `partner` vào `epcReport`
- [ ] `POST /api/link` — xác thực theo token người, trả link đã gắn subId
- [ ] Trang tạo link: chọn sản phẩm trong bảng xếp hạng, bấm, copy
- [ ] CLI quản lý: `partner:add`, `partner:list`, `partner:revoke`

**Phần chính sách hoãn lại** theo thống nhất: khung này chạy được cho cả hai kiểu dùng
(cộng tác viên chia sẻ cho khán giả của họ, hoặc người quen tự mua). Nhưng trước khi mở
cho người tự mua thì đọc mục 3.3 — có một rủi ro thật ở đó.

### [ ] 2.5 Publisher Facebook

`sub1` đã hỗ trợ `fb`, và `compose()` trong `src/publish/telegram.ts` đã tách khỏi
`publish()` — nên phần soạn nội dung dùng lại được nguyên vẹn. Việc còn lại chỉ là một
file trong `src/publish/`.

Nhưng **đăng tự động lên trang Facebook cần token Page qua Graph API, và quyền
`pages_manage_posts` phải qua duyệt ứng dụng của Meta.** Tức là hướng này có một cổng
duyệt y hệt cổng Shopee Open API đang chờ. Đừng để tiến độ phụ thuộc vào nó.

Vì thế mục 1.5 là **đăng tay trước**. Đăng tay vẫn sinh được link có subId, vẫn gắn
được click, vẫn vào được EPC — mất công chép dán, không mất dữ liệu. Tự động hoá là
việc tối ưu, không phải việc chặn.

- [ ] Đăng tay 2 tuần, thu số liệu thật
- [ ] Nếu EPC của Facebook đáng, mới đi xin quyền Meta
- [ ] `src/publish/facebook.ts` khi có token

### [ ] 2.6 Chọn biến thể A/B tự động

`subId5` đã có nhưng phải truyền `--variant` bằng tay. Cho hệ thống tự luân phiên a/b
và tự chọn bên thắng dựa trên `epcReport('variant')`.

**Lưu ý va chạm với mục 2.4:** nếu `sub5` mang mã người trong làn `ref`, thì A/B tự
động chỉ áp cho làn tự đăng (`sub1` là `fb`, `web`, `video`...). Làm 2.4 trước thì 2.6
phải biết điều này.

Chỉ đáng làm sau khi có đơn thật — không có dữ liệu thì không có gì để chọn.

### [ ] 2.7 Telegram — HOÃN

Code đã xong và chạy được (`npm run publish -- --dry-run`). Chỉ thiếu token.

Ghi lại để sau này còn nhớ: Telegram từng đứng nhóm 1 vì nó là **kênh duy nhất tự đăng
được ngay, không qua cổng duyệt nào**. Ba hướng mới đều có cổng: Shopee Video cần 5
video xét duyệt, Facebook cần Meta duyệt quyền, cộng tác viên cần link tiếp thị hợp lệ.
Nghĩa là vài tuần tới engine sẽ chạy mà **không có đầu ra tự động nào** — mọi thứ đăng
đều là tay.

Đó là một cái giá có thật, không phải lý do để đổi ý. Chỉ là nên biết mình đang trả gì.

---

## Nhóm 3 — Quyết định, không phải code

### [ ] 3.1 Chốt 1–2 ngành hàng và bám suốt 90 ngày

Ưu tiên nơi XTRA tập trung và tần suất mua lại cao: làm đẹp, đồ gia dụng nhỏ, mẹ và bé.
Tránh hẳn thực phẩm chức năng và thiết bị y tế — đã chặn cứng trong
`src/compliance/blocklist.ts`, lý do là trách nhiệm liên đới theo Luật Quảng cáo
75/2025/QH15.

Với hướng video, ràng buộc thêm: chọn ngành **quay được bằng đồ có sẵn trong nhà**.

### [ ] 3.2 Chuẩn hoá quy trình quay

Một góc máy cố định, một đèn, một nền. Mục tiêu là quay xong một video trong 10 phút.
Quy trình rẻ và lặp được quan trọng hơn video đẹp.

### [ ] 3.3 Quyết định: người quen có được tự mua qua link của chính họ không?

Chưa cần trả lời ngay — khung ở mục 2.4 dựng được trước khi chốt. Nhưng phải trả lời
**trước khi mời người đầu tiên vào**, vì mời rồi thì rút lại là mất mặt.

Hai điều cần biết trước khi quyết:

**Shopee thường không trả hoa hồng cho đơn tự mua.** Nếu đó là cách bạn định dùng, hãy
xác minh trong điều khoản trước khi hứa với ai — hứa xong mới biết không được trả là
tình huống tệ nhất.

**Nhiều đơn tự mua dồn về một tài khoản là đúng mẫu hành vi hệ thống chống gian lận
bắt.** Chính sách Shopee xử lý rất nặng: quá hai lần vi phạm là khoá vĩnh viễn kèm mất
hoa hồng chưa đối soát. Với một hệ thống tự động, mối nguy lớn nhất không phải là cố ý
gian lận mà là **vô tình tạo ra mẫu trông giống gian lận**.

Hướng cộng tác viên thật (họ đăng cho khán giả của họ) không mang rủi ro này, và còn
cho bạn thứ giá trị hơn: EPC theo từng người, tức là biết ai đáng đầu tư tiếp.

---

## Việc KHÔNG nên làm

Danh sách này quan trọng ngang danh sách trên.

**Đừng tinh chỉnh công thức chấm điểm.** Chưa có đơn thật thì không có tín hiệu để
chỉnh theo — mọi thay đổi chỉ là đổi phỏng đoán này lấy phỏng đoán khác, và còn làm mất
đường so sánh với dữ liệu đang tích luỹ. Ngoại lệ duy nhất: sau khi chạy trên CSV thật
lần đầu, được phép chỉnh một lần bằng cảm quan.

**Đừng dựng website SEO.** Việc của tuần 9–12, sau khi biết ngành hàng nào và loại nội
dung nào cho EPC cao nhất.

**Đừng mua hàng để quay hàng loạt.** Cây cầu giữa hai làn chỉ có giá trị khi đi đúng
chiều: dò ra sản phẩm thắng trước, rồi mới bỏ tiền mua **đúng những sản phẩm đã tự
chứng minh**. Ngoại lệ: 5 video ở mục 1.3, và chỉ dùng đồ có sẵn.

**Đừng chạy quảng cáo.** Ngân sách seeding thuộc về tuần 9, sau khi có EPC để biết đổ
vào kênh nào. Dòng tiền hoa hồng trễ T+30 nên tiêu sớm là tự tạo áp lực vô ích.

**Đừng mở nhiều tài khoản.** Xem mục 3.3.

**Đừng mời người quen vào trước khi xong mục 1.1.** Mời người ta dùng một công cụ sinh
ra link không ăn hoa hồng thì lần sau gọi không ai đến.

---

## Thứ tự đề xuất

Tuần 1: 1.1 → 1.2 → 1.4 → 1.3 (bắt đầu) → 1.5
Tuần 2: 1.6 (thành thói quen) → 1.3 (xong 5 video) → 2.4 (dựng khung)
Tuần 3: 3.1 → 3.2 → 2.4 (xong) → 3.3
Tuần 4: đăng tay Facebook lấy số liệu → 2.5 nếu đáng → 2.6

Nếu API được duyệt giữa chừng: đổi `--source=csv` thành `--source=api`, đối chiếu lại
tên trường trong `src/sources/shopee-api.ts` và `src/jobs/sync-conversions.ts`. Riêng
mục 1.1 sẽ tự giải quyết — `generateShortLink` sinh link tiếp thị thật, và mục 2.4 tự
động hoá được hoàn toàn.
