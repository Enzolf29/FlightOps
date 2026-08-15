ALTER TABLE pilot ADD COLUMN aerodatabox_api_key TEXT;

CREATE TABLE real_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  departure_icao TEXT NOT NULL,
  arrival_icao TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('api', 'reciprocal')),
  typical_duration_minutes REAL,
  last_fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, departure_icao, arrival_icao)
);
CREATE INDEX idx_real_routes_lookup ON real_routes(company_id, departure_icao);

CREATE TABLE real_route_aircraft (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  real_route_id INTEGER NOT NULL REFERENCES real_routes(id) ON DELETE CASCADE,
  icao_type TEXT NOT NULL,
  type_description TEXT NOT NULL,
  UNIQUE (real_route_id, icao_type)
);

CREATE TABLE real_route_flight_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  real_route_id INTEGER NOT NULL REFERENCES real_routes(id) ON DELETE CASCADE,
  flight_number TEXT NOT NULL,
  observed_at TEXT,
  UNIQUE (real_route_id, flight_number)
);
