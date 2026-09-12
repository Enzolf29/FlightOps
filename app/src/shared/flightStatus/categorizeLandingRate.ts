export type LandingRateCategory = 'very_smooth' | 'smooth' | 'normal' | 'firm' | 'hard' | 'very_hard'

export const LANDING_RATE_CATEGORY_LABEL: Record<LandingRateCategory, string> = {
  very_smooth: 'Très doux',
  smooth: 'Doux',
  normal: 'Normal',
  firm: 'Ferme',
  hard: 'Dur',
  very_hard: 'Très dur'
}

/** Borne basse (ft/min, incluse) de chaque tranche — voir categorizeLandingRate. `very_hard` n'a pas
 * de borne basse (tout ce qui est en dessous de la borne de `hard`). Source unique de vérité pour
 * l'affichage du barème (voir LandingRateScaleInfo), pour ne pas dupliquer ces valeurs en dur. */
export const LANDING_RATE_CATEGORY_FLOOR_FPM: Record<Exclude<LandingRateCategory, 'very_hard'>, number> = {
  very_smooth: -100,
  smooth: -180,
  normal: -250,
  firm: -350,
  hard: -500
}

/**
 * Classe une vitesse verticale au toucher (ft/min, négative = descente) selon les tranches
 * demandées : 0 à -100 très doux, -101 à -180 doux, -181 à -250 normal, -251 à -350 ferme,
 * -351 à -500 dur, au-delà de -500 très dur.
 */
export function categorizeLandingRate(verticalSpeedFpm: number): LandingRateCategory {
  if (verticalSpeedFpm >= LANDING_RATE_CATEGORY_FLOOR_FPM.very_smooth) return 'very_smooth'
  if (verticalSpeedFpm >= LANDING_RATE_CATEGORY_FLOOR_FPM.smooth) return 'smooth'
  if (verticalSpeedFpm >= LANDING_RATE_CATEGORY_FLOOR_FPM.normal) return 'normal'
  if (verticalSpeedFpm >= LANDING_RATE_CATEGORY_FLOOR_FPM.firm) return 'firm'
  if (verticalSpeedFpm >= LANDING_RATE_CATEGORY_FLOOR_FPM.hard) return 'hard'
  return 'very_hard'
}
