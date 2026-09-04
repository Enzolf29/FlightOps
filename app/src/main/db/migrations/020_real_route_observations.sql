CREATE TABLE real_route_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  real_route_id INTEGER NOT NULL REFERENCES real_routes(id) ON DELETE CASCADE,
  observation_key TEXT NOT NULL,
  aircraft_icao_type TEXT,
  observed_at TEXT NOT NULL,
  inferred INTEGER NOT NULL DEFAULT 0 CHECK (inferred IN (0, 1)),
  UNIQUE (real_route_id, observation_key)
);

CREATE INDEX idx_real_route_observations_route
ON real_route_observations(real_route_id, observed_at DESC);
