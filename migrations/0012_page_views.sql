CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  event TEXT NOT NULL DEFAULT 'view',
  path TEXT NOT NULL,
  product_id INTEGER,
  visitor TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'direct',
  device TEXT NOT NULL DEFAULT 'desktop',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pv_day ON page_views (day, event);
CREATE INDEX IF NOT EXISTS idx_pv_product ON page_views (product_id, day);