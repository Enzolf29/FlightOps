-- La compagnie 023 avait mis 'classic' par défaut pour toutes les compagnies existantes ; on
-- corrige ici celles réellement low-cost dans le vrai monde (les compagnies ajoutées après coup
-- gardent le choix fait à leur création).
UPDATE companies SET pricing_tier = 'low_cost' WHERE icao_code IN ('RYR', 'TRA', 'TVF', 'VOE', 'VLG', 'BTI', 'EJU');
