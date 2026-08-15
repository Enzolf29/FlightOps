import { useState } from 'react'
import { useSimConnectStatus, useSimTelemetry } from '@renderer/hooks/useSimConnect'
import {
  useArmedFlightId,
  useArmFlight,
  useDisarmFlight,
  useCompleteManually,
  useActualDepartureIso,
  useLiveFlightPath
} from '@renderer/hooks/useArmedFlight'
import { useFlights } from '@renderer/hooks/useFlights'
import { useOfpDetail } from '@renderer/hooks/useOfpDetail'
import { useFlightEvents } from '@renderer/hooks/useFlightEvents'
import { Badge } from '@renderer/components/Badge'
import { LiveFlightHero } from '@renderer/components/LiveFlightHero'
import { StatGrid } from '@renderer/components/StatGrid'
import { LiveMap } from '@renderer/components/LiveMap'
import { MetarPanel } from '@renderer/components/MetarPanel'
import { OfpSummaryPanel } from '@renderer/components/OfpSummaryPanel'
import { FlightEventLog } from '@renderer/components/FlightEventLog'
import { ArrowUpDownIcon, ClockIcon, CompassIcon, DropletIcon, GaugeIcon, TrendingUpIcon } from '@renderer/components/icons'
import { computeLivePunctuality } from '@shared/flightStatus/computeLivePunctuality'
import { computeFlightProgress } from '@shared/flightStatus/computeFlightProgress'
import { computeFlightDistanceProgress } from '@shared/flightStatus/computeFlightDistanceProgress'
import { computeEtaMinutes } from '@shared/flightStatus/computeEtaMinutes'
import { formatDateTime } from '@renderer/lib/format'
import { SIMCONNECT_STATUS_LABEL, SIMCONNECT_STATUS_VARIANT } from '@renderer/lib/labels'
import type { FlightWithRelations } from '@shared/types/flight'
import type { SimTelemetry } from '@shared/types/simconnect'
import type { OfpAirportSummary } from '@shared/simbrief/parseOfpDetail'

export function LiveTrackingPage() {
  const status = useSimConnectStatus()
  const telemetry = useSimTelemetry()
  const { data: armedFlightId } = useArmedFlightId()
  const { data: flights } = useFlights()
  const armedFlight = (flights ?? []).find((flight) => flight.id === armedFlightId) ?? null
  const disarmFlight = useDisarmFlight()
  const completeManually = useCompleteManually()

  return (
    <div className="fleet-page">
      <div className="page-header-row">
        <h1>Suivi de vol en direct</h1>
        {armedFlight ? (
          <div className="form-actions">
            <button type="button" onClick={() => completeManually.mutate()} disabled={completeManually.isPending}>
              Marquer comme terminé
            </button>
            <button type="button" className="danger" onClick={() => disarmFlight.mutate()} disabled={disarmFlight.isPending}>
              Arrêter le suivi
            </button>
          </div>
        ) : null}
      </div>

      <div className="live-status-row">
        <Badge label={SIMCONNECT_STATUS_LABEL[status ?? 'disconnected']} variant={SIMCONNECT_STATUS_VARIANT[status ?? 'disconnected']} />
        {status !== 'connected' ? (
          <span className="empty-hint">MSFS 2024 doit être lancé pour que la connexion s'établisse.</span>
        ) : null}
      </div>

      {armedFlight ? (
        <ArmedFlightView flight={armedFlight} telemetry={telemetry} />
      ) : (
        <section className="home-section">
          <h2>Vol suivi</h2>
          <FlightPicker flights={flights ?? []} />
        </section>
      )}
    </div>
  )
}

function FlightPicker({ flights }: { flights: FlightWithRelations[] }) {
  const armFlight = useArmFlight()
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null)
  const resumable = flights.filter((flight) => flight.status === 'upcoming' || flight.status === 'in_progress')
  const selectedFlight = resumable.find((flight) => flight.id === selectedFlightId) ?? null

  return (
    <div className="form">
      <label className="form-field">
        <span>Vol à suivre</span>
        <select
          value={selectedFlightId ?? ''}
          onChange={(event) => setSelectedFlightId(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">Choisir un vol…</option>
          {resumable.map((flight) => (
            <option key={flight.id} value={flight.id}>
              {flight.callsignDisplay} · {flight.departureIcao} → {flight.arrivalIcao} · {formatDateTime(flight.scheduledDeparture)}
              {flight.status === 'in_progress' ? ' (en cours)' : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="form-actions">
        <button
          type="button"
          className="primary"
          disabled={!selectedFlightId || armFlight.isPending}
          onClick={() => selectedFlightId && armFlight.mutate(selectedFlightId)}
        >
          {selectedFlight?.status === 'in_progress' ? 'Reprendre le suivi' : 'Démarrer ce vol'}
        </button>
      </div>
    </div>
  )
}

function ArmedFlightView({ flight, telemetry }: { flight: FlightWithRelations; telemetry: SimTelemetry | null }) {
  const { data: ofp } = useOfpDetail(flight.id, flight.source === 'simbrief')
  const events = useFlightEvents(flight.id)
  const { data: actualDepartureIso } = useActualDepartureIso(true)
  const { data: liveFlightPath } = useLiveFlightPath(true)

  const nowIso = telemetry?.simZuluIso ?? new Date().toISOString()
  const punctuality = computeLivePunctuality(flight.scheduledDeparture, actualDepartureIso ?? null, nowIso)

  // Position réelle quand elle est disponible — l'estimation horaire seule dérive dès que le vol
  // prend du retard (elle avancerait "vers l'arrivée" même immobile au parking).
  const progress =
    telemetry && ofp?.origin && ofp?.destination
      ? computeFlightDistanceProgress(
          ofp.origin.lat,
          ofp.origin.lon,
          ofp.destination.lat,
          ofp.destination.lon,
          telemetry.latitude,
          telemetry.longitude
        )
      : computeFlightProgress(flight.scheduledDeparture, flight.scheduledArrival, nowIso)

  return (
    <>
      <section className="home-section">
        <LiveFlightHero flight={flight} punctuality={punctuality} progress={progress} />
      </section>

      <section className="home-section">
        <h2>Informations</h2>
        {telemetry ? (
          <TelemetryStats telemetry={telemetry} destination={ofp?.destination ?? null} />
        ) : (
          <p className="empty-hint">En attente de données du simulateur…</p>
        )}
      </section>

      <section className="home-section live-map-metar-row">
        <div className="live-map-metar-col live-map-metar-col--map">
          <h2>Carte en direct</h2>
          <LiveMap
            resetKey={flight.id}
            origin={ofp?.origin ?? null}
            destination={ofp?.destination ?? null}
            alternate={ofp?.alternate ?? null}
            navlog={ofp?.navlog ?? []}
            telemetry={telemetry}
            initialTrail={liveFlightPath?.map((point) => [point.lat, point.lon])}
          />
        </div>
        <div className="live-map-metar-col live-map-metar-col--metar">
          <h2>METAR</h2>
          <MetarPanel
            airports={[
              { icao: flight.departureIcao, label: `Départ (${flight.departureIcao})` },
              { icao: flight.arrivalIcao, label: `Arrivée (${flight.arrivalIcao})` },
              ...(flight.alternateIcao ? [{ icao: flight.alternateIcao, label: `Alternatif (${flight.alternateIcao})` }] : [])
            ]}
          />
        </div>
      </section>

      <section className="home-section">
        <h2>Résumé SimBrief</h2>
        {ofp ? <OfpSummaryPanel ofp={ofp} /> : <p className="empty-hint">Aucun plan de vol SimBrief associé à ce vol.</p>}
      </section>

      <section className="home-section">
        <h2>Journal d’évènements</h2>
        <FlightEventLog events={events} />
      </section>
    </>
  )
}

function formatEtaMinutes(minutes: number | null): string {
  if (minutes === null) return '—'
  const totalMinutes = Math.round(minutes)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return `${hours}h${String(mins).padStart(2, '0')}`
}

function TelemetryStats({ telemetry, destination }: { telemetry: SimTelemetry; destination: OfpAirportSummary | null }) {
  const etaMinutes = destination
    ? computeEtaMinutes(telemetry.latitude, telemetry.longitude, destination.lat, destination.lon, telemetry.groundVelocity)
    : null

  return (
    <StatGrid
      items={[
        { key: 'altitude', label: 'Altitude', value: `${Math.round(telemetry.altitude)} ft`, icon: <TrendingUpIcon /> },
        { key: 'heading', label: 'Cap', value: `${Math.round(telemetry.headingTrue)}°`, icon: <CompassIcon /> },
        { key: 'gs', label: 'Vitesse sol', value: `${Math.round(telemetry.groundVelocity)} kt`, icon: <GaugeIcon /> },
        {
          key: 'vs',
          label: 'Vitesse verticale',
          value: `${Math.round(telemetry.verticalSpeed)} ft/min`,
          icon: <ArrowUpDownIcon />
        },
        {
          key: 'fuel',
          label: 'Carburant restant',
          value: `${Math.round(telemetry.fuelTotalWeight)} kg`,
          icon: <DropletIcon />
        },
        {
          key: 'eta',
          label: 'Arrivée estimée dans',
          value: formatEtaMinutes(etaMinutes),
          icon: <ClockIcon />
        }
      ]}
    />
  )
}
