import { describe, expect, it } from 'vitest'
import { parseUtc, formatDateTime, formatTime } from './format'

describe('parseUtc', () => {
  it('parses SQLite datetime() values (space-separated, no offset) as UTC', () => {
    const date = parseUtc('2026-08-01 12:30:00')
    expect(date.toISOString()).toBe('2026-08-01T12:30:00.000Z')
  })

  it('parses full ISO strings that already carry a Z suffix without doubling it', () => {
    const date = parseUtc('2026-08-01T12:30:00.000Z')
    expect(date.toISOString()).toBe('2026-08-01T12:30:00.000Z')
  })

  it('parses ISO strings with a numeric offset', () => {
    const date = parseUtc('2026-08-01T12:30:00+02:00')
    expect(date.toISOString()).toBe('2026-08-01T10:30:00.000Z')
  })
})

describe('formatDateTime', () => {
  it('does not throw on a full ISO string (regression: was double-appending Z)', () => {
    expect(() => formatDateTime('2026-08-01T12:30:00.000Z')).not.toThrow()
  })
})

describe('formatTime', () => {
  // Regression: formatTime used to render in the host machine's local timezone (via plain
  // date-fns `format`, which always uses local Date getters) while still labelling the
  // output "UTC". This must render the actual UTC wall-clock value regardless of the
  // system timezone the tests run under.
  it('renders the UTC wall-clock time, not the local system timezone', () => {
    expect(formatTime('2026-07-30 09:58:37')).toBe('09:58 UTC')
  })

  it('renders the same UTC wall-clock time for an equivalent zoned ISO string', () => {
    expect(formatTime('2026-07-30T09:58:37.000Z')).toBe('09:58 UTC')
  })
})
