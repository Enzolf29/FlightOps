-- Les versions antérieures à 1.0.10 envoyaient l'heure UTC à SimBrief mais formataient la date
-- dans le fuseau local. Après minuit en France, certains vols étaient donc enregistrés exactement
-- un jour trop tard. On ne corrige que les vols terminés dont le planning est manifestement situé
-- 18 à 30 heures APRÈS le départ réellement observé : un retard normal ne peut pas correspondre à
-- cette situation et les vols à venir ne sont jamais modifiés.
CREATE TEMP TABLE flightops_shifted_schedule_day AS
SELECT f.id
FROM flights f
JOIN pireps p ON p.flight_id = f.id
WHERE f.status = 'completed'
  AND p.actual_departure_time IS NOT NULL
  AND (julianday(f.scheduled_departure) - julianday(p.actual_departure_time)) BETWEEN 0.75 AND 1.25;

UPDATE flights
SET scheduled_departure = datetime(scheduled_departure, '-1 day'),
    scheduled_arrival = datetime(scheduled_arrival, '-1 day'),
    updated_at = datetime('now')
WHERE id IN (SELECT id FROM flightops_shifted_schedule_day);

UPDATE pireps
SET delay_minutes = ROUND(
      (julianday(actual_departure_time) - julianday(
        (SELECT scheduled_departure FROM flights WHERE flights.id = pireps.flight_id)
      )) * 1440
    ),
    delay_bucket = CASE
      WHEN ROUND(
        (julianday(actual_departure_time) - julianday(
          (SELECT scheduled_departure FROM flights WHERE flights.id = pireps.flight_id)
        )) * 1440
      ) <= 10 THEN 'on_time'
      WHEN ROUND(
        (julianday(actual_departure_time) - julianday(
          (SELECT scheduled_departure FROM flights WHERE flights.id = pireps.flight_id)
        )) * 1440
      ) <= 60 THEN 'delayed_10_60'
      ELSE 'delayed_60_plus'
    END
WHERE flight_id IN (SELECT id FROM flightops_shifted_schedule_day);

DROP TABLE flightops_shifted_schedule_day;
