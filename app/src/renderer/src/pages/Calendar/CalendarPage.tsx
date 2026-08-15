import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlights, useCancelFlight, useDeleteFlight } from '@renderer/hooks/useFlights'
import { useArmedFlightId, useArmFlight } from '@renderer/hooks/useArmedFlight'
import { CalendarMonth } from '@renderer/components/CalendarMonth'
import { CalendarWeek } from '@renderer/components/CalendarWeek'
import { FlightListRow } from '@renderer/components/FlightListRow'
import { parseUtc } from '@renderer/lib/format'
import { dayKeyUtc } from '@renderer/lib/calendarGrid'
import type { FlightStatus } from '@shared/types/flight'

type StatusFilter = FlightStatus | 'all'
type ViewMode = 'month' | 'week'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'upcoming', label: 'À venir' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' }
]

export function CalendarPage() {
  const { data: flights, isLoading } = useFlights()
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const cancelMutation = useCancelFlight()
  const deleteMutation = useDeleteFlight()
  const armFlightMutation = useArmFlight()
  const { data: armedFlightId } = useArmedFlightId()
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    if (!flights) return []
    let result = flights
    if (statusFilter !== 'all') {
      result = result.filter((flight) => flight.status === statusFilter)
    }
    if (selectedDate) {
      const key = dayKeyUtc(selectedDate)
      result = result.filter((flight) => dayKeyUtc(parseUtc(flight.scheduledDeparture)) === key)
    }
    return result
  }, [flights, statusFilter, selectedDate])

  function handleCancel(id: number) {
    setActionError(null)
    cancelMutation.mutateAsync(id).catch((error: Error) => setActionError(error.message))
  }

  function handleDelete(id: number) {
    setActionError(null)
    deleteMutation
      .mutateAsync(id)
      .then(() => setConfirmingDeleteId(null))
      .catch((error: Error) => setActionError(error.message))
  }

  function handleStart(id: number) {
    setActionError(null)
    armFlightMutation
      .mutateAsync(id)
      .then(() => navigate('/suivi'))
      .catch((error: Error) => setActionError(error.message))
  }

  if (isLoading || !flights) {
    return <p className="page-loading">Chargement…</p>
  }

  return (
    <div className="fleet-page">
      <h1>Calendrier</h1>

      <div className="tabs">
        <button type="button" className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>
          Semaine
        </button>
        <button type="button" className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>
          Mois
        </button>
      </div>

      {viewMode === 'week' ? (
        <CalendarWeek flights={flights} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      ) : (
        <CalendarMonth flights={flights} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      )}

      <div className="fleet-toolbar calendar-list-toolbar">
        {STATUS_FILTERS.map((item) => (
          <button
            type="button"
            key={item.value}
            className={statusFilter === item.value ? 'active' : ''}
            onClick={() => setStatusFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
        {selectedDate ? (
          <button type="button" className="calendar-clear-day" onClick={() => setSelectedDate(null)}>
            Effacer le filtre du jour ×
          </button>
        ) : null}
      </div>

      {actionError ? <p className="form-error">{actionError}</p> : null}

      {filtered.length === 0 ? (
        <p className="empty-hint">Aucun vol pour ces filtres.</p>
      ) : (
        <div className="list">
          {filtered.map((flight) => (
            <FlightListRow
              key={flight.id}
              flight={flight}
              actions={
                <>
                  {flight.status === 'upcoming' ? (
                    <>
                      {armedFlightId === flight.id ? (
                        <button type="button" onClick={() => navigate('/suivi')}>
                          Suivi en cours
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStart(flight.id)}
                          disabled={armFlightMutation.isPending || (armedFlightId != null && armedFlightId !== flight.id)}
                          title={armedFlightId != null && armedFlightId !== flight.id ? 'Un autre vol est déjà suivi' : undefined}
                        >
                          Démarrer ce vol
                        </button>
                      )}
                      <button type="button" onClick={() => handleCancel(flight.id)} disabled={cancelMutation.isPending}>
                        Annuler le vol
                      </button>
                    </>
                  ) : null}
                  {flight.status === 'in_progress' ? (
                    armedFlightId === flight.id ? (
                      <button type="button" onClick={() => navigate('/suivi')}>
                        Suivi en cours
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStart(flight.id)}
                        disabled={armFlightMutation.isPending || (armedFlightId != null && armedFlightId !== flight.id)}
                        title={armedFlightId != null && armedFlightId !== flight.id ? 'Un autre vol est déjà suivi' : undefined}
                      >
                        Reprendre le suivi
                      </button>
                    )
                  ) : null}
                  {confirmingDeleteId === flight.id ? (
                    <>
                      <button type="button" className="danger" onClick={() => handleDelete(flight.id)}>
                        Confirmer
                      </button>
                      <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                        Non
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmingDeleteId(flight.id)}>
                      Supprimer
                    </button>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
