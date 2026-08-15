import { describe, expect, it } from 'vitest'
import {
  startOfMonthUtc,
  getMonthGridUtc,
  dayKeyUtc,
  isSameMonthUtc,
  isSameDayUtc,
  startOfWeekUtc,
  getWeekGridUtc,
  addWeeksUtc
} from './calendarGrid'

describe('calendarGrid', () => {
  it('starts the grid on the Monday on/before the 1st of the month', () => {
    // August 2026 starts on a Saturday (UTC) -> grid should start Monday 27 July 2026
    const monthStart = startOfMonthUtc(new Date(Date.UTC(2026, 7, 15)))
    expect(dayKeyUtc(monthStart)).toBe('2026-08-01')

    const grid = getMonthGridUtc(monthStart)
    expect(grid).toHaveLength(42)
    expect(dayKeyUtc(grid[0])).toBe('2026-07-27')
    expect(grid[0].getUTCDay()).toBe(1) // Monday
  })

  it('covers every day of the month within the grid', () => {
    const monthStart = startOfMonthUtc(new Date(Date.UTC(2026, 1, 10))) // February 2026 (28 days)
    const grid = getMonthGridUtc(monthStart)
    const daysInMonth = grid.filter((day) => isSameMonthUtc(day, monthStart))
    expect(daysInMonth).toHaveLength(28)
  })

  it('isSameDayUtc matches only the exact UTC calendar day', () => {
    const a = new Date(Date.UTC(2026, 6, 30, 23, 0))
    const b = new Date(Date.UTC(2026, 6, 30, 1, 0))
    const c = new Date(Date.UTC(2026, 6, 31, 1, 0))
    expect(isSameDayUtc(a, b)).toBe(true)
    expect(isSameDayUtc(a, c)).toBe(false)
  })

  it('starts the week grid on the Monday on/before the given date', () => {
    // 2026-08-15 is a Saturday (UTC) -> week should start Monday 2026-08-10
    const weekStart = startOfWeekUtc(new Date(Date.UTC(2026, 7, 15, 18, 30)))
    expect(dayKeyUtc(weekStart)).toBe('2026-08-10')
    expect(weekStart.getUTCDay()).toBe(1) // Monday
    expect(weekStart.getUTCHours()).toBe(0)

    const grid = getWeekGridUtc(weekStart)
    expect(grid).toHaveLength(7)
    expect(dayKeyUtc(grid[0])).toBe('2026-08-10')
    expect(dayKeyUtc(grid[6])).toBe('2026-08-16')
  })

  it('addWeeksUtc shifts by whole weeks', () => {
    const weekStart = startOfWeekUtc(new Date(Date.UTC(2026, 7, 15)))
    const nextWeek = addWeeksUtc(weekStart, 1)
    expect(dayKeyUtc(nextWeek)).toBe('2026-08-17')
    const previousWeek = addWeeksUtc(weekStart, -1)
    expect(dayKeyUtc(previousWeek)).toBe('2026-08-03')
  })
})
