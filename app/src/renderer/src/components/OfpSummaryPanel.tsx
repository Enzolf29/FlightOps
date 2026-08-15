import { useState } from 'react'
import type { OfpDetail } from '@shared/simbrief/parseOfpDetail'
import type { Wind } from '@shared/simbrief/averageWind'
import { StatGrid } from '@renderer/components/StatGrid'
import {
  ClockIcon,
  DollarSignIcon,
  DropletIcon,
  PackageIcon,
  RouteIcon,
  ThermometerIcon,
  TrendingUpIcon,
  UsersIcon,
  WeightIcon,
  WindIcon
} from '@renderer/components/icons'

interface OfpSummaryPanelProps {
  ofp: OfpDetail
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

function formatWeight(value: number | null, units: 'kgs' | 'lbs'): string {
  if (value === null) return '—'
  return `${Math.round(value).toLocaleString('fr-FR')} ${units}`
}

function formatWeightRange(estimated: number | null, max: number | null, units: 'kgs' | 'lbs'): string {
  return `${formatWeight(estimated, units)} / ${formatWeight(max, units)}`
}

function formatWind(wind: Wind | null): string {
  if (!wind) return '—'
  return `${Math.round(wind.dirDegrees)}° / ${Math.round(wind.speedKt)} kt`
}

export function OfpSummaryPanel({ ofp }: OfpSummaryPanelProps) {
  const hasAlternate = ofp.alternate !== null
  const [tab, setTab] = useState<'destination' | 'alternate'>('destination')
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

      {ofp.loadsheet ? (
        <>
          <div className="ofp-summary-divider">Loadsheet</div>
          <StatGrid
            items={[
              { key: 'pax', label: 'Passagers', value: ofp.loadsheet.paxCount ?? '—', icon: <UsersIcon /> },
              {
                key: 'cargo',
                label: 'Fret',
                value: formatWeight(ofp.loadsheet.cargo, ofp.loadsheet.units),
                icon: <PackageIcon />
              },
              {
                key: 'zfw',
                label: 'ZFW (estimé / max)',
                value: formatWeightRange(ofp.loadsheet.estZfw, ofp.loadsheet.maxZfw, ofp.loadsheet.units),
                icon: <WeightIcon />
              },
              {
                key: 'tow',
                label: 'TOW (estimé / max)',
                value: formatWeightRange(ofp.loadsheet.estTow, ofp.loadsheet.maxTow, ofp.loadsheet.units),
                icon: <WeightIcon />
              },
              {
                key: 'ldw',
                label: 'LDW (estimé / max)',
                value: formatWeightRange(ofp.loadsheet.estLdw, ofp.loadsheet.maxLdw, ofp.loadsheet.units),
                icon: <WeightIcon />
              },
              {
                key: 'ramp',
                label: 'Poids au départ',
                value: formatWeight(ofp.loadsheet.estRamp, ofp.loadsheet.units),
                icon: <WeightIcon />
              }
            ]}
          />
          <StatGrid
            items={[
              {
                key: 'fuelTakeoff',
                label: 'Carburant décollage',
                value: formatWeight(ofp.loadsheet.fuelTakeoff, ofp.loadsheet.units),
                icon: <DropletIcon />
              },
              {
                key: 'fuelLanding',
                label: 'Carburant atterrissage',
                value: formatWeight(ofp.loadsheet.fuelLanding, ofp.loadsheet.units),
                icon: <DropletIcon />
              },
              {
                key: 'fuelReserve',
                label: 'Réserve',
                value: formatWeight(ofp.loadsheet.fuelReserve, ofp.loadsheet.units),
                icon: <DropletIcon />
              },
              {
                key: 'fuelExtra',
                label: 'Extra',
                value: formatWeight(ofp.loadsheet.fuelExtra, ofp.loadsheet.units),
                icon: <DropletIcon />
              },
              {
                key: 'fuelRamp',
                label: 'Carburant total',
                value: formatWeight(ofp.loadsheet.fuelRamp, ofp.loadsheet.units),
                icon: <DropletIcon />
              }
            ]}
          />
        </>
      ) : null}
    </div>
  )
}
