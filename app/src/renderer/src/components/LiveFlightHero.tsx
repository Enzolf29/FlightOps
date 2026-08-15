import type { FlightWithRelations } from '@shared/types/flight'
import type { DelayBucket } from '@shared/types/pirep'
import { CompanyLogo } from '@renderer/components/CompanyLogo'
import { Badge } from '@renderer/components/Badge'
import { PlaneRightIcon } from '@renderer/components/icons'
import { AIRPORT_NAMES } from '@shared/airports/airportNames'
import { formatFlightDuration, formatTime } from '@renderer/lib/format'
import { DELAY_BUCKET_LABEL, DELAY_BUCKET_VARIANT, FLIGHT_STATUS_LABEL, FLIGHT_STATUS_VARIANT } from '@renderer/lib/labels'

interface LiveFlightHeroProps {
  flight: FlightWithRelations
  punctuality: DelayBucket
  /** 0 (au départ) à 1 (arrivé) — basé sur la position réelle quand elle est connue. */
  progress: number
}

export function LiveFlightHero({ flight, punctuality, progress }: LiveFlightHeroProps) {
  return (
    <div className="live-hero-card">
      <div className="live-hero-top">
        <CompanyLogo logoFilename={flight.company.logoFilename} icaoCode={flight.company.icaoCode} width={110} height={64} />
        <div className="live-hero-identity">
          <span className="live-hero-callsign">{flight.callsignDisplay}</span>
          <span className="live-hero-subtitle">
            Vol {flight.flightNumber} · {flight.aircraft?.type ?? 'Avion non défini'}
            {flight.aircraft?.registration ? ` · ${flight.aircraft.registration}` : ''}
          </span>
        </div>
        <div className="live-hero-badges">
          <Badge label={FLIGHT_STATUS_LABEL[flight.status]} variant={FLIGHT_STATUS_VARIANT[flight.status]} />
          <Badge label={DELAY_BUCKET_LABEL[punctuality]} variant={DELAY_BUCKET_VARIANT[punctuality]} />
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
            <span className="flight-card-route-plane" style={{ left: `${progress * 100}%` }}>
              <PlaneRightIcon />
            </span>
          </div>
          {flight.alternateIcao ? (
            <span className="live-hero-alternate-below">
              <strong>{flight.alternateIcao}</strong> {AIRPORT_NAMES[flight.alternateIcao] ?? ''}
            </span>
          ) : null}
        </div>

        <div className="flight-card-airport flight-card-airport-arrival">
          <span className="flight-card-icao">{flight.arrivalIcao}</span>
          <span className="flight-card-airport-name">{AIRPORT_NAMES[flight.arrivalIcao] ?? '—'}</span>
          <span className="flight-card-time">{formatTime(flight.scheduledArrival)}</span>
        </div>
      </div>
    </div>
  )
}
