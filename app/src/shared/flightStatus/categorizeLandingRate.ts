export type LandingRateCategory = 'very_smooth' | 'smooth' | 'normal' | 'firm' | 'hard' | 'very_hard'

export const LANDING_RATE_CATEGORY_LABEL: Record<LandingRateCategory, string> = {
  very_smooth: 'Très doux',
  smooth: 'Doux',
  normal: 'Normal',
  firm: 'Ferme',
  hard: 'Dur',
  very_hard: 'Très dur'
}

/**
 * Classe une vitesse verticale au toucher (ft/min, négative = descente) selon les tranches
 * demandées : 0 à -100 très doux, -101 à -180 doux, -181 à -250 normal, -251 à -350 ferme,
 * -351 à -500 dur, au-delà de -500 très dur.
 */
export function categorizeLandingRate(verticalSpeedFpm: number): LandingRateCategory {
  if (verticalSpeedFpm >= -100) return 'very_smooth'
  if (verticalSpeedFpm >= -180) return 'smooth'
  if (verticalSpeedFpm >= -250) return 'normal'
  if (verticalSpeedFpm >= -350) return 'firm'
  if (verticalSpeedFpm >= -500) return 'hard'
  return 'very_hard'
}
