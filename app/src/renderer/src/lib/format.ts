import { formatInTimeZone } from 'date-fns-tz'
import { parseUtc } from '@shared/lib/datetime'

export { parseUtc }

export function formatDateTime(datetime: string): string {
  return formatInTimeZone(parseUtc(datetime), 'UTC', 'dd/MM HH:mm') + ' UTC'
}

export function formatTime(datetime: string): string {
  return formatInTimeZone(parseUtc(datetime), 'UTC', 'HH:mm') + ' UTC'
}

export function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  return `${wholeHours}h${String(minutes).padStart(2, '0')}`
}

export function formatFlightDuration(scheduledDeparture: string, scheduledArrival: string): string {
  const minutesTotal = Math.round((parseUtc(scheduledArrival).getTime() - parseUtc(scheduledDeparture).getTime()) / 60000)
  const hours = Math.floor(minutesTotal / 60)
  const minutes = minutesTotal % 60
  return `${hours}h${String(minutes).padStart(2, '0')}`
}

export function formatEur(amount: number): string {
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

const NM_TO_KM = 1.852
const EARTH_CIRCUMFERENCE_NM = 21639

export function formatDistanceKm(distanceNm: number): string {
  return `${Math.round(distanceNm * NM_TO_KM).toLocaleString('fr-FR')} km`
}

export function formatDistanceNm(distanceNm: number): string {
  return `${Math.round(distanceNm).toLocaleString('fr-FR')} NM`
}

/** Distance exprimée en tours de la Terre (équateur ≈ 40 075 km). */
export function formatEarthLaps(distanceNm: number): string {
  const laps = distanceNm / EARTH_CIRCUMFERENCE_NM
  const value = laps.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value} tour${laps >= 2 ? 's' : ''} de la Terre`
}

export function formatFuelKg(fuelKg: number): string {
  return `${Math.round(fuelKg).toLocaleString('fr-FR')} kg`
}
