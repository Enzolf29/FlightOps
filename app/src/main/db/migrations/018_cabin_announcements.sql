CREATE TABLE cabin_announcement_files (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  announcement_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (company_id, announcement_type)
);
