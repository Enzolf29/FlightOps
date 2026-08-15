-- SQLite ne permet pas de modifier une contrainte CHECK en place : on recrée la table.
CREATE TABLE companies_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icao_code TEXT NOT NULL UNIQUE,
  iata_code TEXT NOT NULL,
  radio_callsign TEXT NOT NULL,
  display_name TEXT NOT NULL,
  logo_filename TEXT NOT NULL,
  callsign_pattern TEXT NOT NULL DEFAULT 'XXX0000'
    CHECK (callsign_pattern IN ('XXX0000','XXX000','XXX00AB','XXX00A','RANDOM')),
  active INTEGER NOT NULL DEFAULT 1
);

INSERT INTO companies_new (id, icao_code, iata_code, radio_callsign, display_name, logo_filename, callsign_pattern, active)
SELECT id, icao_code, iata_code, radio_callsign, display_name, logo_filename, callsign_pattern, active FROM companies;

DROP TABLE companies;

ALTER TABLE companies_new RENAME TO companies;
