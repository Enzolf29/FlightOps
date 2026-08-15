import { describe, expect, it } from 'vitest'
import { parseUtc, isoToSqliteUtc } from './datetime'

describe('parseUtc', () => {
  it('parses SQLite datetime() values as UTC', () => {
    expect(parseUtc('2026-08-01 12:30:00').toISOString()).toBe('2026-08-01T12:30:00.000Z')
  })

  it('parses full ISO strings without doubling the Z', () => {
    expect(parseUtc('2026-08-01T12:30:00.000Z').toISOString()).toBe('2026-08-01T12:30:00.000Z')
  })
})

describe('isoToSqliteUtc', () => {
  it('strips milliseconds and the Z, replacing T with a space', () => {
    expect(isoToSqliteUtc('2026-08-01T12:30:00.000Z')).toBe('2026-08-01 12:30:00')
  })
})
