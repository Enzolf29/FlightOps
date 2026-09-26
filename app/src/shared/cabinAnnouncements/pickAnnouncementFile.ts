import type { CabinAnnouncementVariant } from '../types/cabinAnnouncements'

export type DayPeriod = 'day' | 'night'

/**
 * Période de la journée à partir du TIME OF DAY de MSFS (0 aube, 1 jour, 2 crépuscule, 3 nuit) :
 * l'aube compte comme le jour, le crépuscule comme la nuit. Null si l'heure n'est pas connue.
 */
export function dayPeriodFromTimeOfDay(timeOfDay: number | null | undefined): DayPeriod | null {
  if (timeOfDay === 0 || timeOfDay === 1) return 'day'
  if (timeOfDay === 2 || timeOfDay === 3) return 'night'
  return null
}

interface PickableFile {
  id: number
  variant: CabinAnnouncementVariant
}

/**
 * Choisit au hasard le fichier à lire pour une annonce : parmi ceux de la période courante ou
 * marqués "toujours". Un fichier réservé au jour ou à la nuit ne se lit jamais hors de sa période :
 * s'il n'y en a aucun, l'annonce n'est pas jouée. Si l'heure du simulateur est inconnue, tous les
 * fichiers sont éligibles. Évite de rejouer le fichier précédent quand il y a un autre choix.
 */
export function pickAnnouncementFile<T extends PickableFile>(
  files: T[],
  period: DayPeriod | null,
  lastPlayedId: number | null = null,
  random: () => number = Math.random
): T | null {
  if (files.length === 0) return null
  let pool = period === null ? files : files.filter((file) => file.variant === 'any' || file.variant === period)
  if (pool.length === 0) return null
  if (pool.length > 1 && lastPlayedId !== null) {
    const withoutLast = pool.filter((file) => file.id !== lastPlayedId)
    if (withoutLast.length > 0) pool = withoutLast
  }
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}
