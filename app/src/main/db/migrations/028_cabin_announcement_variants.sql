-- Plusieurs fichiers par annonce (tirés au hasard à la lecture) et variante jour/nuit : la clé
-- primaire (compagnie, type) ne le permet plus, la table est donc recréée avec un identifiant propre.
CREATE TABLE cabin_announcement_files_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  announcement_type TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'any' CHECK (variant IN ('any', 'day', 'night')),
  file_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  volume REAL NOT NULL DEFAULT 1 CHECK (volume >= 0 AND volume <= 1)
);

INSERT INTO cabin_announcement_files_new (company_id, announcement_type, variant, file_path, original_filename, updated_at, volume)
SELECT company_id, announcement_type, 'any', file_path, original_filename, updated_at, volume
FROM cabin_announcement_files;

DROP TABLE cabin_announcement_files;
ALTER TABLE cabin_announcement_files_new RENAME TO cabin_announcement_files;
CREATE INDEX idx_cabin_announcement_files_lookup ON cabin_announcement_files(company_id, announcement_type);

-- Annonces de base déjà copiées chez le joueur (y compris celles qu'il a ensuite supprimées) : sans
-- cette mémoire, une annonce supprimée reviendrait à chaque démarrage.
CREATE TABLE cabin_announcement_seeded (
  bundled_key TEXT PRIMARY KEY
);
