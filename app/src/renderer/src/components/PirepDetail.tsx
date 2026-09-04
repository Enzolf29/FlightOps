import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { formatInTimeZone } from 'date-fns-tz'
import type { PirepWithFlight } from '@shared/types/pirep'
import { CompanyLogo } from '@renderer/components/CompanyLogo'
import { Badge } from '@renderer/components/Badge'
import { StatGrid } from '@renderer/components/StatGrid'
import { LiveMap } from '@renderer/components/LiveMap'
import { FlightEventLog } from '@renderer/components/FlightEventLog'
import {
  ArrowUpDownIcon,
  ClockIcon,
  CompassIcon,
  DollarSignIcon,
  DropletIcon,
  GaugeIcon,
  TrendingUpIcon
} from '@renderer/components/icons'
import { AIRPORT_NAMES } from '@shared/airports/airportNames'
import { formatDateTime, formatHours, parseUtc } from '@renderer/lib/format'
import { DELAY_BUCKET_LABEL, DELAY_BUCKET_VARIANT } from '@renderer/lib/labels'
import { formatDelayDuration } from '@shared/flightStatus/formatDelayDuration'
import { usePirepApproachProfile, usePirepEvents, usePirepFlightPath, usePirepTelemetrySamples } from '@renderer/hooks/usePireps'
import { useOfpDetail } from '@renderer/hooks/useOfpDetail'
import { PirepReplay } from './PirepReplay'
import { analyzePirepTelemetry, scoreComfort, scoreFuel, scoreLanding, scorePunctuality } from '@shared/flightStatus/analyzePirepTelemetry'

interface PirepDetailProps {
  pirep: PirepWithFlight
}

function formatKg(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value).toLocaleString('fr-FR')} kg`
}

function formatKgDelta(from: number | null, to: number | null): string {
  if (from === null || to === null) return '—'
  return formatKg(Math.max(0, from - to))
}

function punctualityLabel(pirep: PirepWithFlight): string {
  if (!pirep.delayBucket) return '—'
  if (pirep.delayBucket === 'on_time') return DELAY_BUCKET_LABEL.on_time
  const sign = (pirep.delayMinutes ?? 0) < 0 ? 'avance' : 'retard'
  return `${DELAY_BUCKET_LABEL[pirep.delayBucket]} (${sign} de ${formatDelayDuration(pirep.delayMinutes ?? 0)})`
}

export function PirepDetail({ pirep }: PirepDetailProps) {
  const { flight } = pirep
  const { data: flightPath } = usePirepFlightPath(pirep.id)
  const { data: approachProfile } = usePirepApproachProfile(pirep.id)
  const { data: events } = usePirepEvents(pirep.id)
  const { data: telemetrySamples } = usePirepTelemetrySamples(pirep.id)
  const { data: ofp } = useOfpDetail(flight.id, flight.source === 'simbrief')

  const approachChartData = (approachProfile ?? []).map((point) => ({
    time: formatInTimeZone(parseUtc(point.timeIso), 'UTC', 'HH:mm:ss'),
    altitude: Math.round(point.altitudeFeet),
    groundSpeed: Math.round(point.groundSpeedKt)
  }))
  const telemetryAnalysis = analyzePirepTelemetry(telemetrySamples ?? [])
  const actualFuelUsed = pirep.fuelAtEngineStartKg !== null && pirep.fuelAtEngineStopKg !== null
    ? Math.max(0, pirep.fuelAtEngineStartKg - pirep.fuelAtEngineStopKg)
    : null
  const plannedRampFuel = ofp?.loadsheet?.fuelRamp
  const plannedLandingFuel = ofp?.loadsheet?.fuelLanding
  const plannedFuelUsedRaw = plannedRampFuel != null && plannedLandingFuel != null
    ? plannedRampFuel - plannedLandingFuel
    : null
  const plannedFuelUsed = plannedFuelUsedRaw === null ? null : ofp?.loadsheet?.units === 'lbs' ? plannedFuelUsedRaw / 2.2046226218 : plannedFuelUsedRaw
  const scheduledMinutes = Math.max(0, (parseUtc(flight.scheduledArrival).getTime() - parseUtc(flight.scheduledDeparture).getTime()) / 60000)
  const warningEvents = (events ?? []).filter((event) => event.severity === 'warning')
  const telemetryChartData = (telemetrySamples ?? []).map((sample) => ({
    time: formatInTimeZone(parseUtc(sample.timeIso), 'UTC', 'HH:mm'),
    altitude: Math.round(sample.altitudeFeet),
    speed: Math.round(sample.groundSpeedKt),
    fuel: Math.round(sample.fuelKg)
  }))

  return (
    <div className="pirep-detail">
      <section className="pirep-detail-section">
        <div className="pirep-detail-header">
          <CompanyLogo logoFilename={flight.company.logoFilename} icaoCode={flight.company.icaoCode} width={104} height={58} />
          <div>
            <div className="flight-card-callsign">{flight.callsignDisplay}</div>
            <div className="flight-card-number">
              Vol {flight.flightNumber} · {flight.aircraft?.type ?? 'Avion non défini'}
              {flight.aircraft?.registration ? ` · ${flight.aircraft.registration}` : ''}
            </div>
          </div>
          {pirep.delayBucket ? (
            <Badge label={punctualityLabel(pirep)} variant={DELAY_BUCKET_VARIANT[pirep.delayBucket]} />
          ) : null}
        </div>
      </section>

      <section className="pirep-detail-section">
        <h3>Aéroports et horaires</h3>
        <div className="pirep-schedule-grid">
          <div className="stat-card pirep-schedule-dep-airport">
            <span className="stat-card-label">Départ</span>
            <span className="stat-card-value">
              {flight.departureIcao} · {AIRPORT_NAMES[flight.departureIcao] ?? '—'}
            </span>
          </div>
          <div className="stat-card pirep-schedule-dep-initial">
            <span className="stat-card-label">
              <ClockIcon /> Départ initial
            </span>
            <span className="stat-card-value">{formatDateTime(flight.scheduledDeparture)}</span>
          </div>
          <div className="stat-card pirep-schedule-dep-official">
            <span className="stat-card-label">
              <ClockIcon /> Départ officiel
            </span>
            <span className="stat-card-value stat-card-value--muted">
              {pirep.engineStartTime ? formatDateTime(pirep.engineStartTime) : '—'}
            </span>
          </div>

          <div className="stat-card pirep-schedule-arr-airport">
            <span className="stat-card-label">Arrivée</span>
            <span className="stat-card-value">
              {flight.arrivalIcao} · {AIRPORT_NAMES[flight.arrivalIcao] ?? '—'}
            </span>
          </div>
          <div className="stat-card pirep-schedule-arr-initial">
            <span className="stat-card-label">
              <ClockIcon /> Arrivée initiale
            </span>
            <span className="stat-card-value">{formatDateTime(flight.scheduledArrival)}</span>
          </div>
          <div className="stat-card pirep-schedule-arr-official">
            <span className="stat-card-label">
              <ClockIcon /> Arrivée officielle
            </span>
            <span className="stat-card-value stat-card-value--muted">
              {pirep.engineStopTime ? formatDateTime(pirep.engineStopTime) : '—'}
            </span>
          </div>

          <div className="pirep-schedule-brace" aria-hidden="true">
            {'{'}
          </div>

          <div className="stat-card pirep-schedule-total">
            <span className="stat-card-label">Durée totale</span>
            <span className="stat-card-value">
              {formatHours((pirep.blockTimeMinutes ?? pirep.flightTimeMinutes ?? 0) / 60)}
            </span>
          </div>
        </div>
      </section>

      <section className="pirep-detail-section">
        <h3>Carte du vol réalisé</h3>
        <LiveMap
          resetKey={pirep.id}
          origin={ofp?.origin ?? null}
          destination={ofp?.destination ?? null}
          alternate={ofp?.alternate ?? null}
          navlog={ofp?.navlog ?? []}
          telemetry={null}
          staticTrail={(flightPath ?? []).map((point) => [point.lat, point.lon])}
        />
      </section>

      <section className="pirep-detail-section">
        <h3>Relecture du vol</h3>
        <PirepReplay pirepId={pirep.id} callsign={flight.callsignDisplay} samples={telemetrySamples ?? []} ofp={ofp} />
      </section>

      <section className="pirep-detail-section">
        <h3>Prévu SimBrief / Réalisé</h3>
        <div className="pirep-comparison-grid">
          <Comparison label="Durée" planned={`${Math.round(scheduledMinutes)} min`} actual={`${Math.round(pirep.flightTimeMinutes ?? 0)} min`} />
          <Comparison label="Carburant consommé" planned={formatKg(plannedFuelUsed)} actual={formatKg(actualFuelUsed)} />
          <Comparison label="Distance" planned={ofp?.routeDistanceNm ? `${Math.round(ofp.routeDistanceNm)} NM` : '—'} actual={telemetryAnalysis.actualDistanceNm ? `${Math.round(telemetryAnalysis.actualDistanceNm)} NM` : '—'} />
          <Comparison label="Route" planned={ofp?.route ?? flight.route ?? '—'} actual="Trajectoire enregistrée sur la carte" />
        </div>
      </section>

      <section className="pirep-detail-section">
        <h3>Analyse de l’approche</h3>
        <div className="approach-check-grid">
          {[telemetryAnalysis.approach1000, telemetryAnalysis.approach500].map((check) => (
            <div className={`approach-check ${check.stable === false ? 'approach-check--warning' : ''}`} key={check.targetFeet}>
              <span>Passage {check.targetFeet.toLocaleString('fr-FR')} ft AGL</span>
              <strong>{check.stable === null ? 'Données absentes' : check.stable ? 'Approche stabilisée' : 'Approche non stabilisée'}</strong>
              {check.sample ? <small>{Math.round(check.sample.groundSpeedKt)} kt · {Math.round(check.sample.verticalSpeedFpm)} ft/min · inclinaison {check.sample.bankDegrees.toFixed(1)}°</small> : null}
              {check.reasons.length > 0 ? <small>Points à surveiller : {check.reasons.join(', ')}</small> : null}
            </div>
          ))}
        </div>

        {telemetryChartData.length > 1 ? (
          <div className="pirep-chart-wrapper">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={telemetryChartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis yAxisId="altitude" tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={60} />
                <YAxis yAxisId="other" orientation="right" tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={55} />
                <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="altitude" type="monotone" dataKey="altitude" name="Altitude (ft)" stroke="#4d8bff" dot={false} />
                <Line yAxisId="other" type="monotone" dataKey="speed" name="Vitesse sol (kt)" stroke="#2fb170" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="empty-hint">Profil complet disponible à partir des vols enregistrés avec le nouvel enregistreur.</p>}
      </section>

      <section className="pirep-detail-section">
        <h3>Indicateurs du vol</h3>
        <StatGrid items={[
          { key: 'punctuality-score', label: 'Ponctualité', value: formatScore(scorePunctuality(pirep.delayMinutes)) },
          { key: 'fuel-score', label: 'Gestion carburant', value: formatScore(scoreFuel(actualFuelUsed, plannedFuelUsed)) },
          { key: 'comfort-score', label: 'Confort', value: formatScore(scoreComfort(pirep.touchdownGForce, warningEvents.length)) },
          { key: 'landing-score', label: 'Atterrissage', value: formatScore(scoreLanding(pirep.touchdownVerticalSpeedFpm)) }
        ]} />
        <div className="pirep-anomalies">
          <strong>Anomalies détectées</strong>
          {warningEvents.length === 0 ? <span>Aucune anomalie enregistrée.</span> : (
            <ul>{warningEvents.map((event, index) => <li key={`${event.simTimeIso}-${index}`}>{event.message}</li>)}</ul>
          )}
        </div>
      </section>

      <section className="pirep-detail-section">
        <h3>Statistiques d’atterrissage</h3>
        <StatGrid
          items={[
            {
              key: 'vs',
              label: 'Vitesse verticale (fpm)',
              value: pirep.touchdownVerticalSpeedFpm !== null ? `${Math.round(pirep.touchdownVerticalSpeedFpm)} ft/min` : '—',
              icon: <ArrowUpDownIcon />
            },
            {
              key: 'airspeed',
              label: 'Vitesse au toucher',
              value: pirep.touchdownAirspeedKt !== null ? `${Math.round(pirep.touchdownAirspeedKt)} kt` : '—',
              icon: <GaugeIcon />
            },
            {
              key: 'g',
              label: 'Facteur de charge',
              value: pirep.touchdownGForce !== null ? `${pirep.touchdownGForce.toFixed(2)} G` : '—',
              icon: <GaugeIcon />
            },
            {
              key: 'pitch',
              label: 'Assiette au toucher',
              value: pirep.touchdownPitchDegrees !== null ? `${pirep.touchdownPitchDegrees.toFixed(1)}°` : '—',
              icon: <TrendingUpIcon />
            },
            {
              key: 'bank',
              label: 'Inclinaison au toucher',
              value: pirep.touchdownBankDegrees !== null ? `${pirep.touchdownBankDegrees.toFixed(1)}°` : '—',
              icon: <CompassIcon />
            }
          ]}
        />

        {approachChartData.length > 1 ? (
          <div className="pirep-chart-wrapper">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={approachChartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis yAxisId="altitude" tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={60} />
                <YAxis yAxisId="speed" orientation="right" tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={50} />
                <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="altitude" type="monotone" dataKey="altitude" name="Altitude (ft)" stroke="#4d8bff" dot={false} />
                <Line yAxisId="speed" type="monotone" dataKey="groundSpeed" name="Vitesse sol (kt)" stroke="#2fb170" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty-hint">Profil d’approche non disponible pour ce vol.</p>
        )}
      </section>

      <section className="pirep-detail-section">
        <h3>Carburant</h3>
        <StatGrid
          items={[
            { key: 'atStart', label: 'À l’allumage', value: formatKg(pirep.fuelAtEngineStartKg), icon: <DropletIcon /> },
            {
              key: 'taxiOut',
              label: `Roulage ${flight.departureIcao}`,
              value: formatKgDelta(pirep.fuelAtEngineStartKg, pirep.fuelAtTakeoffKg),
              icon: <DropletIcon />,
              muted: true
            },
            { key: 'atTouchdown', label: 'Au toucher', value: formatKg(pirep.fuelAtTouchdownKg), icon: <DropletIcon /> },
            {
              key: 'taxiIn',
              label: `Roulage ${flight.arrivalIcao}`,
              value: formatKgDelta(pirep.fuelAtTouchdownKg, pirep.fuelAtEngineStopKg),
              icon: <DropletIcon />,
              muted: true
            },
            {
              key: 'totalUsed',
              label: 'Total consommé',
              value: formatKgDelta(pirep.fuelAtEngineStartKg, pirep.fuelAtEngineStopKg),
              icon: <DollarSignIcon />
            },
            {
              key: 'planned',
              label: 'Prévu initialement',
              value: ofp?.loadsheet ? `${Math.round(ofp.loadsheet.fuelRamp ?? 0).toLocaleString('fr-FR')} ${ofp.loadsheet.units}` : '—',
              muted: true
            }
          ]}
        />
      </section>

      <section className="pirep-detail-section">
        <h3>Journal d’évènements</h3>
        {events && events.length > 0 ? (
          <FlightEventLog events={events} />
        ) : (
          <p className="empty-hint">Aucun journal d’évènements enregistré pour ce vol.</p>
        )}
      </section>

      {flight.route ? (
        <section className="pirep-detail-section">
          <h3>Route</h3>
          <p className="ofp-summary-route">{flight.route}</p>
        </section>
      ) : null}

      {pirep.remarks ? (
        <section className="pirep-detail-section">
          <h3>Remarques</h3>
          <p>{pirep.remarks}</p>
        </section>
      ) : null}
    </div>
  )
}

function formatScore(score: number | null): string {
  return score === null ? '—' : `${score}/100`
}

function Comparison({ label, planned, actual }: { label: string; planned: string; actual: string }) {
  return (
    <div className="pirep-comparison-card">
      <strong>{label}</strong>
      <span><small>Prévu</small>{planned}</span>
      <span><small>Réalisé</small>{actual}</span>
    </div>
  )
}
