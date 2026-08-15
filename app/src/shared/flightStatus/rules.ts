/**
 * Règle métier : au-delà de ce seuil de retard, un vol n'est plus considéré "en retard"
 * mais passe automatiquement au statut "cancelled". À appliquer par le détecteur de statut
 * de vol (SimConnect, Phase 5) et par la logique de réservation (Phase 3).
 */
export const AUTO_CANCEL_DELAY_MINUTES = 180
