import type { ReactNode } from 'react'
import type { FlightWithRelations } from '@shared/types/flight'
import { CompanyLogo } from '@renderer/components/CompanyLogo'
import { Badge } from '@renderer/components/Badge'
import { formatDateTime } from '@renderer/lib/format'
import { FLIGHT_STATUS_LABEL, FLIGHT_STATUS_VARIANT } from '@renderer/lib/labels'
import { getAirportLabel } from '@shared/airports/airportNames'

interface FlightListRowProps {
  flight: FlightWithRelations
  actions?: ReactNode
}

export function FlightListRow({ flight, actions }: FlightListRowProps) {
  return (
    <div className="list-row">
      <CompanyLogo logoFilename={flight.company.logoFilename} icaoCode={flight.company.icaoCode} width={88} height={52} />
      <div className="list-row-main">
        <span className="list-row-title">
          {flight.callsignDisplay} · {getAirportLabel(flight.departureIcao)} → {getAirportLabel(flight.arrivalIcao)}
        </span>
        <span className="list-row-subtitle">
          Vol {flight.flightNumber} · {flight.aircraft?.type ?? 'Avion non défini'} · {formatDateTime(flight.scheduledDeparture)}
        </span>
      </div>
      <Badge label={FLIGHT_STATUS_LABEL[flight.status]} variant={FLIGHT_STATUS_VARIANT[flight.status]} />
      {actions ? <span className="fleet-table-actions">{actions}</span> : null}
    </div>
  )
}
