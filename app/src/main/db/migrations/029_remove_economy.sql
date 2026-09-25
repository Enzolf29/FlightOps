-- Retrait du mode économie : les charges (passagers, fret) viennent désormais de SimBrief.
-- Les frais GSX (gsx_receipts) sont conservés à titre indicatif.
DROP TABLE IF EXISTS flight_economy;
DROP TABLE IF EXISTS route_prices;

ALTER TABLE companies DROP COLUMN pricing_tier;
ALTER TABLE companies DROP COLUMN baggage_price_eur;

ALTER TABLE aircraft DROP COLUMN seat_capacity;
ALTER TABLE aircraft DROP COLUMN cargo_capacity_kg;
