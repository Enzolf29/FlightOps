ALTER TABLE companies ADD COLUMN baggage_price_eur REAL NOT NULL DEFAULT 25;

ALTER TABLE route_prices DROP COLUMN cargo_price_min_eur_per_kg;
ALTER TABLE route_prices DROP COLUMN cargo_price_max_eur_per_kg;

ALTER TABLE flight_economy DROP COLUMN cargo_price_eur_per_kg;
ALTER TABLE flight_economy DROP COLUMN reference_cargo_price_eur_per_kg;
ALTER TABLE flight_economy DROP COLUMN cargo_kg_sold;
ALTER TABLE flight_economy ADD COLUMN baggage_price_eur REAL NOT NULL DEFAULT 0;
ALTER TABLE flight_economy ADD COLUMN checked_bags_sold INTEGER;
