import { useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import type { FlightWithRelations } from '@shared/types/flight'
import { CompanyLogo } from '@renderer/components/CompanyLogo'
import { Badge } from '@renderer/components/Badge'
import { parseUtc, formatTime, formatFlightDuration } from '@renderer/lib/format'
import { FLIGHT_STATUS_LABEL, FLIGHT_STATUS_VARIANT } from '@renderer/lib/labels'
import { addWeeksUtc, dayKeyUtc, getWeekGridUtc, isTodayUtc, startOfWeekUtc } from '@renderer/lib/calendarGrid'

interface CalendarWeekProps {
  flights: FlightWithRelations[]
  selectedDate: Date | null
  onSelectDate: (date: Date | null) => void
}

const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function CalendarWeek({ flights, selectedDate, onSelectDate }: CalendarWeekProps) {
  const [cursor, setCursor] = useState(() => startOfWeekUtc(new Date()))

  const flightsByDay = useMemo(() => {
    const map = new Map<string, FlightWithRelations[]>()
    for (const flight of flights) {
      const key = dayKeyUtc(parseUtc(flight.scheduledDeparture))
      const list = map.get(key) ?? []
      list.push(flight)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => parseUtc(a.scheduledDeparture).getTime() - parseUtc(b.scheduledDeparture).getTime())
    }
    return map
  }, [flights])

  const grid = useMemo(() => getWeekGridUtc(cursor), [cursor])

  return (
    <div className="calendar-week">
      <div className="calendar-month-header">
        <button type="button" onClick={() => setCursor((current) => addWeeksUtc(current, -1))} aria-label="Semaine précédente">
          ‹
        </button>
        <span className="calendar-month-title">
          Semaine du {formatInTimeZone(grid[0], 'UTC', 'd MMMM', { locale: fr })} au{' '}
          {formatInTimeZone(grid[6], 'UTC', 'd MMMM yyyy', { locale: fr })}
        </span>
        <button type="button" onClick={() => setCursor((current) => addWeeksUtc(current, 1))} aria-label="Semaine suivante">
          ›
        </button>
        <button type="button" className="calendar-today-btn" onClick={() => setCursor(startOfWeekUtc(new Date()))}>
          Cette semaine
        </button>
      </div>

      <div className="calendar-week-grid">
        {grid.map((day, index) => {
          const key = dayKeyUtc(day)
          const dayFlights = flightsByDay.get(key) ?? []
          const selected = selectedDate ? dayKeyUtc(selectedDate) === key : false

          return (
            <div key={key} className={'calendar-week-day' + (isTodayUtc(day) ? ' calendar-week-day-today' : '')}>
              <button
                type="button"
                className={'calendar-week-day-header' + (selected ? ' calendar-week-day-header-selected' : '')}
                onClick={() => onSelectDate(selected ? null : day)}
              >
                <span className="calendar-week-day-name">{WEEKDAY_LABELS[index]}</span>
                <span className="calendar-week-day-number">{formatInTimeZone(day, 'UTC', 'd MMM', { locale: fr })}</span>
              </button>

              <div className="calendar-week-day-body">
                {dayFlights.length === 0 ? (
                  <p className="calendar-week-empty">—</p>
                ) : (
                  dayFlights.map((flight) => (
                    <button
                      type="button"
                      key={flight.id}
                      className="calendar-week-flight"
                      onClick={() => onSelectDate(selected ? null : day)}
                    >
                      <div className="calendar-week-flight-top">
                        <span className="calendar-week-flight-time">{formatTime(flight.scheduledDeparture)}</span>
                        <Badge label={FLIGHT_STATUS_LABEL[flight.status]} variant={FLIGHT_STATUS_VARIANT[flight.status]} />
                      </div>
                      <div className="calendar-week-flight-company">
                        <CompanyLogo
                          logoFilename={flight.company.logoFilename}
                          icaoCode={flight.company.icaoCode}
                          width={44}
                          height={26}
                        />
                        <span className="calendar-week-flight-aircraft">{flight.aircraft?.type ?? 'Avion non défini'}</span>
                      </div>
                      <span className="calendar-week-flight-route">
                        {flight.departureIcao} → {flight.arrivalIcao}
                      </span>
                      <span className="calendar-week-flight-duration">
                        {formatFlightDuration(flight.scheduledDeparture, flight.scheduledArrival)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
