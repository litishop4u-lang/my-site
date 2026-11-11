INSERT INTO settings (key, value) VALUES
  ('site_name', 'Tên Thương Hiệu'),
  ('phone', '0900000000'),
  ('zalo', '0900000000'),
  ('email', 'info@tenmien.com'),
  ('address', 'Số 1, Đường ABC, Quận X, TP.HCM'),
  ('logo', ''),
  ('hero_title', 'Tên thương hiệu'),
  ('hero_subtitle', 'Xe đạp điện trợ lực'),
  ('hero_text', 'Chuyên cung cấp xe đạp điện chính hãng. Uy tín – Chất lượng – Dịch vụ tốt.'),
  ('hero_image', '');

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Xe đạp điện trợ lực', 'xe-dap-dien-tro-luc', 1),
  ('Xe đạp điện gấp gọn', 'xe-dap-dien-gap-gon', 2);

INSERT INTO brands (name, slug) VALUES
  ('Coswheel', 'coswheel'),
  ('Lemmo', 'lemmo'),
  ('Niu', 'niu');

INSERT INTO products (name, slug, sku, category_id, brand_id, price, old_price, description) VALUES
  ('Xe Đạp Điện Trợ Lực Mẫu 1', 'xe-dap-dien-tro-luc-mau-1', 'SP001',
   (SELECT id FROM categories WHERE slug = 'xe-dap-dien-tro-luc'),
   (SELECT id FROM brands WHERE slug = 'coswheel'), 37000000, 0,
   'Mô tả sản phẩm mẫu. Bạn sửa nội dung này trong trang quản trị.'),
  ('Xe Đạp Điện Trợ Lực Mẫu 2', 'xe-dap-dien-tro-luc-mau-2', 'SP002',
   (SELECT id FROM categories WHERE slug = 'xe-dap-dien-tro-luc'),
   (SELECT id FROM brands WHERE slug = 'niu'), 24500000, 35000000,
   'Mô tả sản phẩm mẫu. Bạn sửa nội dung này trong trang quản trị.'),
  ('Xe Đạp Điện Gấp Gọn Mẫu 3', 'xe-dap-dien-gap-gon-mau-3', 'SP003',
   (SELECT id FROM categories WHERE slug = 'xe-dap-dien-gap-gon'),
   (SELECT id FROM brands WHERE slug = 'lemmo'), 37000000, 42000000,
   'Mô tả sản phẩm mẫu. Bạn sửa nội dung này trong trang quản trị.'),
  ('Xe Đạp Điện Gấp Gọn Mẫu 4', 'xe-dap-dien-gap-gon-mau-4', 'SP004',
   (SELECT id FROM categories WHERE slug = 'xe-dap-dien-gap-gon'),
   (SELECT id FROM brands WHERE slug = 'lemmo'), 21000000, 24000000,
   'Mô tả sản phẩm mẫu. Bạn sửa nội dung này trong trang quản trị.');