import { useEffect, useMemo, useState } from 'react'
import type { Company } from '@shared/types/company'
import type { RealRoute } from '@shared/types/realFlights'
import { useCompanies } from '@renderer/hooks/useCompanies'
import { useAircraft } from '@renderer/hooks/useAircraft'
import { useListKnownRoutes, useSearchRealRoutes, useSuggestFlightNumber } from '@renderer/hooks/useRealFlights'
import { CompanyPicker } from '@renderer/components/CompanyPicker'
import { Modal } from '@renderer/components/Modal'
import { RealFlightsMap } from '@renderer/components/RealFlightsMap'
import { getAirportLabel } from '@shared/airports/airportNames'
import { getAirportCoordinates } from '@shared/airports/airportCoordinates'
import { buildDispatchPrefillUrl } from '@shared/simbrief/buildDispatchPrefillUrl'
import { generateCallsign } from '@shared/callsign/generateCallsign'

type SortKey = 'destination' | 'duration' | 'aircraftCount'
type SortDirection = 'asc' | 'desc'

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
  return hours * 60 + minutes
}

function compareRoutes(a: RealRoute, b: RealRoute, key: SortKey): number {
  switch (key) {
    case 'duration':
      return (a.typicalDurationMinutes ?? Infinity) - (b.typicalDurationMinutes ?? Infinity)
    case 'aircraftCount':
      return a.aircraft.length - b.aircraft.length
    case 'destination':
    default:
      return a.arrivalIcao.localeCompare(b.arrivalIcao)
  }
}

interface SortHeaderProps {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
}

function SortHeader({ label, sortKey, activeKey, direction, onSort }: SortHeaderProps) {
  const isActive = sortKey === activeKey
  return (
    <button type="button" className={'fleet-table-sort' + (isActive ? ' active' : '')} onClick={() => onSort(sortKey)}>
      {label}
      <span className="fleet-table-sort-arrow">{isActive ? (direction === 'asc' ? '▲' : '▼') : ''}</span>
    </button>
  )
}

interface RealFlightsBrowserProps {
  onGenerated: () => void
}

export function RealFlightsBrowser({ onGenerated }: RealFlightsBrowserProps) {
  const { data: companies } = useCompanies()
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [departureIcao, setDepartureIcao] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('destination')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [aircraftFilter, setAircraftFilter] = useState('')
  const [maxDurationTime, setMaxDurationTime] = useState('')
  const [selectedRoute, setSelectedRoute] = useState<RealRoute | null>(null)
  const [resultMode, setResultMode] = useState<'search' | 'browseAll' | null>(null)

  const search = useSearchRealRoutes()
  const browseAll = useListKnownRoutes()
  const selectedCompany = companies?.find((company) => company.id === companyId) ?? null

  // Dès qu'une compagnie est choisie sans aéroport de départ précisé, on affiche tout de suite ce
  // qui est déjà connu en cache (real_routes) — sans appel API — plutôt que d'attendre une action
  // explicite : "tous les vols connus" doit apparaître même sans indiquer de départ.
  useEffect(() => {
    if (companyId && !departureIcao.trim()) {
      setResultMode('browseAll')
      browseAll.mutate(companyId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const activeRoutes = resultMode === 'browseAll' ? browseAll.data : search.data?.routes
  const isPending = resultMode === 'browseAll' ? browseAll.isPending : search.isPending
  const isError = resultMode === 'browseAll' ? browseAll.isError : search.isError
  const activeError = resultMode === 'browseAll' ? browseAll.error : search.error

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
    if (key === sortKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const allAircraftTypes = useMemo(() => {
    const set = new Set<string>()
    for (const route of activeRoutes ?? []) {
      for (const aircraft of route.aircraft) set.add(aircraft.typeDescription)
    }
    return [...set].sort()
  }, [activeRoutes])

  const visibleRoutes = useMemo(() => {
    const routes = activeRoutes ?? []
    const maxMinutes = parseHhMmToMinutes(maxDurationTime)

    const filtered = routes.filter((route) => {
      if (aircraftFilter && !route.aircraft.some((aircraft) => aircraft.typeDescription === aircraftFilter)) {
        return false
      }
      if (maxMinutes !== null && (route.typicalDurationMinutes === null || route.typicalDurationMinutes > maxMinutes)) {
        return false
      }
      return true
    })

    return [...filtered].sort((a, b) => compareRoutes(a, b, sortKey) * (sortDirection === 'asc' ? 1 : -1))
  }, [activeRoutes, aircraftFilter, maxDurationTime, sortKey, sortDirection])

  const mapRoutes = useMemo(
    () =>
      visibleRoutes
        .map((route) => {
          const departureCoords = getAirportCoordinates(route.departureIcao)
          const arrivalCoords = getAirportCoordinates(route.arrivalIcao)
          if (!departureCoords || !arrivalCoords) return null
          return {
            id: route.id,
            departure: { icao: route.departureIcao, ...departureCoords },
            arrival: { icao: route.arrivalIcao, ...arrivalCoords }
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [visibleRoutes]
  )
  const routesMissingCoordinates = visibleRoutes.length - mapRoutes.length

  if (!companies) {
    return <p className="page-loading">Chargement…</p>
  }

  return (
    <div className="real-flights">
      <div className="form-field">
        <span>Compagnie</span>
        <CompanyPicker
          companies={companies}
          value={companyId}
          onChange={(id) => {
            setCompanyId(id)
            setSelectedRoute(null)
          }}
        />
      </div>

      <label className="form-field">
        <span>Aéroport de départ (optionnel)</span>
        <div className="form-inline-group">
          <input
            value={departureIcao}
            onChange={(event) => setDepartureIcao(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch(false)
            }}
            placeholder="LFPG"
            maxLength={4}
          />
          <button type="button" className="primary" onClick={() => handleSearch(false)} disabled={!companyId || isPending}>
            {isPending ? 'Recherche…' : departureIcao.trim() ? 'Rechercher' : 'Voir tous les vols connus'}
          </button>
        </div>
      </label>

      {isError ? <p className="form-error">{(activeError as Error).message}</p> : null}

      {activeRoutes ? (
        <>
          <p className="empty-hint">
            {resultMode === 'browseAll'
              ? 'Tous les vols déjà connus en cache local pour cette compagnie, tous aéroports de départ confondus.'
              : search.data?.fetchedFromApi
                ? 'Résultats récupérés depuis AeroDataBox.'
                : 'Résultats depuis le cache local.'}{' '}
            {resultMode === 'search' ? (
              <button type="button" className="settings-link" onClick={() => handleSearch(true)} disabled={isPending}>
                Actualiser depuis l'API
              </button>
            ) : null}
          </p>

          {activeRoutes.length === 0 ? (
            <p className="empty-hint">
              {resultMode === 'browseAll'
                ? `Aucun vol connu en cache pour ${selectedCompany?.displayName}. Indiquez un aéroport de départ pour interroger l'API.`
                : `Aucune route trouvée pour ${selectedCompany?.displayName} au départ de ${departureIcao.trim().toUpperCase()}.`}
            </p>
          ) : (
            <>
              <div className="real-flights-toolbar">
                <label>
                  Filtrer par avion{' '}
                  <select value={aircraftFilter} onChange={(event) => setAircraftFilter(event.target.value)}>
                    <option value="">Tous</option>
                    {allAircraftTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Durée max{' '}
                  <input
                    type="time"
                    className="real-flights-duration-input"
                    value={maxDurationTime}
                    onChange={(event) => setMaxDurationTime(event.target.value)}
                  />
                </label>
              </div>

              <RealFlightsMap
                routes={mapRoutes}
                onSelectRoute={(routeId) => {
                  const route = visibleRoutes.find((item) => item.id === routeId)
                  if (route) setSelectedRoute(route)
                }}
              />
              {routesMissingCoordinates > 0 ? (
                <p className="empty-hint">
                  {routesMissingCoordinates} route{routesMissingCoordinates > 1 ? 's' : ''} sans coordonnées connues,
                  non affichée{routesMissingCoordinates > 1 ? 's' : ''} sur la carte.
                </p>
              ) : null}

              {visibleRoutes.length === 0 ? (
                <p className="empty-hint">Aucune route ne correspond aux filtres actuels.</p>
              ) : (
                <div className="real-flights-list">
                  <div className="real-flights-row real-flights-header">
                    <SortHeader label="Destination" sortKey="destination" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortHeader label="Avion(s)" sortKey="aircraftCount" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortHeader label="Durée" sortKey="duration" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <span>Statut</span>
                  </div>

                  {visibleRoutes.map((route) => (
                    <button
                      type="button"
                      key={route.id}
                      className="real-flights-row"
                      onClick={() => setSelectedRoute(route)}
                    >
                      <span className="real-flights-route">
                        {getAirportLabel(route.departureIcao)} → {getAirportLabel(route.arrivalIcao)}
                      </span>
                      <span className="real-flights-aircraft">
                        {route.aircraft.length > 0
                          ? route.aircraft.map((aircraft) => (
                              <span key={aircraft.icaoType} className="badge badge-neutral">
                                {aircraft.typeDescription}
                              </span>
                            ))
                          : <span className="badge badge-muted">Avion inconnu</span>}
                      </span>
                      <span className="real-flights-duration">{formatDuration(route.typicalDurationMinutes)}</span>
                      <span className={'badge ' + (route.source === 'api' ? 'badge-on-time' : 'badge-muted')}>
                        {route.source === 'api' ? 'Confirmé' : 'Déduit (retour)'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {selectedRoute && selectedCompany ? (
        <BookRealRouteModal
          route={selectedRoute}
          company={selectedCompany}
          onClose={() => setSelectedRoute(null)}
          onGenerated={onGenerated}
        />
      ) : null}
    </div>
  )
}

interface BookRealRouteModalProps {
  route: RealRoute
  company: Company
  onClose: () => void
  onGenerated: () => void
}

function BookRealRouteModal({ route, company, onClose, onGenerated }: BookRealRouteModalProps) {
  const { data: fleetAircraft } = useAircraft(company.id)
  const suggestFlightNumber = useSuggestFlightNumber()

  const defaultAircraft = useMemo(() => {
    if (!fleetAircraft) return null
    return fleetAircraft.find((item) => route.aircraft.some((aircraft) => aircraft.icaoType === item.simbriefIcaoCode)) ?? null
  }, [fleetAircraft, route])

  const [aircraftId, setAircraftId] = useState<number | null>(null)
  const [flightNumberDigits, setFlightNumberDigits] = useState('')
  const [suggestionTried, setSuggestionTried] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAircraft = fleetAircraft?.find((item) => item.id === aircraftId) ?? null

  useEffect(() => {
    if (defaultAircraft && aircraftId === null) setAircraftId(defaultAircraft.id)
  }, [defaultAircraft, aircraftId])

  useEffect(() => {
    setSuggestionTried(false)
    suggestFlightNumber.mutate(route.id, {
      onSuccess: (digits) => {
        setSuggestionTried(true)
        if (digits) setFlightNumberDigits(digits)
      },
      onError: () => setSuggestionTried(true)
    })
    // La recherche du numéro de vol se relance uniquement quand la route sélectionnée change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id])

  function handleGenerate() {
    if (!selectedAircraft || !date || !time) {
      setError('Renseignez un avion de la flotte, la date et l’heure de départ.')
      return
    }

    const aircraftIcaoType = selectedAircraft.simbriefIcaoCode || selectedAircraft.type
    const scheduledDeparture = new Date(`${date}T${time}:00Z`)
    const durationMinutes = route.typicalDurationMinutes ?? 90
    const scheduledArrival = new Date(scheduledDeparture.getTime() + durationMinutes * 60000)

    const { raw: callsign } = generateCallsign({
      icaoCode: company.icaoCode,
      radioCallsign: company.radioCallsign,
      pattern: company.callsignPattern
    })

    setError(null)
    const url = buildDispatchPrefillUrl({
      originIcao: route.departureIcao,
      destIcao: route.arrivalIcao,
      aircraftIcaoType,
      airlineIcao: company.icaoCode,
      flightNumberDigits: flightNumberDigits.trim() || undefined,
      registration: selectedAircraft.registration,
      simbriefFin: selectedAircraft.simbriefFin,
      callsign,
      scheduledDeparture,
      scheduledArrival
    })

    window.flightops.app.openExternal(url)
    setGenerated(true)
  }

  return (
    <Modal title={`${route.departureIcao} → ${route.arrivalIcao}`} onClose={onClose}>
      {generated ? (
        <div className="booking-success">
          <p>
            Plan ouvert dans votre navigateur. Terminez-le sur SimBrief, puis revenez sur l'onglet « Importer depuis
            SimBrief » pour finaliser le vol.
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onGenerated()
              onClose()
            }}
          >
            Y aller maintenant
          </button>
        </div>
      ) : (
        <div className="form">
          <div className="form-field">
            <span>Avion de la flotte</span>
            <select
              value={aircraftId ?? ''}
              onChange={(event) => setAircraftId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Choisir…</option>
              {(fleetAircraft ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.type} {item.registration ? `(${item.registration})` : ''}
                </option>
              ))}
            </select>
          </div>

          <label className="form-field">
            <span>Numéro de vol</span>
            <div className="form-inline-group">
              <span className="real-flights-iata-prefix">{company.iataCode}</span>
              <input
                value={flightNumberDigits}
                onChange={(event) => setFlightNumberDigits(event.target.value.toUpperCase())}
                placeholder="1445"
              />
            </div>
            {suggestFlightNumber.isPending ? (
              <span className="form-hint">Recherche d'un numéro de vol observé sur cette route…</span>
            ) : suggestionTried && !flightNumberDigits ? (
              <span className="form-hint">Aucun numéro observé sur cette route, saisissez-en un.</span>
            ) : null}
          </label>

          <label className="form-field">
            <span>Date de départ (UTC)</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          <label className="form-field">
            <span>Heure de départ (UTC)</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>

          <p className="form-hint">Durée de vol typique : {formatDuration(route.typicalDurationMinutes)}</p>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="form-actions">
            <button type="button" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="primary" onClick={handleGenerate}>
              Générer le plan sur SimBrief
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
