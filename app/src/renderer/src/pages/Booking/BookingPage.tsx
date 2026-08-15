import { useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useCompanies } from '@renderer/hooks/useCompanies'
import { useAircraft } from '@renderer/hooks/useAircraft'
import { useFetchLatestOfp } from '@renderer/hooks/useSimbrief'
import { OfpImportPreview } from '@renderer/components/OfpImportPreview'
import { CompanyPicker } from '@renderer/components/CompanyPicker'
import { RealFlightsBrowser } from '@renderer/components/RealFlightsBrowser'
import { buildDispatchPrefillUrl } from '@shared/simbrief/buildDispatchPrefillUrl'
import { generateCallsign } from '@shared/callsign/generateCallsign'
import type { SimbriefOfp } from '@shared/types/simbrief'
import type { FlightWithRelations } from '@shared/types/flight'

function randomFlightNumberDigits(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

type Tab = 'import' | 'create' | 'real'

export function BookingPage() {
  const [tab, setTab] = useState<Tab>('import')

  return (
    <div className="fleet-page">
      <h1>Réservation de vol</h1>

      <div className="tabs">
        <button type="button" className={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}>
          Importer depuis SimBrief
        </button>
        <button type="button" className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>
          Créer un plan
        </button>
        <button type="button" className={tab === 'real' ? 'active' : ''} onClick={() => setTab('real')}>
          Vols réels
        </button>
      </div>

      {tab === 'import' ? <ImportTab /> : null}
      {tab === 'create' ? <CreateTab onGenerated={() => setTab('import')} /> : null}
      {tab === 'real' ? <RealFlightsBrowser onGenerated={() => setTab('import')} /> : null}
    </div>
  )
}

function ImportTab() {
  const { data: companies } = useCompanies()
  const fetchOfp = useFetchLatestOfp()
  const [ofp, setOfp] = useState<SimbriefOfp | null>(null)
  const [createdFlight, setCreatedFlight] = useState<FlightWithRelations | null>(null)

  function handleFetch() {
    setCreatedFlight(null)
    fetchOfp.mutate(undefined, {
      onSuccess: (data) => setOfp(data)
    })
  }

  if (!companies) {
    return <p className="page-loading">Chargement…</p>
  }

  return (
    <div className="booking-import">
      {createdFlight ? (
        <div className="booking-success">
          <p>
            Vol créé : <strong>{createdFlight.callsignDisplay}</strong> ({createdFlight.flightNumber}) ·{' '}
            {createdFlight.departureIcao} → {createdFlight.arrivalIcao}
          </p>
          <button
            type="button"
            onClick={() => {
              setCreatedFlight(null)
              setOfp(null)
            }}
          >
            Importer un autre vol
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="primary" onClick={handleFetch} disabled={fetchOfp.isPending}>
            {fetchOfp.isPending ? 'Récupération…' : 'Récupérer le dernier OFP SimBrief'}
          </button>

          {fetchOfp.isError ? <p className="form-error">{(fetchOfp.error as Error).message}</p> : null}

          {ofp ? (
            <div className="booking-ofp-preview">
              <OfpImportPreview ofp={ofp} companies={companies} source="simbrief" onCreated={setCreatedFlight} />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function CreateTab({ onGenerated }: { onGenerated: () => void }) {
  const { data: companies } = useCompanies()
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [aircraftId, setAircraftId] = useState<number | null>(null)
  const [departureIcao, setDepartureIcao] = useState('')
  const [arrivalIcao, setArrivalIcao] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: aircraft } = useAircraft(companyId ?? undefined)
  const selectedCompany = companies?.find((company) => company.id === companyId) ?? null
  const selectedAircraft = aircraft?.find((item) => item.id === aircraftId) ?? null

  const arrivalRef = useRef<HTMLInputElement>(null)
  const aircraftRef = useRef<HTMLSelectElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)

  function focusOnEnter(next: RefObject<HTMLElement | null>) {
    return (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        next.current?.focus()
      }
    }
  }

  function handleGenerate() {
    if (!selectedCompany || !departureIcao.trim() || !arrivalIcao.trim() || !selectedAircraft || !date || !time) {
      setError('Renseignez la compagnie, les ICAO départ/arrivée, un avion de la flotte, la date et l’heure.')
      return
    }

    const aircraftIcaoType = selectedAircraft.simbriefIcaoCode || selectedAircraft.type
    const scheduledDeparture = new Date(`${date}T${time}:00Z`)

    const { raw: callsign } = generateCallsign({
      icaoCode: selectedCompany.icaoCode,
      radioCallsign: selectedCompany.radioCallsign,
      pattern: selectedCompany.callsignPattern
    })

    setError(null)
    const url = buildDispatchPrefillUrl({
      originIcao: departureIcao.trim().toUpperCase(),
      destIcao: arrivalIcao.trim().toUpperCase(),
      aircraftIcaoType,
      airlineIcao: selectedCompany.icaoCode,
      flightNumberDigits: randomFlightNumberDigits(),
      registration: selectedAircraft.registration,
      simbriefFin: selectedAircraft.simbriefFin,
      callsign,
      scheduledDeparture
    })

    window.flightops.app.openExternal(url)
  }

  if (!companies) {
    return <p className="page-loading">Chargement…</p>
  }

  return (
    <div className="form booking-create-form">
      <div className="form-field">
        <span>Compagnie</span>
        <CompanyPicker
          companies={companies}
          value={companyId}
          onChange={(id) => {
            setCompanyId(id)
            setAircraftId(null)
          }}
        />
      </div>

      <label className="form-field">
        <span>ICAO départ</span>
        <input
          value={departureIcao}
          onChange={(event) => setDepartureIcao(event.target.value)}
          onKeyDown={focusOnEnter(arrivalRef)}
          placeholder="LFPG"
        />
      </label>

      <label className="form-field">
        <span>ICAO arrivée</span>
        <input
          ref={arrivalRef}
          value={arrivalIcao}
          onChange={(event) => setArrivalIcao(event.target.value)}
          onKeyDown={focusOnEnter(aircraftRef)}
          placeholder="LEMD"
        />
      </label>

      <label className="form-field">
        <span>Avion de la flotte</span>
        <select
          ref={aircraftRef}
          value={aircraftId ?? ''}
          onChange={(event) => setAircraftId(event.target.value ? Number(event.target.value) : null)}
          onKeyDown={focusOnEnter(dateRef)}
        >
          <option value="">Choisir…</option>
          {(aircraft ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.type} {item.registration ? `(${item.registration})` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Date de départ (UTC)</span>
        <input
          ref={dateRef}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          onKeyDown={focusOnEnter(timeRef)}
        />
      </label>

      <label className="form-field">
        <span>Heure de départ (UTC)</span>
        <input
          ref={timeRef}
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleGenerate()
            }
          }}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-actions">
        <button type="button" className="primary" onClick={handleGenerate}>
          Générer le plan sur SimBrief
        </button>
      </div>

      <p className="empty-hint">
        Une fois le plan terminé sur le site SimBrief, revenez sur l'onglet « Importer depuis SimBrief » pour
        finaliser le vol.{' '}
        <button type="button" className="settings-link" onClick={onGenerated}>
          Y aller maintenant
        </button>
      </p>
    </div>
  )
}
