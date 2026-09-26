-- Annonces livrées avec l'application (fichiers copiés sous le nom "<type>-bundled-...") :
-- volume par défaut à 50 % (uniquement celles restées au volume d'origine, pour ne pas écraser un
-- réglage du joueur) et Cabin Dim Takeoff réservé à la nuit.
UPDATE cabin_announcement_files SET volume = 0.5 WHERE file_path LIKE '%-bundled-%' AND volume = 1;
UPDATE cabin_announcement_files SET variant = 'night' WHERE announcement_type = 'cabin_dim_takeoff' AND file_path LIKE '%-bundled-%';
