import { useEffect, useMemo, useState } from 'react'
import type { AircraftWithStats } from '@shared/types/aircraft'
import type { Company } from '@shared/types/company'
import type { RealRoute } from '@shared/types/realFlights'
import { getAirportCoordinates } from '@shared/airports/airportCoordinates'
import { getAirportLabel } from '@shared/airports/airportNames'
import { generateCallsign } from '@shared/callsign/generateCallsign'
import { getAirportRegion, type AirportRegion } from '@shared/realFlights/getAirportRegion'
import {
  getFleetRouteMatch,
  rankFleetAircraftForRoute,
  type FleetRouteMatch
} from '@shared/realFlights/matchFleetAircraftToRoute'
import { buildDispatchPrefillUrl } from '@shared/simbrief/buildDispatchPrefillUrl'
import { useAircraft } from '@renderer/hooks/useAircraft'
import { useCompanies } from '@renderer/hooks/useCompanies'
import {
  useListKnownRoutes,
  useRefreshCompanyRoutes,
  useSearchRealRoutes,
  useSuggestFlightNumber
} from '@renderer/hooks/useRealFlights'
import { CompanyPicker } from './CompanyPicker'
import { Modal } from './Modal'
import { RealFlightsMap } from './RealFlightsMap'

type SortKey = 'destination' | 'duration' | 'aircraftCount' | 'frequency'
type SortDirection = 'asc' | 'desc'
type AvailabilityFilter = '' | FleetRouteMatch

const REGION_LABELS: Record<AirportRegion, string> = {
  europe: 'Europe',
  africa: 'Afrique',
  middle_east: 'Moyen-Orient',
  asia: 'Asie',
  north_america: 'Amérique du Nord',
  south_america: 'Amérique du Sud',
  oceania: 'Océanie',
  other: 'Autre zone'
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—'
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const remainder = total % 60
  return hours > 0 ? `${hours}h${String(remainder).padStart(2, '0')}` : `${remainder} min`
}

function parseHhMmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return minutes <= 59 ? hours * 60 + minutes : null
}

function parseUtcTimestamp(value: string | null): number | null {
  if (!value) return null
  const timestamp = Date.parse(value.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatCacheAge(value: string | null): string {
  const timestamp = parseUtcTimestamp(value)
  if (timestamp === null) return 'ancien cache'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 2) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `il y a ${hours}h` : `il y a ${Math.floor(hours / 24)} j`
}

function compareRoutes(a: RealRoute, b: RealRoute, key: SortKey): number {
  if (key === 'duration') return (a.typicalDurationMinutes ?? Infinity) - (b.typicalDurationMinutes ?? Infinity)
  if (key === 'aircraftCount') return a.aircraft.length - b.aircraft.length
  if (key === 'frequency') return a.observationCount - b.observationCount
  return a.arrivalIcao.localeCompare(b.arrivalIcao)
}

function observationLabel(count: number): string {
  if (count <= 0) return 'Fréquence non mesurée'
  return count === 1 ? 'Observé 1 fois' : `Observé ${count} fois`
}

function frequencyTone(count: number): string {
  if (count >= 3) return 'badge-on-time'
  return count === 1 ? 'badge-muted' : 'badge-neutral'
}

function SortHeader({ label, sortKey, activeKey, direction, onSort }: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
}) {
  const isActive = sortKey === activeKey
  return (
    <button type="button" className={'fleet-table-sort' + (isActive ? ' active' : '')} onClick={() => onSort(sortKey)}>
      {label}<span className="fleet-table-sort-arrow">{isActive ? (direction === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  )
}

export function RealFlightsBrowser({ onGenerated }: { onGenerated: () => void }) {
  const { data: companies } = useCompanies()
  const [companyId, setCompanyId] = useState<number | null>(null)
  const { data: fleetAircraft } = useAircraft(companyId ?? undefined)
  const [departureIcao, setDepartureIcao] = useState('')
  const [arrivalFilter, setArrivalFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('frequency')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [aircraftFilter, setAircraftFilter] = useState('')
  const [maxDurationTime, setMaxDurationTime] = useState('')
  const [regionFilter, setRegionFilter] = useState<AirportRegion | ''>('')
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('')
  const [sourceFilter, setSourceFilter] = useState<'' | 'api' | 'reciprocal'>('')
  const [focusedRouteId, setFocusedRouteId] = useState<number | null>(null)
  const [bookingRoute, setBookingRoute] = useState<RealRoute | null>(null)
  const [resultMode, setResultMode] = useState<'search' | 'browseAll' | null>(null)
  const search = useSearchRealRoutes()
  const browseAll = useListKnownRoutes()
  const refreshCompany = useRefreshCompanyRoutes()
  const selectedCompany = companies?.find((company) => company.id === companyId) ?? null

  useEffect(() => {
    if (companyId && !departureIcao.trim()) {
      setResultMode('browseAll')
      browseAll.mutate(companyId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const activeRoutes = resultMode === 'browseAll' ? (refreshCompany.data?.routes ?? browseAll.data) : search.data?.routes
  const isPending = resultMode === 'browseAll' ? browseAll.isPending || refreshCompany.isPending : search.isPending
  const isError = resultMode === 'browseAll' ? browseAll.isError || refreshCompany.isError : search.isError
  const activeError = resultMode === 'browseAll' ? refreshCompany.error ?? browseAll.error : search.error

  function resetForCompany(id: number) {
    setCompanyId(id)
    setFocusedRouteId(null)
    setBookingRoute(null)
    setDepartureIcao('')
    setArrivalFilter('')
    setAircraftFilter('')
    setMaxDurationTime('')
    setRegionFilter('')
    setAvailabilityFilter('')
    setSourceFilter('')
    search.reset()
    browseAll.reset()
    refreshCompany.reset()
  }

  function handleSearch(forceRefresh: boolean) {
    if (!companyId) return
    const icao = departureIcao.trim().toUpperCase()
    if (!icao) {
      setResultMode('browseAll')
      browseAll.mutate(companyId)
      return
    }
    setResultMode('search')
    search.mutate({ companyId, departureIcao: icao, forceRefresh })
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDirection(key === 'frequency' ? 'desc' : 'asc')
    }
  }

  function focusRoute(routeId: number, scrollToList = true) {
    setFocusedRouteId(routeId)
    if (!scrollToList) return
    requestAnimationFrame(() => {
      document.getElementById(`real-route-${routeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const allAircraftTypes = useMemo(() => {
    const entries = new Map<string, string>()
    for (const route of activeRoutes ?? []) for (const aircraft of route.aircraft) entries.set(aircraft.icaoType, aircraft.typeDescription)
    return [...entries.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [activeRoutes])

  const availableRegions = useMemo(() => {
    const set = new Set<AirportRegion>()
    for (const route of activeRoutes ?? []) set.add(getAirportRegion(route.arrivalIcao))
    return [...set].sort((a, b) => REGION_LABELS[a].localeCompare(REGION_LABELS[b]))
  }, [activeRoutes])

  const visibleRoutes = useMemo(() => {
    const maxMinutes = parseHhMmToMinutes(maxDurationTime)
    const normalizedArrival = arrivalFilter.trim().toUpperCase()
    return [...(activeRoutes ?? []).filter((route) => {
      if (aircraftFilter && !route.aircraft.some((aircraft) => aircraft.icaoType === aircraftFilter)) return false
      if (maxMinutes !== null && (route.typicalDurationMinutes === null || route.typicalDurationMinutes > maxMinutes)) return false
      if (regionFilter && getAirportRegion(route.arrivalIcao) !== regionFilter) return false
      if (sourceFilter && route.source !== sourceFilter) return false
      if (normalizedArrival && !route.arrivalIcao.includes(normalizedArrival) && !getAirportLabel(route.arrivalIcao).toUpperCase().includes(normalizedArrival)) return false
      if (availabilityFilter && !(fleetAircraft ?? []).some((item) => getFleetRouteMatch(item, route) === availabilityFilter)) return false
      return true
    })].sort((a, b) => compareRoutes(a, b, sortKey) * (sortDirection === 'asc' ? 1 : -1))
  }, [activeRoutes, aircraftFilter, maxDurationTime, regionFilter, sourceFilter, arrivalFilter, availabilityFilter, fleetAircraft, sortKey, sortDirection])

  const suggestions = useMemo(() => {
    if (!fleetAircraft) return []
    return (activeRoutes ?? []).flatMap((route) => {
      const aircraft = fleetAircraft.filter((item) => getFleetRouteMatch(item, route) === 'positioned')
      return aircraft.length > 0 ? [{ route, aircraft }] : []
    }).sort((a, b) => b.route.observationCount - a.route.observationCount).slice(0, 6)
  }, [activeRoutes, fleetAircraft])

  const mapRoutes = useMemo(() => visibleRoutes.map((route) => {
    const departure = getAirportCoordinates(route.departureIcao)
    const arrival = getAirportCoordinates(route.arrivalIcao)
    if (!departure || !arrival) return null
    return {
      id: route.id,
      departure: { icao: route.departureIcao, ...departure },
      arrival: { icao: route.arrivalIcao, ...arrival },
      source: route.source,
      observationCount: route.observationCount
    }
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null), [visibleRoutes])
  const routesMissingCoordinates = visibleRoutes.length - mapRoutes.length
  const newestCache = [...(activeRoutes ?? [])]
    .map((route) => route.lastFetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => (parseUtcTimestamp(b) ?? 0) - (parseUtcTimestamp(a) ?? 0))[0] ?? null

  if (!companies) return <p className="page-loading">Chargement…</p>

  return (
    <div className="real-flights">
      <div className="form-field">
        <span>Compagnie</span>
        <CompanyPicker companies={companies} value={companyId} onChange={resetForCompany} />
      </div>

      <label className="form-field">
        <span>Aéroport de départ (optionnel)</span>
        <div className="form-inline-group">
          <input value={departureIcao} onChange={(event) => setDepartureIcao(event.target.value.toUpperCase())}
            onKeyDown={(event) => { if (event.key === 'Enter') handleSearch(false) }} placeholder="LFPG" maxLength={4} />
          <button type="button" className="primary" onClick={() => handleSearch(false)} disabled={!companyId || isPending}>
            {isPending ? 'Chargement…' : departureIcao.trim() ? 'Rechercher' : 'Voir tout le réseau connu'}
          </button>
        </div>
      </label>

      {isError ? <p className="form-error">{(activeError as Error).message}</p> : null}

      {activeRoutes ? (
        <>
          <div className="real-flights-cache-bar">
            <span><strong>{activeRoutes.length} route{activeRoutes.length > 1 ? 's' : ''}</strong> dans la base locale{newestCache ? ` · cache actualisé ${formatCacheAge(newestCache)}` : ''}</span>
            <button type="button" className="secondary"
              onClick={resultMode === 'browseAll' ? () => companyId && refreshCompany.mutate(companyId) : () => handleSearch(true)}
              disabled={isPending}>
              {isPending ? 'Actualisation…' : resultMode === 'browseAll' ? 'Actualiser la compagnie' : "Actualiser l'aéroport"}
            </button>
          </div>

          {activeRoutes.length === 0 ? (
            <p className="empty-hint">{resultMode === 'browseAll'
              ? `Aucun vol connu pour ${selectedCompany?.displayName}. Indiquez un aéroport de départ pour alimenter la base locale.`
              : `Aucune route trouvée pour ${selectedCompany?.displayName} au départ de ${departureIcao.trim().toUpperCase()}.`}</p>
          ) : (
            <>
              {suggestions.length > 0 ? (
                <section className="real-flights-suggestions">
                  <div className="real-flights-section-heading">
                    <div><span className="eyebrow">Suggestions prêtes à voler</span><h3>Avions compatibles déjà au départ</h3></div>
                    <span className="badge badge-on-time">Position flotte vérifiée</span>
                  </div>
                  <div className="real-flights-suggestion-grid">
                    {suggestions.map(({ route, aircraft }) => (
                      <button key={route.id} type="button" onClick={() => focusRoute(route.id)}>
                        <strong>{route.departureIcao} → {route.arrivalIcao}</strong>
                        <span>{aircraft.map((item) => item.registration ?? item.type).join(', ')} au départ</span>
                        <small>{formatDuration(route.typicalDurationMinutes)} · {observationLabel(route.observationCount)}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="real-flights-toolbar">
                <label>Arrivée<input value={arrivalFilter} onChange={(event) => setArrivalFilter(event.target.value)} placeholder="OACI ou ville" /></label>
                <label>Zone<select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value as AirportRegion | '')}>
                  <option value="">Toutes</option>{availableRegions.map((region) => <option key={region} value={region}>{REGION_LABELS[region]}</option>)}
                </select></label>
                <label>Avion observé<select value={aircraftFilter} onChange={(event) => setAircraftFilter(event.target.value)}>
                  <option value="">Tous</option>{allAircraftTypes.map(([icao, description]) => <option key={icao} value={icao}>{description}</option>)}
                </select></label>
                <label>Durée max<input type="time" className="real-flights-duration-input" value={maxDurationTime} onChange={(event) => setMaxDurationTime(event.target.value)} /></label>
                <label>Ma flotte<select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilter)}>
                  <option value="">Tous les vols</option><option value="positioned">Compatible et sur place</option><option value="compatible">Compatible ailleurs</option>
                </select></label>
                <label>Origine<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as '' | 'api' | 'reciprocal')}>
                  <option value="">Toutes</option><option value="api">Observées</option><option value="reciprocal">Retours déduits</option>
                </select></label>
              </div>

              <RealFlightsMap routes={mapRoutes} selectedRouteId={focusedRouteId} onSelectRoute={(routeId) => focusRoute(routeId)} />
              {routesMissingCoordinates > 0 ? <p className="empty-hint">{routesMissingCoordinates} route{routesMissingCoordinates > 1 ? 's' : ''} sans coordonnées, non affichée{routesMissingCoordinates > 1 ? 's' : ''} sur la carte.</p> : null}

              {visibleRoutes.length === 0 ? <p className="empty-hint">Aucune route ne correspond aux filtres actuels.</p> : (
                <div className="real-flights-list">
                  <div className="real-flights-row real-flights-header">
                    <SortHeader label="Route" sortKey="destination" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortHeader label="Avion(s)" sortKey="aircraftCount" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortHeader label="Durée" sortKey="duration" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortHeader label="Fréquence" sortKey="frequency" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <span>Disponibilité</span><span>Source</span>
                  </div>
                  {visibleRoutes.map((route) => {
                    const positioned = (fleetAircraft ?? []).filter((item) => getFleetRouteMatch(item, route) === 'positioned')
                    const compatible = (fleetAircraft ?? []).filter((item) => getFleetRouteMatch(item, route) === 'compatible')
                    const focused = focusedRouteId === route.id
                    return (
                      <div key={route.id} id={`real-route-${route.id}`} className={'real-flights-route-entry' + (focused ? ' real-flights-route-entry--focused' : '')}>
                        <button type="button" className="real-flights-row" onClick={() => focusRoute(route.id, false)} aria-expanded={focused}>
                          <span className="real-flights-route"><strong>{route.departureIcao} → {route.arrivalIcao}</strong><small>{getAirportLabel(route.arrivalIcao)}</small></span>
                          <span className="real-flights-aircraft">{route.aircraft.length > 0 ? route.aircraft.map((aircraft) => (
                            <span key={aircraft.icaoType} className="real-flights-aircraft-observation">
                              <span className="badge badge-neutral">{aircraft.typeDescription}</span>{aircraft.observationCount > 0 ? <small>{aircraft.observationCount}×</small> : null}
                            </span>
                          )) : <span className="badge badge-muted">Avion inconnu</span>}</span>
                          <span className="real-flights-duration">{formatDuration(route.typicalDurationMinutes)}</span>
                          <span className={`badge ${frequencyTone(route.observationCount)}`}>{observationLabel(route.observationCount)}</span>
                          <span className="real-flights-availability">{positioned.length > 0
                            ? <span className="badge badge-on-time">{positioned.map((item) => item.registration ?? item.type).join(', ')} sur place</span>
                            : compatible.length > 0 ? <span className="badge badge-neutral">{compatible.length} compatible{compatible.length > 1 ? 's' : ''} ailleurs</span>
                              : <span className="badge badge-muted">Aucun sur place</span>}</span>
                          <span className="real-flights-source"><span className={'badge ' + (route.source === 'api' ? 'badge-on-time' : 'badge-muted')}>{route.source === 'api' ? 'Observé' : 'Retour déduit'}</span><small>{formatCacheAge(route.lastFetchedAt)}</small></span>
                        </button>
                        {focused ? (
                          <div className="real-flights-route-detail">
                            <div className="real-flights-route-detail-heading">
                              <div>
                                <span className="eyebrow">Route sélectionnée</span>
                                <h3>{getAirportLabel(route.departureIcao)} → {getAirportLabel(route.arrivalIcao)}</h3>
                              </div>
                              <button type="button" className="primary" onClick={() => setBookingRoute(route)}>Réserver ce vol</button>
                            </div>
                            <div className="real-flights-route-detail-grid">
                              <div><small>Durée typique</small><strong>{formatDuration(route.typicalDurationMinutes)}</strong></div>
                              <div><small>Fréquence connue</small><strong>{observationLabel(route.observationCount)}</strong></div>
                              <div><small>Dernière observation</small><strong>{route.lastObservedAt ? formatCacheAge(route.lastObservedAt) : 'Non mesurée'}</strong></div>
                              <div><small>Origine</small><strong>{route.source === 'api' ? 'AeroDataBox · observée' : 'Trajet retour déduit'}</strong></div>
                            </div>
                            <div className="real-flights-route-detail-sections">
                              <div>
                                <small>Avions observés sur la ligne</small>
                                <div className="real-flights-aircraft">{route.aircraft.length > 0 ? route.aircraft.map((aircraft) => (
                                  <span key={aircraft.icaoType} className="badge badge-neutral">{aircraft.typeDescription}{aircraft.observationCount > 0 ? ` · ${aircraft.observationCount}×` : ''}</span>
                                )) : <span className="badge badge-muted">Avion inconnu</span>}</div>
                              </div>
                              <div>
                                <small>Avions de votre flotte</small>
                                <div className="real-flights-aircraft">{positioned.length > 0 ? positioned.map((item) => (
                                  <span key={item.id} className="badge badge-on-time">{item.registration ?? item.type} · déjà à {route.departureIcao}</span>
                                )) : compatible.length > 0 ? compatible.map((item) => (
                                  <span key={item.id} className="badge badge-neutral">{item.registration ?? item.type} · à {item.lastKnownIcao ?? 'position inconnue'}</span>
                                )) : <span className="badge badge-muted">Aucun avion compatible identifié</span>}</div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {bookingRoute && selectedCompany ? <BookRealRouteModal route={bookingRoute} company={selectedCompany} onClose={() => setBookingRoute(null)} onGenerated={onGenerated} /> : null}
    </div>
  )
}

function aircraftOptionLabel(item: AircraftWithStats, route: RealRoute): string {
  const identity = `${item.type}${item.registration ? ` (${item.registration})` : ''}`
  const match = getFleetRouteMatch(item, route)
  if (match === 'positioned') return `${identity} — sur place à ${route.departureIcao}`
  if (match === 'compatible') return `${identity} — compatible, position ${item.lastKnownIcao ?? 'inconnue'}`
  return `${identity} — type non observé sur cette route`
}

function BookRealRouteModal({ route, company, onClose, onGenerated }: {
  route: RealRoute
  company: Company
  onClose: () => void
  onGenerated: () => void
}) {
  const { data: fleetAircraft } = useAircraft(company.id)
  const suggestFlightNumber = useSuggestFlightNumber()
  const rankedAircraft = useMemo(() => rankFleetAircraftForRoute(fleetAircraft ?? [], route), [fleetAircraft, route])
  const defaultAircraft = rankedAircraft.find((item) => getFleetRouteMatch(item, route) !== 'incompatible') ?? null
  const [aircraftId, setAircraftId] = useState<number | null>(null)
  const [flightNumberDigits, setFlightNumberDigits] = useState('')
  const [suggestionTried, setSuggestionTried] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedAircraft = fleetAircraft?.find((item) => item.id === aircraftId) ?? null

  useEffect(() => { if (defaultAircraft && aircraftId === null) setAircraftId(defaultAircraft.id) }, [defaultAircraft, aircraftId])
  useEffect(() => {
    setSuggestionTried(false)
    suggestFlightNumber.mutate(route.id, {
      onSuccess: (digits) => { setSuggestionTried(true); if (digits) setFlightNumberDigits(digits) },
      onError: () => setSuggestionTried(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id])

  function handleGenerate() {
    if (!selectedAircraft || !date || !time) {
      setError('Renseignez un avion de la flotte, la date et l’heure de départ.')
      return
    }
    const scheduledDeparture = new Date(`${date}T${time}:00Z`)
    const scheduledArrival = new Date(scheduledDeparture.getTime() + (route.typicalDurationMinutes ?? 90) * 60000)
    const { raw: callsign } = generateCallsign({ icaoCode: company.icaoCode, radioCallsign: company.radioCallsign, pattern: company.callsignPattern })
    setError(null)
    window.flightops.app.openExternal(buildDispatchPrefillUrl({
      originIcao: route.departureIcao,
      destIcao: route.arrivalIcao,
      aircraftIcaoType: selectedAircraft.simbriefIcaoCode || selectedAircraft.type,
      airlineIcao: company.icaoCode,
      flightNumberDigits: flightNumberDigits.trim() || undefined,
      registration: selectedAircraft.registration,
      simbriefFin: selectedAircraft.simbriefFin,
      callsign,
      scheduledDeparture,
      scheduledArrival
    }))
    setGenerated(true)
  }

  return (
    <Modal title={`${route.departureIcao} → ${route.arrivalIcao}`} onClose={onClose}>
      {generated ? (
        <div className="booking-success"><p>Plan ouvert dans votre navigateur. Terminez-le sur SimBrief, puis revenez sur l'onglet « Importer depuis SimBrief » pour finaliser le vol.</p>
          <button type="button" className="primary" onClick={() => { onGenerated(); onClose() }}>Y aller maintenant</button></div>
      ) : (
        <div className="form">
          <div className="form-field"><span>Avion de la flotte</span>
            <select value={aircraftId ?? ''} onChange={(event) => setAircraftId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Choisir…</option>{rankedAircraft.map((item) => <option key={item.id} value={item.id}>{aircraftOptionLabel(item, route)}</option>)}
            </select>
            {defaultAircraft && getFleetRouteMatch(defaultAircraft, route) === 'positioned' ? <span className="form-hint form-hint-success">Avion compatible sélectionné automatiquement : il est déjà à {route.departureIcao}.</span> : null}
          </div>
          <label className="form-field"><span>Numéro de vol</span><div className="form-inline-group"><span className="real-flights-iata-prefix">{company.iataCode}</span>
            <input value={flightNumberDigits} onChange={(event) => setFlightNumberDigits(event.target.value.toUpperCase())} placeholder="1445" /></div>
            {suggestFlightNumber.isPending ? <span className="form-hint">Recherche d'un numéro de vol observé sur cette route…</span>
              : suggestionTried && !flightNumberDigits ? <span className="form-hint">Aucun numéro observé sur cette route, saisissez-en un.</span> : null}</label>
          <label className="form-field"><span>Date de départ (UTC)</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="form-field"><span>Heure de départ (UTC)</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <p className="form-hint">Durée de vol typique : {formatDuration(route.typicalDurationMinutes)}</p>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions"><button type="button" onClick={onClose}>Annuler</button><button type="button" className="primary" onClick={handleGenerate}>Générer le plan sur SimBrief</button></div>
        </div>
      )}
    </Modal>
  )
}
