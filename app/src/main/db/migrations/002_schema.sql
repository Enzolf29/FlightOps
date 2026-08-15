CREATE TABLE ranks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  min_hours REAL NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icao_code TEXT NOT NULL UNIQUE,
  iata_code TEXT NOT NULL,
  radio_callsign TEXT NOT NULL,
  display_name TEXT NOT NULL,
  logo_filename TEXT NOT NULL,
  callsign_pattern TEXT NOT NULL DEFAULT 'XXX0000'
    CHECK (callsign_pattern IN ('XXX0000','XXX000','XXX00AB','XXX00A')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE aircraft (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  registration TEXT,
  simbrief_icao_code TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE flights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  aircraft_id INTEGER REFERENCES aircraft(id),
  flight_number TEXT NOT NULL,
  callsign TEXT NOT NULL,
  callsign_display TEXT NOT NULL,
  departure_icao TEXT NOT NULL,
  arrival_icao TEXT NOT NULL,
  scheduled_departure TEXT NOT NULL,
  scheduled_arrival TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','in_progress','completed','cancelled')),
  source TEXT NOT NULL CHECK (source IN ('manual','simbrief','real_world_api')),
  simbrief_ofp_json TEXT,
  route TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_flights_status ON flights(status);
CREATE INDEX idx_flights_scheduled_departure ON flights(scheduled_departure);

CREATE TABLE pireps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id INTEGER NOT NULL UNIQUE REFERENCES flights(id) ON DELETE CASCADE,
  actual_departure_time TEXT,
  actual_arrival_time TEXT,
  flight_time_minutes REAL,
  delay_minutes REAL,
  delay_bucket TEXT CHECK (delay_bucket IN ('on_time','delayed_10_60','delayed_60_plus')),
  landing_vspeed_fpm REAL,
  fuel_used_kg REAL,
  remarks TEXT,
  telemetry_summary_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
