-- Enregistreur persistant : l'etat courant permet de reprendre un vol apres fermeture ou plantage,
-- tandis que les echantillons servent de boite noire et de base aux futurs graphiques/relectures.
CREATE TABLE flight_tracking_sessions (
  flight_id INTEGER PRIMARY KEY REFERENCES flights(id) ON DELETE CASCADE,
  state_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_saved_at TEXT NOT NULL,
  recovered_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE flight_telemetry_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  sim_time_iso TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude_feet REAL NOT NULL,
  altitude_agl_feet REAL NOT NULL,
  heading_true REAL NOT NULL,
  indicated_airspeed_kt REAL NOT NULL,
  ground_speed_kt REAL NOT NULL,
  vertical_speed_fpm REAL NOT NULL,
  fuel_kg REAL NOT NULL,
  on_ground INTEGER NOT NULL,
  phase TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_flight_telemetry_flight_time
  ON flight_telemetry_samples(flight_id, sim_time_iso);
