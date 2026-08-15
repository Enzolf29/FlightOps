CREATE TABLE airport_coordinates (
  icao_code TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
