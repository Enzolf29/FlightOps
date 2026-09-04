import { cancelExpiredUpcomingFlights } from './db/repositories/flightRepository'

const REFRESH_INTERVAL_MS = 60_000
let timer: ReturnType<typeof setInterval> | null = null

/** Applique la règle même si l'utilisateur reste longtemps sur une page sans action. */
export function startFlightStatusScheduler(): void {
  cancelExpiredUpcomingFlights()
  if (timer) return
  timer = setInterval(() => cancelExpiredUpcomingFlights(), REFRESH_INTERVAL_MS)
}

export function stopFlightStatusScheduler(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
}
