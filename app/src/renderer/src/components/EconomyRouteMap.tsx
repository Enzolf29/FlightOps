import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getAirportLabel } from '@shared/airports/airportNames'
import { getAirportCoordinates } from '@shared/airports/airportCoordinates'
import type { RoutePrice } from '@shared/types/economy'

type LatLon = [number, number]

function airportIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: '<div class="live-map-airport-pin" style="--pin-color:#4d8bff"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
}

const AIRPORT_ICON = airportIcon()

interface RoutePair {
  key: string
  airportA: string
  airportB: string
  latA: number
  lonA: number
  latB: number
  lonB: number
  /** Nombre de sens tarifés pour cette paire (1 = un seul aller défini, 2 = aller-retour complet). */
  directionCount: number
}

interface EconomyRouteMapProps {
  routePrices: RoutePrice[]
  selectedPairKey: string | null
  onSelectPair: (key: string | null) => void
}

/** Identifiant non-orienté d'une paire d'aéroports — un aller et son retour partagent la même clé. */
export function economyRoutePairKey(icaoA: string, icaoB: string): string {
  return [icaoA, icaoB].sort().join('-')
}

function FitToPoints({ points }: { points: LatLon[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 5)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)])

  return null
}

export function EconomyRouteMap({ routePrices, selectedPairKey, onSelectPair }: EconomyRouteMapProps) {
  const pairs = useMemo<RoutePair[]>(() => {
    const byKey = new Map<string, RoutePair>()
    for (const routePrice of routePrices) {
      const coordsA = getAirportCoordinates(routePrice.departureIcao)
      const coordsB = getAirportCoordinates(routePrice.arrivalIcao)
      if (!coordsA || !coordsB) continue

      const key = economyRoutePairKey(routePrice.departureIcao, routePrice.arrivalIcao)
      const existing = byKey.get(key)
      if (existing) {
        existing.directionCount += 1
      } else {
        byKey.set(key, {
          key,
          airportA: routePrice.departureIcao,
          airportB: routePrice.arrivalIcao,
          latA: coordsA.lat,
          lonA: coordsA.lon,
          latB: coordsB.lat,
          lonB: coordsB.lon,
          directionCount: 1
        })
      }
    }
    return [...byKey.values()]
  }, [routePrices])

  const points = useMemo<LatLon[]>(() => {
    const list: LatLon[] = []
    for (const pair of pairs) {
      list.push([pair.latA, pair.lonA])
      list.push([pair.latB, pair.lonB])
    }
    return list
  }, [pairs])

  const airports = useMemo(() => {
    const byIcao = new Map<string, LatLon>()
    for (const pair of pairs) {
      byIcao.set(pair.airportA, [pair.latA, pair.lonA])
      byIcao.set(pair.airportB, [pair.latB, pair.lonB])
    }
    return [...byIcao.entries()]
  }, [pairs])

  if (pairs.length === 0) return null

  const initialCenter: LatLon = points[0] ?? [46.6, 2.5]

  return (
    <div className="live-map-wrapper">
      <MapContainer center={initialCenter} zoom={4} className="live-map" scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitToPoints points={points} />
        {pairs.map((pair) => {
          const selected = pair.key === selectedPairKey
          return (
            <Polyline
              key={pair.key}
              positions={[
                [pair.latA, pair.lonA],
                [pair.latB, pair.lonB]
              ]}
              pathOptions={{
                color: '#4d8bff',
                weight: selected ? 5 : 3,
                opacity: !selectedPairKey || selected ? 0.9 : 0.3
              }}
              eventHandlers={{ click: () => onSelectPair(selected ? null : pair.key) }}
            >
              <Tooltip sticky>
                {pair.airportA} ↔ {pair.airportB} · {pair.directionCount} sens tarifé{pair.directionCount > 1 ? 's' : ''}
              </Tooltip>
            </Polyline>
          )
        })}
        {airports.map(([icao, position]) => (
          <Marker key={icao} position={position} icon={AIRPORT_ICON}>
            <Tooltip>{getAirportLabel(icao)}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <p className="form-hint economy-map-hint">Clique une ligne pour ne garder que son aller-retour ci-dessous.</p>
    </div>
  )
}
