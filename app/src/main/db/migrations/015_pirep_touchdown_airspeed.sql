-- Vitesse indiquée de l'avion au moment exact du toucher des roues (statistiques d'atterrissage).

ALTER TABLE pireps ADD COLUMN touchdown_airspeed_kt REAL;
