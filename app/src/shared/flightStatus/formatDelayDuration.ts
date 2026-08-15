/**
 * Formate un écart en minutes (retard ou avance) : "00 minutes" en dessous d'une heure,
 * "01h05" à partir d'une heure pleine — convention demandée pour l'affichage PIREP.
 */
export function formatDelayDuration(minutes: number): string {
  const totalMinutes = Math.round(Math.abs(minutes))
  if (totalMinutes < 60) {
    return `${String(totalMinutes).padStart(2, '0')} minutes`
  }
  const hours = Math.floor(totalMinutes / 60)
  const remainder = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}h${String(remainder).padStart(2, '0')}`
}
