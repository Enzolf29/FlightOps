ALTER TABLE cabin_announcement_files
ADD COLUMN volume REAL NOT NULL DEFAULT 1 CHECK (volume >= 0 AND volume <= 1);
