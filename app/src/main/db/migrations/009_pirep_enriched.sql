-- PIREP enrichi : heures moteurs (démarrage/coupure), stats d'atterrissage, carburant aux 4 jalons,
-- trajectoire réellement volée, profil d'approche et journal d'évènements complet du vol.

ALTER TABLE pireps ADD COLUMN engine_start_time TEXT;
ALTER TABLE pireps ADD COLUMN engine_stop_time TEXT;
ALTER TABLE pireps ADD COLUMN block_time_minutes REAL;

ALTER TABLE pireps ADD COLUMN touchdown_vertical_speed_fpm REAL;
ALTER TABLE pireps ADD COLUMN touchdown_g_force REAL;
ALTER TABLE pireps ADD COLUMN touchdown_pitch_degrees REAL;
ALTER TABLE pireps ADD COLUMN touchdown_bank_degrees REAL;

ALTER TABLE pireps ADD COLUMN fuel_at_engine_start_lbs REAL;
ALTER TABLE pireps ADD COLUMN fuel_at_takeoff_lbs REAL;
ALTER TABLE pireps ADD COLUMN fuel_at_touchdown_lbs REAL;
ALTER TABLE pireps ADD COLUMN fuel_at_engine_stop_lbs REAL;

ALTER TABLE pireps ADD COLUMN flight_path_json TEXT;
ALTER TABLE pireps ADD COLUMN approach_profile_json TEXT;
ALTER TABLE pireps ADD COLUMN events_json TEXT;
