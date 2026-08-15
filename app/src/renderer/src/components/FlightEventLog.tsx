import type { FlightEvent, FlightEventType } from '@shared/flightStatus/evaluateFlightEvents'
import { formatInTimeZone } from 'date-fns-tz'
import { parseUtc } from '@shared/lib/datetime'

const EVENT_ICON: Record<FlightEventType, string> = {
  aircraft: '✈️',
  takeoff: '🛫',
  landing: '🛬',
  hard_landing: '⚠️',
  taxi_out: '🚕',
  taxi_in: '🚕',
  flaps: '🔧',
  gear: '⚙️',
  ground_overspeed: '⚠️',
  ground_overspeed_end: '✅',
  bank_angle: '⚠️',
  engine_start: '🔥',
  engine_stop: '🛑',
  lights: '💡',
  cruise: '☁️',
  descent: '📉',
  altitude_level: '🎚️',
  air_overspeed: '⚠️',
  air_overspeed_end: '✅'
}

interface FlightEventLogProps {
  events: FlightEvent[]
}

export function FlightEventLog({ events }: FlightEventLogProps) {
  if (events.length === 0) {
    return <p className="empty-hint">Aucun évènement enregistré pour l’instant.</p>
  }

  const ordered = [...events].reverse()

  return (
    <div className="event-log">
      {ordered.map((event, index) => (
        <div key={`${event.simTimeIso}-${index}`} className={`event-log-row ${event.severity === 'warning' ? 'event-log-row--warning' : ''}`}>
          <span className="event-log-icon">{EVENT_ICON[event.type]}</span>
          <span className="event-log-message">{event.message}</span>
          <span className="event-log-time">{formatInTimeZone(parseUtc(event.simTimeIso), 'UTC', 'HH:mm:ss')}</span>
        </div>
      ))}
    </div>
  )
}
