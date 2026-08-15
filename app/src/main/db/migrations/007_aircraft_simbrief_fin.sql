-- Identifiant de profil avion SimBrief ("Fleet Number"/"fin"), distinct du code OACI de type déjà présent
-- (simbrief_icao_code). Permet de faire pointer directement le préremplissage SimBrief vers un avion
-- précis de la flotte SimBrief de l'utilisateur, plutôt que juste un type générique.
ALTER TABLE aircraft ADD COLUMN simbrief_fin TEXT;
