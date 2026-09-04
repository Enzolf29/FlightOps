import { useState } from 'react'
import type { OfpDetail } from '@shared/simbrief/parseOfpDetail'
import type { Wind } from '@shared/simbrief/averageWind'
import { StatGrid } from '@renderer/components/StatGrid'
import { LoadsheetDocumentModal } from '@renderer/components/LoadsheetDocumentModal'
import { SimbriefPdfModal } from '@renderer/components/SimbriefPdfModal'
import { useCabinAnnouncementStore } from '@renderer/stores/cabinAnnouncementStore'
import type { FlightWithRelations } from '@shared/types/flight'
import {
  ClipboardIcon,
  ClockIcon,
  DollarSignIcon,
  DropletIcon,
  RouteIcon,
  ThermometerIcon,
  TrendingUpIcon,
  WindIcon
} from '@renderer/components/icons'

interface OfpSummaryPanelProps {
  ofp: OfpDetail
  flight: FlightWithRelations
}

function RouteTokens({
  route,
  sidIdent,
  starIdent,
  departureRunway,
  arrivalRunway
}: {
  route: string | null
  sidIdent: string | null
  starIdent: string | null
  departureRunway: string | null
  arrivalRunway: string | null
}) {
  const tokens = route ? route.split(/\s+/).filter(Boolean) : []
  if (tokens.length === 0 && !departureRunway && !arrivalRunway) {
    return <span className="text-muted">Route non disponible</span>
  }

  return (
    <span className="ofp-route">
      {departureRunway ? <span className="ofp-route-token ofp-route-token--runway">{departureRunway}</span> : null}
      {tokens.map((token, index) => {
        const isSidStar = (sidIdent && token === sidIdent) || (starIdent && token === starIdent)
        return (
          <span key={`${token}-${index}`} className={isSidStar ? 'ofp-route-token ofp-route-token--sidstar' : 'ofp-route-token'}>
            {token}
          </span>
        )
      })}
      {arrivalRunway ? <span className="ofp-route-token ofp-route-token--runway">{arrivalRunway}</span> : null}
    </span>
  )
}

function formatWind(wind: Wind | null): string {
  if (!wind) return '—'
  return `${Math.round(wind.dirDegrees)}° / ${Math.round(wind.speedKt)} kt`
}

export function OfpSummaryPanel({ ofp, flight }: OfpSummaryPanelProps) {
  const hasAlternate = ofp.alternate !== null
  const [tab, setTab] = useState<'destination' | 'alternate'>('destination')
  const [loadsheetOpen, setLoadsheetOpen] = useState(false)
  const [briefingPdfOpen, setBriefingPdfOpen] = useState(false)
  const finalLoadsheet = useCabinAnnouncementStore((state) => state.finalLoadsheet)
  const showAlternate = hasAlternate && tab === 'alternate'

  return (
    <div className="ofp-summary-panel">
      {hasAlternate ? (
        <div className="tabs ofp-summary-tabs">
          <button type="button" className={tab === 'destination' ? 'active' : ''} onClick={() => setTab('destination')}>
            Vers {ofp.destination?.icaoCode ?? 'destination'}
          </button>
          <button type="button" className={tab === 'alternate' ? 'active' : ''} onClick={() => setTab('alternate')}>
            Vers l’alternatif {ofp.alternate?.icaoCode}
          </button>
        </div>
      ) : null}

      {showAlternate ? (
        <>
          <div className="ofp-route-card">
            <span className="ofp-route-card-label">Route vers l’alternatif</span>
            <RouteTokens
              route={ofp.alternateRoute}
              sidIdent={null}
              starIdent={null}
              departureRunway={null}
              arrivalRunway={ofp.alternate?.planRunway ?? null}
            />
          </div>

          <StatGrid
            compact
            items={[
              {
                key: 'altCruise',
                label: 'Altitude de croisière',
                value: ofp.alternateCruiseAltitudeFeet !== null ? `FL${Math.round(ofp.alternateCruiseAltitudeFeet / 100)}` : '—',
                icon: <TrendingUpIcon />
              },
              {
                key: 'altDistance',
                label: 'Distance',
                value: ofp.alternateDistanceNm !== null ? `${ofp.alternateDistanceNm} nm` : '—',
                icon: <RouteIcon />
              },
              {
                key: 'altEte',
                label: 'Temps estimé',
                value: ofp.alternateEteMinutes !== null ? `${ofp.alternateEteMinutes} min` : '—',
                icon: <ClockIcon />
              },
              {
                key: 'altBurn',
                label: 'Carburant estimé',
                value: ofp.alternateBurn !== null ? `${Math.round(ofp.alternateBurn).toLocaleString('fr-FR')} ${ofp.loadsheet?.units ?? ''}` : '—',
                icon: <DropletIcon />
              }
            ]}
          />
        </>
      ) : (
        <>
          <div className="ofp-route-card">
            <span className="ofp-route-card-label">Route</span>
            <RouteTokens
              route={ofp.route}
              sidIdent={ofp.sidIdent}
              starIdent={ofp.starIdent}
              departureRunway={ofp.origin?.planRunway ?? null}
              arrivalRunway={ofp.destination?.planRunway ?? null}
            />
          </div>

          <StatGrid
            compact
            items={[
              {
                key: 'cruise',
                label: 'Altitude de croisière',
                value: ofp.cruiseAltitudeFeet !== null ? `FL${Math.round(ofp.cruiseAltitudeFeet / 100)}` : '—',
                icon: <TrendingUpIcon />
              },
              { key: 'ci', label: 'Cost index', value: ofp.costIndex ?? '—', icon: <DollarSignIcon /> },
              {
                key: 'distance',
                label: 'Distance',
                value: ofp.routeDistanceNm !== null ? `${ofp.routeDistanceNm} nm` : '—',
                icon: <RouteIcon />
              },
              {
                key: 'isa',
                label: 'ISA',
                value: ofp.isaDeviationCelsius !== null ? `ISA${ofp.isaDeviationCelsius >= 0 ? '+' : ''}${ofp.isaDeviationCelsius}` : '—',
                icon: <ThermometerIcon />
              },
              { key: 'windClb', label: 'AVG Wind CLB', value: formatWind(ofp.climbAvgWind), icon: <WindIcon /> },
              { key: 'windCrz', label: 'AVG Wind CRZ', value: formatWind(ofp.cruiseAvgWind), icon: <WindIcon /> },
              { key: 'windDes', label: 'AVG Wind DES', value: formatWind(ofp.descentAvgWind), icon: <WindIcon /> }
            ]}
          />
        </>
      )}

      {ofp.loadsheet || ofp.briefingPdfUrl ? (
        <div className="loadsheet-launch">
          <div className="loadsheet-launch-icon"><ClipboardIcon size={22} /></div>
          <div className="loadsheet-launch-copy">
            <strong>Documents de vol</strong>
            <span>{ofp.loadsheet ? (finalLoadsheet ? 'LoadSheet finale disponible · briefing SimBrief complet' : 'LoadSheet prévisionnelle · briefing SimBrief complet') : 'Briefing SimBrief complet'}</span>
          </div>
          {ofp.loadsheet ? (
            <span className={`loadsheet-launch-status ${finalLoadsheet ? 'loadsheet-launch-status--final' : ''}`}>
              {finalLoadsheet ? 'FINAL' : 'PRELIMINARY'}
            </span>
          ) : null}
          <div className="loadsheet-launch-actions">
            {ofp.briefingPdfUrl ? (
              <button type="button" className="secondary" onClick={() => setBriefingPdfOpen(true)}>Briefing PDF complet</button>
            ) : null}
            {ofp.loadsheet ? (
              <button type="button" className="primary" onClick={() => setLoadsheetOpen(true)}>LoadSheet</button>
            ) : null}
          </div>
          {ofp.loadsheet && loadsheetOpen ? <LoadsheetDocumentModal ofp={ofp} flight={flight} onClose={() => setLoadsheetOpen(false)} /> : null}
          {ofp.briefingPdfUrl && briefingPdfOpen ? (
            <SimbriefPdfModal
              pdfUrl={ofp.briefingPdfUrl}
              flightLabel={`${flight.flightNumber} · ${flight.departureIcao}–${flight.arrivalIcao}`}
              onClose={() => setBriefingPdfOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
