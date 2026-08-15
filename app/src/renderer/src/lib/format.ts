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
