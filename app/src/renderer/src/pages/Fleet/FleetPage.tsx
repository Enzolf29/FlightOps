import { useMemo, useState } from 'react'
import { useCompanies, useUpdateCompany } from '@renderer/hooks/useCompanies'
import { useAircraft, useCreateAircraft, useUpdateAircraft, useDeleteAircraft } from '@renderer/hooks/useAircraft'
import { usePirepsByAircraft } from '@renderer/hooks/usePireps'
import { CompanyLogo } from '@renderer/components/CompanyLogo'
import { Modal } from '@renderer/components/Modal'
import { AircraftForm } from '@renderer/components/AircraftForm'
import { PirepListRow } from '@renderer/components/PirepListRow'
import { PirepDetail } from '@renderer/components/PirepDetail'
import { StatGrid } from '@renderer/components/StatGrid'
import { ActivityIcon, ClockIcon, DropletIcon, GaugeIcon, MapPinIcon, RouteIcon } from '@renderer/components/icons'
import { formatHours, formatDateTime } from '@renderer/lib/format'
import { getAirportLabel } from '@shared/airports/airportNames'
import type { AircraftInput, AircraftWithStats } from '@shared/types/aircraft'
import type { CallsignPattern, Company } from '@shared/types/company'

type Tab = 'aircraft' | 'companies'

const CALLSIGN_PATTERNS: CallsignPattern[] = ['XXX0000', 'XXX000', 'XXX00AB', 'XXX00A', 'RANDOM']

const CALLSIGN_PATTERN_LABEL: Record<CallsignPattern, string> = {
  XXX0000: 'XXX0000',
  XXX000: 'XXX000',
  XXX00AB: 'XXX00AB',
  XXX00A: 'XXX00A',
  RANDOM: 'Aléatoire'
}

type AircraftSortKey = 'company' | 'type' | 'registration' | 'flightCount' | 'cumulativeHours'
type SortDirection = 'asc' | 'desc'

function compareAircraft(a: AircraftWithStats, b: AircraftWithStats, key: AircraftSortKey): number {
  switch (key) {
    case 'company':
      return a.company.displayName.localeCompare(b.company.displayName)
    case 'type':
      return a.type.localeCompare(b.type)
    case 'registration':
      return (a.registration ?? '').localeCompare(b.registration ?? '')
    case 'flightCount':
      return a.flightCount - b.flightCount
    case 'cumulativeHours':
      return a.cumulativeHours - b.cumulativeHours
  }
}

interface SortHeaderProps {
  label: string
  sortKey: AircraftSortKey
  activeKey: AircraftSortKey
  direction: SortDirection
  onSort: (key: AircraftSortKey) => void
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

export function FleetPage() {
  const [tab, setTab] = useState<Tab>('aircraft')

  return (
    <div className="fleet-page">
      <h1>Flotte</h1>

      <div className="tabs">
        <button type="button" className={tab === 'aircraft' ? 'active' : ''} onClick={() => setTab('aircraft')}>
          Avions
        </button>
        <button type="button" className={tab === 'companies' ? 'active' : ''} onClick={() => setTab('companies')}>
          Compagnies
        </button>
      </div>

      {tab === 'aircraft' ? <AircraftTab /> : <CompaniesTab />}
    </div>
  )
}

function AircraftTab() {
  const { data: companies } = useCompanies()
  const [companyFilter, setCompanyFilter] = useState<number | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const { data: aircraft, isLoading } = useAircraft(companyFilter === 'all' ? undefined : companyFilter)
  const createMutation = useCreateAircraft()
  const updateMutation = useUpdateAircraft()
  const deleteMutation = useDeleteAircraft()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AircraftWithStats | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<AircraftSortKey>('company')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [flightsAircraft, setFlightsAircraft] = useState<AircraftWithStats | null>(null)

  const types = useMemo(() => {
    if (!aircraft) return []
    return Array.from(new Set(aircraft.map((item) => item.type))).sort()
  }, [aircraft])

  const filtered = useMemo(() => {
    if (!aircraft) return []
    return typeFilter === 'all' ? aircraft : aircraft.filter((item) => item.type === typeFilter)
  }, [aircraft, typeFilter])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => compareAircraft(a, b, sortKey) * (sortDirection === 'asc' ? 1 : -1))
    return copy
  }, [filtered, sortKey, sortDirection])

  function handleSort(key: AircraftSortKey) {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  function openCreate() {
    setEditing(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(item: AircraftWithStats) {
    setEditing(item)
    setFormError(null)
    setFormOpen(true)
  }

  function handleSubmit(input: AircraftInput) {
    setFormError(null)
    const mutation = editing
      ? updateMutation.mutateAsync({ id: editing.id, patch: input })
      : createMutation.mutateAsync(input)
    mutation.then(() => setFormOpen(false)).catch((error: Error) => setFormError(error.message))
  }

  function handleDelete(id: number) {
    setDeleteError(null)
    deleteMutation
      .mutateAsync(id)
      .then(() => setConfirmingDeleteId(null))
      .catch((error: Error) => setDeleteError(error.message))
  }

  if (isLoading || !companies) {
    return <p className="page-loading">Chargement…</p>
  }

  return (
    <div>
      <div className="fleet-toolbar">
        <select
          value={companyFilter}
          onChange={(event) => setCompanyFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}
        >
          <option value="all">Toutes les compagnies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
        </select>

        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="all">Tous les types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <button type="button" className="primary fleet-add-btn" onClick={openCreate}>
          + Ajouter un avion
        </button>
      </div>

      {deleteError ? <p className="form-error">{deleteError}</p> : null}

      {filtered.length === 0 ? (
        <p className="empty-hint">Aucun avion pour ces filtres.</p>
      ) : (
        <div className="fleet-table">
          <div className="fleet-table-header fleet-table-aircraft">
            <SortHeader label="Compagnie" sortKey="company" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortHeader label="Type" sortKey="type" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortHeader
              label="Immat."
              sortKey="registration"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortHeader
              label="Cycles"
              sortKey="flightCount"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortHeader
              label="Heures"
              sortKey="cumulativeHours"
              activeKey={sortKey}
              direction={sortDirection}
              onSort={handleSort}
            />
            <span>Dernière position</span>
            <span></span>
          </div>
          {sorted.map((item) => (
            <div className="fleet-table-row fleet-table-aircraft" key={item.id}>
              <span className="fleet-table-company">
                <CompanyLogo logoFilename={item.company.logoFilename} icaoCode={item.company.icaoCode} width={110} height={46} />
                {item.company.displayName}
              </span>
              <span>{item.type}</span>
              <span>{item.registration ?? '—'}</span>
              <span>{item.flightCount}</span>
              <span>{formatHours(item.cumulativeHours)}</span>
              <span>
                {item.lastKnownIcao ? (
                  <>
                    {getAirportLabel(item.lastKnownIcao)}
                    {item.lastKnownAt ? (
                      <span className="fleet-table-position-time"> ({formatDateTime(item.lastKnownAt)})</span>
                    ) : null}
                  </>
                ) : (
                  '—'
                )}
              </span>
              <span className="fleet-table-actions">
                {confirmingDeleteId === item.id ? (
                  <>
                    <button type="button" className="danger" onClick={() => handleDelete(item.id)}>
                      Confirmer
                    </button>
                    <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="primary" onClick={() => setFlightsAircraft(item)}>
                      Fiche
                    </button>
                    <button type="button" onClick={() => openEdit(item)}>
                      Modifier
                    </button>
                    <button type="button" onClick={() => setConfirmingDeleteId(item.id)}>
                      Supprimer
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {formOpen ? (
        <Modal title={editing ? 'Modifier l’avion' : 'Ajouter un avion'} onClose={() => setFormOpen(false)}>
          <AircraftForm
            companies={companies}
            initial={editing}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
            submitting={createMutation.isPending || updateMutation.isPending}
            errorMessage={formError}
          />
        </Modal>
      ) : null}

      {flightsAircraft ? (
        <AircraftFlightsModal aircraft={flightsAircraft} onClose={() => setFlightsAircraft(null)} />
      ) : null}
    </div>
  )
}

interface AircraftFlightsModalProps {
  aircraft: AircraftWithStats
  onClose: () => void
}

function AircraftFlightsModal({ aircraft, onClose }: AircraftFlightsModalProps) {
  const { data: pireps, isLoading } = usePirepsByAircraft(aircraft.id)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const selected = pireps?.find((pirep) => pirep.id === selectedId) ?? null

  return (
    <Modal title={`Fiche avion · ${aircraft.type}${aircraft.registration ? ` (${aircraft.registration})` : ''}`} onClose={onClose} wide>
      <div className="aircraft-record-header">
        <CompanyLogo
          logoFilename={aircraft.company.logoFilename}
          icaoCode={aircraft.company.icaoCode}
          width={130}
          height={58}
        />
        <div>
          <strong>{aircraft.type}</strong>
          <span>{aircraft.registration ?? 'Immatriculation non renseignée'} · {aircraft.company.displayName}</span>
        </div>
      </div>

      <div className="aircraft-record-stats">
        <StatGrid
          compact
          items={[
          {
            key: 'position',
            label: 'Dernière position',
            value: aircraft.lastKnownIcao ? getAirportLabel(aircraft.lastKnownIcao) : 'Aucun vol',
            detail: aircraft.lastKnownAt ? `Arrivée ${formatDateTime(aircraft.lastKnownAt)}` : undefined,
            icon: <MapPinIcon />
          },
          {
            key: 'hours',
            label: 'Heures totales',
            value: formatHours(aircraft.cumulativeHours),
            icon: <ClockIcon />
          },
          {
            key: 'cycles',
            label: 'Cycles',
            value: String(aircraft.cycleCount),
            detail: `${aircraft.cycleCount} vol${aircraft.cycleCount > 1 ? 's' : ''} terminé${aircraft.cycleCount > 1 ? 's' : ''}`,
            icon: <ActivityIcon />
          },
          {
            key: 'landing',
            label: 'Atterrissage moyen',
            value: aircraft.averageLandingFpm === null ? '—' : `${Math.round(aircraft.averageLandingFpm)} ft/min`,
            icon: <GaugeIcon />
          },
          {
            key: 'fuel',
            label: 'Consommation moyenne',
            value: aircraft.averageFuelConsumptionKg === null ? '—' : `${Math.round(aircraft.averageFuelConsumptionKg)} kg`,
            detail: 'Démarrage à coupure moteurs',
            icon: <DropletIcon />
          },
          {
            key: 'distance',
            label: 'Distance moyenne',
            value: aircraft.averageDistanceNm === null ? '—' : `${Math.round(aircraft.averageDistanceNm)} NM`,
            detail: 'Trajectoire réellement parcourue',
            icon: <RouteIcon />
          },
          {
            key: 'visited',
            label: 'Aéroport le plus visité',
            value: aircraft.mostVisitedIcao ? getAirportLabel(aircraft.mostVisitedIcao) : '—',
            detail: aircraft.mostVisitedIcao ? `${aircraft.mostVisitedCount} arrivée${aircraft.mostVisitedCount > 1 ? 's' : ''}` : undefined,
            icon: <MapPinIcon />
          }
          ]}
        />
      </div>

      <div className="aircraft-history-title">
        <h3>Historique des vols</h3>
        <span>{pireps?.length ?? 0} vol{(pireps?.length ?? 0) > 1 ? 's' : ''}</span>
      </div>
      {isLoading ? (
        <p className="page-loading">Chargement…</p>
      ) : !pireps || pireps.length === 0 ? (
        <p className="empty-hint">Aucun vol terminé avec cet avion pour le moment.</p>
      ) : (
        <div className="list">
          {pireps.map((pirep) => (
            <PirepListRow key={pirep.id} pirep={pirep} onClick={() => setSelectedId(pirep.id)} />
          ))}
        </div>
      )}

      {selected ? (
        <Modal title={`PIREP · ${selected.flight.callsignDisplay}`} onClose={() => setSelectedId(null)} wide>
          <PirepDetail pirep={selected} />
        </Modal>
      ) : null}
    </Modal>
  )
}

function CompaniesTab() {
  const { data: companies, isLoading } = useCompanies()
  const updateMutation = useUpdateCompany()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [radioCallsign, setRadioCallsign] = useState('')
  const [callsignPattern, setCallsignPattern] = useState<CallsignPattern>('XXX0000')
  const [error, setError] = useState<string | null>(null)

  function startEdit(company: Company) {
    setEditingId(company.id)
    setRadioCallsign(company.radioCallsign)
    setCallsignPattern(company.callsignPattern)
    setError(null)
  }

  function save(id: number) {
    setError(null)
    updateMutation
      .mutateAsync({ id, patch: { radioCallsign: radioCallsign.trim(), callsignPattern } })
      .then(() => setEditingId(null))
      .catch((err: Error) => setError(err.message))
  }

  if (isLoading || !companies) {
    return <p className="page-loading">Chargement…</p>
  }

  return (
    <div>
      <p className="fleet-companies-hint">
        Callsign radio et format utilisés pour générer les callsigns de vol (ex. « AIRFRANS 48SB »).
      </p>
      <div className="fleet-table fleet-table-companies">
        <div className="fleet-table-header">
          <span>Compagnie</span>
          <span>ICAO</span>
          <span>IATA</span>
          <span>Callsign radio</span>
          <span>Pattern</span>
          <span></span>
        </div>
        {companies.map((company) => (
          <div className="fleet-table-row" key={company.id}>
            <span className="fleet-table-company">
              <CompanyLogo logoFilename={company.logoFilename} icaoCode={company.icaoCode} width={110} height={46} />
              {company.displayName}
            </span>
            <span>{company.icaoCode}</span>
            <span>{company.iataCode}</span>
            {editingId === company.id ? (
              <>
                <span>
                  <input value={radioCallsign} onChange={(event) => setRadioCallsign(event.target.value)} />
                </span>
                <span>
                  <select
                    value={callsignPattern}
                    onChange={(event) => setCallsignPattern(event.target.value as CallsignPattern)}
                  >
                    {CALLSIGN_PATTERNS.map((pattern) => (
                      <option key={pattern} value={pattern}>
                        {CALLSIGN_PATTERN_LABEL[pattern]}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="fleet-table-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => save(company.id)}
                    disabled={updateMutation.isPending}
                  >
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}>
                    Annuler
                  </button>
                </span>
              </>
            ) : (
              <>
                <span>{company.radioCallsign}</span>
                <span>{CALLSIGN_PATTERN_LABEL[company.callsignPattern]}</span>
                <span className="fleet-table-actions">
                  <button type="button" onClick={() => startEdit(company)}>
                    Modifier
                  </button>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}
