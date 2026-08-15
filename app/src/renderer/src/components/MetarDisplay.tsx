import type { ReactElement } from 'react'
import { parseMetar } from '@shared/aviation/parseMetar'
import type { MetarCloudCoverage, MetarWeatherIcon } from '@shared/aviation/parseMetar'
import { Badge } from '@renderer/components/Badge'
import {
  CloudFogIcon,
  CloudIcon,
  CloudRainIcon,
  CompassIcon,
  EyeIcon,
  GaugeIcon,
  SnowflakeIcon,
  ThermometerIcon,
  WindIcon,
  ZapIcon
} from '@renderer/components/icons'

const CLOUD_COVERAGE_LABEL: Record<MetarCloudCoverage, string> = {
  FEW: 'Quelques nuages',
  SCT: 'Épars',
  BKN: 'Fragmenté',
  OVC: 'Couvert',
  VV: 'Ciel obscurci'
}

const WEATHER_ICON: Record<MetarWeatherIcon, (size?: number) => ReactElement> = {
  storm: (size) => <ZapIcon size={size} />,
  rain: (size) => <CloudRainIcon size={size} />,
  snow: (size) => <SnowflakeIcon size={size} />,
  hail: (size) => <SnowflakeIcon size={size} />,
  fog: (size) => <CloudFogIcon size={size} />,
  mist: (size) => <CloudFogIcon size={size} />,
  wind: (size) => <WindIcon size={size} />,
  other: (size) => <CloudIcon size={size} />
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatWind(parsed: ReturnType<typeof parseMetar>): string {
  if (!parsed.wind) return '—'
  const direction = parsed.wind.variable ? 'Variable' : `${pad2(Math.round(parsed.wind.directionDeg ?? 0))}°`.padStart(4, '0')
  const gust = parsed.wind.gustKt !== null ? ` (rafales ${parsed.wind.gustKt} kt)` : ''
  const range = parsed.windVariableRange ? ` — variable ${parsed.windVariableRange.fromDeg}°-${parsed.windVariableRange.toDeg}°` : ''
  return `${direction} ${parsed.wind.speedKt} kt${gust}${range}`
}

function formatVisibility(parsed: ReturnType<typeof parseMetar>): string {
  if (parsed.cavok) return 'CAVOK (≥10 km)'
  if (parsed.visibilityMeters === null) return '—'
  if (parsed.visibilityMeters >= 9999) return '≥10 km'
  if (parsed.visibilityMeters >= 1000) return `${(parsed.visibilityMeters / 1000).toFixed(1)} km`
  return `${parsed.visibilityMeters} m`
}

const FLIGHT_CATEGORY_VARIANT: Record<string, string> = {
  VFR: 'badge-vfr',
  MVFR: 'badge-mvfr',
  IFR: 'badge-ifr',
  LIFR: 'badge-lifr'
}

interface MetarDisplayProps {
  raw: string
}

export function MetarDisplay({ raw }: MetarDisplayProps) {
  const parsed = parseMetar(raw)

  return (
    <div className="metar-decoded">
      <div className="metar-decoded-header">
        {parsed.flightCategory ? (
          <Badge label={parsed.flightCategory} variant={FLIGHT_CATEGORY_VARIANT[parsed.flightCategory]} />
        ) : null}
        {parsed.dayOfMonth !== null && parsed.hourUtc !== null && parsed.minuteUtc !== null ? (
          <span className="metar-decoded-time">
            Relevé le {pad2(parsed.dayOfMonth)} à {pad2(parsed.hourUtc)}:{pad2(parsed.minuteUtc)} UTC
            {parsed.auto ? ' · AUTO' : ''}
          </span>
        ) : null}
      </div>

      <div className="metar-decoded-grid">
        <div className="metar-decoded-item">
          <WindIcon />
          <span>{formatWind(parsed)}</span>
        </div>
        <div className="metar-decoded-item">
          <EyeIcon />
          <span>{formatVisibility(parsed)}</span>
        </div>
        <div className="metar-decoded-item">
          <ThermometerIcon />
          <span>
            {parsed.temperatureC !== null ? `${parsed.temperatureC}°C` : '—'}
            {parsed.dewpointC !== null ? ` / point de rosée ${parsed.dewpointC}°C` : ''}
          </span>
        </div>
        <div className="metar-decoded-item">
          <GaugeIcon />
          <span>{parsed.altimeterHpa !== null ? `QNH ${parsed.altimeterHpa} hPa` : '—'}</span>
        </div>
      </div>

      {parsed.weather.length > 0 ? (
        <div className="metar-decoded-weather">
          {parsed.weather.map((group, index) => (
            <span key={`${group.raw}-${index}`} className="metar-weather-chip">
              {WEATHER_ICON[group.icon](14)}
              {group.description}
            </span>
          ))}
        </div>
      ) : null}

      <div className="metar-decoded-clouds">
        {parsed.skyClear || (parsed.cavok && parsed.clouds.length === 0) ? (
          <span className="metar-cloud-chip">
            <CloudIcon size={14} /> Ciel clair
          </span>
        ) : parsed.clouds.length > 0 ? (
          parsed.clouds.map((layer, index) => (
            <span key={`${layer.coverage}-${index}`} className="metar-cloud-chip">
              <CloudIcon size={14} />
              {CLOUD_COVERAGE_LABEL[layer.coverage]}
              {layer.heightFt !== null ? ` à ${layer.heightFt.toLocaleString('fr-FR')} ft` : ''}
              {layer.towering ? ' (CB/TCU)' : ''}
            </span>
          ))
        ) : (
          <span className="metar-cloud-chip metar-cloud-chip--muted">
            <CompassIcon size={14} /> Nébulosité non renseignée
          </span>
        )}
      </div>
    </div>
  )
}
