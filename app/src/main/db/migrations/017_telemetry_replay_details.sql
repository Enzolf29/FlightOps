ALTER TABLE flight_telemetry_samples ADD COLUMN bank_degrees REAL NOT NULL DEFAULT 0;
ALTER TABLE flight_telemetry_samples ADD COLUMN pitch_degrees REAL NOT NULL DEFAULT 0;
ALTER TABLE flight_telemetry_samples ADD COLUMN gear_down INTEGER NOT NULL DEFAULT 0;
ALTER TABLE flight_telemetry_samples ADD COLUMN flaps_index REAL NOT NULL DEFAULT 0;
ALTER TABLE flight_telemetry_samples ADD COLUMN landing_lights_on INTEGER NOT NULL DEFAULT 0;
