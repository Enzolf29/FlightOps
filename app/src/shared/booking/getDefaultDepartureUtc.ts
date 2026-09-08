const DEFAULT_DEPARTURE_OFFSET_MINUTES = 40

export interface DefaultDepartureUtc {
  date: string
  time: string
}

/** Date et heure UTC proposées à la réservation, quarante minutes après l'instant courant. */
export function getDefaultDepartureUtc(
  now: Date = new Date(),
  offsetMinutes = DEFAULT_DEPARTURE_OFFSET_MINUTES
): DefaultDepartureUtc {
  const departure = new Date(now.getTime() + offsetMinutes * 60_000)
  const iso = departure.toISOString()

  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16)
  }
}
