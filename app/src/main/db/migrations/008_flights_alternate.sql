-- Aéroport alternatif du plan de vol (déposé par SimBrief), affiché/METAR-isable sur la page Suivi en direct.
ALTER TABLE flights ADD COLUMN alternate_icao TEXT;
