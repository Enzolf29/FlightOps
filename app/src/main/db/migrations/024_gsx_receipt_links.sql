CREATE TABLE gsx_receipt_links (
  receipt_id TEXT PRIMARY KEY,
  flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_gsx_receipt_links_flight ON gsx_receipt_links(flight_id);

CREATE TABLE gsx_receipt_exclusions (
  receipt_id TEXT PRIMARY KEY,
  excluded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
