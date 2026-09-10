-- Regroupe les variantes Embraer dans les deux familles utilisées par le navigateur de vols
-- réels. Les anciennes versions pouvaient enregistrer E170/E175 (ou E190/E195/E2) sous des clés
-- distinctes, parfois même sous leur libellé, ce qui créait deux filtres identiques et séparait
-- artificiellement leurs routes.
CREATE TEMP TABLE flightops_embraer_aircraft_groups AS
SELECT
  id,
  real_route_id,
  CASE
    WHEN UPPER(TRIM(icao_type)) IN ('E170', 'E175', 'E75L', 'E75S', 'EMBRAER 170', 'EMBRAER 175')
      OR UPPER(type_description) LIKE '%EMBRAER 170%'
      OR UPPER(type_description) LIKE '%EMBRAER 175%'
      THEN 'E170'
    WHEN UPPER(TRIM(icao_type)) IN ('E190', 'E195', 'E290', 'E295', 'EMBRAER 190', 'EMBRAER 195')
      OR UPPER(type_description) LIKE '%EMBRAER 190%'
      OR UPPER(type_description) LIKE '%EMBRAER 195%'
      THEN 'E190'
    ELSE NULL
  END AS family_icao
FROM real_route_aircraft;

INSERT OR IGNORE INTO real_route_aircraft (real_route_id, icao_type, type_description)
SELECT DISTINCT
  real_route_id,
  family_icao,
  CASE family_icao WHEN 'E170' THEN 'Embraer 170' ELSE 'Embraer 190' END
FROM flightops_embraer_aircraft_groups
WHERE family_icao IS NOT NULL;

DELETE FROM real_route_aircraft
WHERE id IN (
  SELECT id
  FROM flightops_embraer_aircraft_groups
  WHERE family_icao IS NOT NULL AND UPPER(TRIM(icao_type)) <> family_icao
);

UPDATE real_route_aircraft
SET type_description = CASE icao_type WHEN 'E170' THEN 'Embraer 170' ELSE 'Embraer 190' END
WHERE icao_type IN ('E170', 'E190');

UPDATE real_route_observations
SET aircraft_icao_type = CASE
  WHEN UPPER(TRIM(aircraft_icao_type)) IN ('E170', 'E175', 'E75L', 'E75S', 'EMBRAER 170', 'EMBRAER 175') THEN 'E170'
  WHEN UPPER(TRIM(aircraft_icao_type)) IN ('E190', 'E195', 'E290', 'E295', 'EMBRAER 190', 'EMBRAER 195') THEN 'E190'
  ELSE aircraft_icao_type
END
WHERE aircraft_icao_type IS NOT NULL;

DROP TABLE flightops_embraer_aircraft_groups;

