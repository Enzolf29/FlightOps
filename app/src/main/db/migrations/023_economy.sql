ALTER TABLE companies ADD COLUMN pricing_tier TEXT NOT NULL DEFAULT 'classic' CHECK (pricing_tier IN ('low_cost', 'classic', 'premium'));

ALTER TABLE aircraft ADD COLUMN seat_capacity INTEGER NOT NULL DEFAULT 150;
ALTER TABLE aircraft ADD COLUMN cargo_capacity_kg INTEGER NOT NULL DEFAULT 2000;

CREATE TABLE route_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  departure_icao TEXT NOT NULL,
  arrival_icao TEXT NOT NULL,
  ticket_price_min_eur REAL NOT NULL,
  ticket_price_max_eur REAL NOT NULL,
  cargo_price_min_eur_per_kg REAL NOT NULL,
  cargo_price_max_eur_per_kg REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, departure_icao, arrival_icao)
);
CREATE INDEX idx_route_prices_company ON route_prices(company_id);

CREATE TABLE flight_economy (
  flight_id INTEGER PRIMARY KEY REFERENCES flights(id) ON DELETE CASCADE,
  ticket_price_eur REAL NOT NULL,
  cargo_price_eur_per_kg REAL NOT NULL,
  reference_ticket_price_eur REAL NOT NULL,
  reference_cargo_price_eur_per_kg REAL NOT NULL,
  passengers_sold INTEGER,
  cargo_kg_sold REAL,
  revenue_eur REAL
);
