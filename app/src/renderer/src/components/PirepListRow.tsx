import type { PirepWithFlight } from '@shared/types/pirep'
import { CompanyLogo } from '@renderer/components/CompanyLogo'
import { Badge } from '@renderer/components/Badge'
import { formatDateTime } from '@renderer/lib/format'
import { DELAY_BUCKET_LABEL, DELAY_BUCKET_VARIANT } from '@renderer/lib/labels'
import { getAirportLabel } from '@shared/airports/airportNames'

interface PirepListRowProps {
  pirep: PirepWithFlight
  onClick?: () => void
}

export function PirepListRow({ pirep, onClick }: PirepListRowProps) {
  const { flight } = pirep

  return (
    <div className={'list-row' + (onClick ? ' list-row-clickable' : '')} onClick={onClick}>
      <CompanyLogo logoFilename={flight.company.logoFilename} icaoCode={flight.company.icaoCode} width={88} height={52} />
      <div className="list-row-main">
        <span className="list-row-title">
          {flight.callsignDisplay} · {getAirportLabel(flight.departureIcao)} → {getAirportLabel(flight.arrivalIcao)}
        </span>
        <span className="list-row-subtitle">
          Vol {flight.flightNumber}
          {pirep.actualArrivalTime ? ` · ${formatDateTime(pirep.actualArrivalTime)}` : ''}
        </span>
      </div>
      {pirep.delayBucket ? (
        <Badge label={DELAY_BUCKET_LABEL[pirep.delayBucket]} variant={DELAY_BUCKET_VARIANT[pirep.delayBucket]} />
      ) : null}
    </div>
  )
}
