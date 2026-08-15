import { useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import type { FlightWithRelations } from '@shared/types/flight'
import { parseUtc } from '@renderer/lib/format'
import {
  addMonthsUtc,
  dayKeyUtc,
  getMonthGridUtc,
  isSameDayUtc,
  isSameMonthUtc,
  isTodayUtc,
  startOfMonthUtc
} from '@renderer/lib/calendarGrid'

interface CalendarMonthProps {
  flights: FlightWithRelations[]
  selectedDate: Date | null
  onSelectDate: (date: Date | null) => void
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function CalendarMonth({ flights, selectedDate, onSelectDate }: CalendarMonthProps) {
  const [cursor, setCursor] = useState(() => startOfMonthUtc(new Date()))

  const flightsByDay = useMemo(() => {
    const map = new Map<string, FlightWithRelations[]>()
    for (const flight of flights) {
      const key = dayKeyUtc(parseUtc(flight.scheduledDeparture))
      const list = map.get(key) ?? []
      list.push(flight)
      map.set(key, list)
    }
    return map
  }, [flights])

  const grid = useMemo(() => getMonthGridUtc(cursor), [cursor])

  return (
    <div className="calendar-month">
      <div className="calendar-month-header">
        <button type="button" onClick={() => setCursor((current) => addMonthsUtc(current, -1))} aria-label="Mois précédent">
          ‹
        </button>
        <span className="calendar-month-title">{formatInTimeZone(cursor, 'UTC', 'LLLL yyyy', { locale: fr })}</span>
        <button type="button" onClick={() => setCursor((current) => addMonthsUtc(current, 1))} aria-label="Mois suivant">
          ›
        </button>
        <button type="button" className="calendar-today-btn" onClick={() => setCursor(startOfMonthUtc(new Date()))}>
          Aujourd'hui
        </button>
      </div>

      <div className="calendar-grid calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {grid.map((day) => {
          const key = dayKeyUtc(day)
          const dayFlights = flightsByDay.get(key) ?? []
          const inMonth = isSameMonthUtc(day, cursor)
          const selected = selectedDate ? isSameDayUtc(day, selectedDate) : false

          return (
            <button
              type="button"
              key={key}
              className={
                'calendar-day' +
                (inMonth ? '' : ' calendar-day-outside') +
                (selected ? ' calendar-day-selected' : '') +
                (isTodayUtc(day) ? ' calendar-day-today' : '')
              }
              onClick={() => onSelectDate(selected ? null : day)}
            >
              <span className="calendar-day-number">{day.getUTCDate()}</span>
              {dayFlights.length > 0 ? (
                <span className="calendar-day-dots">
                  {dayFlights.slice(0, 4).map((flight) => (
                    <span key={flight.id} className={`calendar-dot calendar-dot-${flight.status}`} />
                  ))}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
