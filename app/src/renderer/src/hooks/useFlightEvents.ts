import { useEffect, useState } from 'react'
import type { FlightEvent } from '@shared/flightStatus/evaluateFlightEvents'

/** `resetKey` (l'id du vol armé) force un nouveau chargement de l'historique quand le vol suivi change. */
export function useFlightEvents(resetKey: number | null): FlightEvent[] {
  const [events, setEvents] = useState<FlightEvent[]>([])

  useEffect(() => {
    let cancelled = false
    window.flightops.simconnect.getFlightEvents().then((initial) => {
      if (!cancelled) setEvents(initial)
    })
    const unsubscribe = window.flightops.simconnect.onFlightEvent((event) => {
      setEvents((previous) => [...previous, event])
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [resetKey])

  return events
}
