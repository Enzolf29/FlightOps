-- Le carburant doit être affiché en kg (unité standard aviation), pas en lbs. La télémétrie
-- SimConnect demande désormais directement "kilograms", donc ces colonnes sont renommées pour
-- refléter honnêtement l'unité réellement stockée.
ALTER TABLE pireps RENAME COLUMN fuel_at_engine_start_lbs TO fuel_at_engine_start_kg;
ALTER TABLE pireps RENAME COLUMN fuel_at_takeoff_lbs TO fuel_at_takeoff_kg;
ALTER TABLE pireps RENAME COLUMN fuel_at_touchdown_lbs TO fuel_at_touchdown_kg;
ALTER TABLE pireps RENAME COLUMN fuel_at_engine_stop_lbs TO fuel_at_engine_stop_kg;
