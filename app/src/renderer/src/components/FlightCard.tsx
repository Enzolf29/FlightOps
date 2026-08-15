import type { FlightWithRelations } from '@shared/types/flight'
import { CompanyLogo } from '@renderer/components/CompanyLogo'
import { Badge } from '@renderer/components/Badge'
import { formatTime, formatDateTime, formatFlightDuration } from '@renderer/lib/format'
import { FLIGHT_STATUS_LABEL, FLIGHT_STATUS_VARIANT } from '@renderer/lib/labels'
import { AIRPORT_NAMES } from '@shared/airports/airportNames'

interface FlightCardProps {
  title: string
  flight: FlightWithRelations
  onClick?: () => void
}

export function FlightCard({ title, flight, onClick }: FlightCardProps) {
  return (
    <div
      className={'flight-card' + (onClick ? ' flight-card--clickable' : '')}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="flight-card-header">
        <span className="flight-card-title">{title}</span>
        <Badge label={FLIGHT_STATUS_LABEL[flight.status]} variant={FLIGHT_STATUS_VARIANT[flight.status]} />
      </div>

      <div className="flight-card-body">
        <CompanyLogo logoFilename={flight.company.logoFilename} icaoCode={flight.company.icaoCode} width={120} height={68} />

        <div className="flight-card-info">
          <div className="flight-card-callsign">{flight.callsignDisplay}</div>
          <div className="flight-card-number">
            Vol {flight.flightNumber} · {flight.aircraft?.type ?? 'Avion non défini'}
          </div>
        </div>
      </div>

      <div className="flight-card-route">
        <div className="flight-card-airport flight-card-airport-departure">
          <span className="flight-card-icao">{flight.departureIcao}</span>
          <span className="flight-card-airport-name">{AIRPORT_NAMES[flight.departureIcao] ?? '—'}</span>
          <span className="flight-card-time">{formatTime(flight.scheduledDeparture)}</span>
        </div>

        <div className="flight-card-route-middle">
          <span className="flight-card-duration">{formatFlightDuration(flight.scheduledDeparture, flight.scheduledArrival)}</span>
          <div className="flight-card-route-track">
            <span className="flight-card-route-dot" />
            <span className="flight-card-route-line" />
            <span className="flight-card-arrow">→</span>
          </div>
        </div>

        <div className="flight-card-airport flight-card-airport-arrival">
          <span className="flight-card-icao">{flight.arrivalIcao}</span>
          <span className="flight-card-airport-name">{AIRPORT_NAMES[flight.arrivalIcao] ?? '—'}</span>
          <span className="flight-card-time">{formatTime(flight.scheduledArrival)}</span>
        </div>
      </div>

      <div className="flight-card-scheduled">Départ prévu {formatDateTime(flight.scheduledDeparture)}</div>
    </div>
  )
}
