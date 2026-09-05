-- Chuyển số click từ `post` sang `link`.
--
-- Đặt nhầm độ hạt ở migration 001: dashboard affiliate báo click theo tổ hợp
-- sub_id, tức là theo LINK, không theo bài đăng. Giữ ở `post` thì một link được
-- đăng lại hai lần sẽ đếm click hai lần, và không có cách nào nhập số liệu
-- dashboard vào mà không phải tự chia thủ công.
--
-- Sửa bây giờ rẻ hơn nhiều so với sau khi đã có dữ liệu click thật.

ALTER TABLE link ADD COLUMN clicks INTEGER;
ALTER TABLE link ADD COLUMN clicks_updated_at TEXT;

-- Giữ lại dữ liệu đã có, nếu có.
UPDATE link
SET clicks = (
  SELECT SUM(p.clicks) FROM post p
  WHERE p.link_id = link.id AND p.clicks IS NOT NULL
)
WHERE EXISTS (
  SELECT 1 FROM post p WHERE p.link_id = link.id AND p.clicks IS NOT NULL
);

ALTER TABLE post DROP COLUMN clicks;
