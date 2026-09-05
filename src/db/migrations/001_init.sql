-- Sản phẩm: một dòng duy nhất cho mỗi item, chỉ chứa thông tin ít đổi.
CREATE TABLE IF NOT EXISTS product (
  item_id       TEXT PRIMARY KEY,
  shop_id       TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL,
  category_path TEXT NOT NULL DEFAULT '',
  url           TEXT NOT NULL DEFAULT '',
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);

-- Ảnh chụp theo thời gian. APPEND-ONLY, không bao giờ UPDATE.
-- Biến động giá và hoa hồng giữa các dòng mới là tín hiệu; dữ liệu lịch sử
-- không thể lấy bù về sau nên bảng này bắt đầu ghi từ ngày đầu tiên.
CREATE TABLE IF NOT EXISTS product_snapshot (
  id                   {{SERIAL_PK}},
  item_id              TEXT NOT NULL REFERENCES product(item_id),
  captured_at          TEXT NOT NULL,
  price_vnd            INTEGER NOT NULL,
  original_price_vnd   INTEGER NOT NULL DEFAULT 0,
  base_commission_rate REAL NOT NULL DEFAULT 0,
  xtra_commission_rate REAL NOT NULL DEFAULT 0,
  sales_count          INTEGER NOT NULL DEFAULT 0,
  rating               REAL NOT NULL DEFAULT 0,
  in_stock             INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_snapshot_item_time
  ON product_snapshot(item_id, captured_at DESC);

-- Kết quả chấm điểm. reasons_json giữ lại từng hệ số để sau còn truy được
-- vì sao một sản phẩm được đẩy lên đầu bảng.
CREATE TABLE IF NOT EXISTS score (
  id                    {{SERIAL_PK}},
  item_id               TEXT NOT NULL REFERENCES product(item_id),
  computed_at           TEXT NOT NULL,
  ev_per_click          REAL NOT NULL,
  p_convert             REAL NOT NULL,
  effective_rate        REAL NOT NULL,
  capped_commission_vnd INTEGER NOT NULL,
  reasons_json          TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_score_time_ev
  ON score(computed_at DESC, ev_per_click DESC);

-- Link đã sinh, kèm đủ 5 tham số subId.
CREATE TABLE IF NOT EXISTS link (
  id         {{SERIAL_PK}},
  item_id    TEXT NOT NULL REFERENCES product(item_id),
  short_url  TEXT NOT NULL,
  sub1       TEXT NOT NULL,
  sub2       TEXT NOT NULL,
  sub3       TEXT NOT NULL,
  sub4       TEXT NOT NULL,
  sub5       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_link_subids
  ON link(item_id, sub1, sub2, sub3, sub4, sub5);

-- Bài đã đăng. clicks để trống cho tới khi có số liệu từ dashboard.
CREATE TABLE IF NOT EXISTS post (
  id          {{SERIAL_PK}},
  channel     TEXT NOT NULL,
  link_id     INTEGER REFERENCES link(id),
  item_id     TEXT NOT NULL REFERENCES product(item_id),
  posted_at   TEXT NOT NULL,
  variant     TEXT NOT NULL DEFAULT 'a',
  external_id TEXT,
  clicks      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_post_channel_time ON post(channel, posted_at DESC);

-- Đơn đã ghi nhận.
-- source tách 'link' và 'video': đơn từ Shopee Video đi qua giỏ hàng in-app,
-- KHÔNG mang subId, nên cần đường nhập riêng. Không tách từ đầu thì EPC giữa
-- hai kênh không so được với nhau.
CREATE TABLE IF NOT EXISTS conversion (
  id              {{SERIAL_PK}},
  order_id        TEXT NOT NULL,
  item_id         TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL CHECK (source IN ('link', 'video')),
  sub1            TEXT NOT NULL DEFAULT '',
  sub2            TEXT NOT NULL DEFAULT '',
  sub3            TEXT NOT NULL DEFAULT '',
  sub4            TEXT NOT NULL DEFAULT '',
  sub5            TEXT NOT NULL DEFAULT '',
  order_value_vnd INTEGER NOT NULL DEFAULT 0,
  commission_vnd  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  ordered_at      TEXT,
  validated_at    TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_order
  ON conversion(order_id, item_id);
CREATE INDEX IF NOT EXISTS idx_conversion_ordered_at ON conversion(ordered_at DESC);

-- Nhật ký chạy job, để phát hiện job chết âm thầm.
CREATE TABLE IF NOT EXISTS ingest_run (
  id            {{SERIAL_PK}},
  source        TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  items_seen    INTEGER NOT NULL DEFAULT 0,
  items_blocked INTEGER NOT NULL DEFAULT 0,
  error         TEXT
);
