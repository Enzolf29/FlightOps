import { describe, expect, it } from 'vitest'
import { computeLivePunctuality } from './computeLivePunctuality'

describe('computeLivePunctuality', () => {
  it('is on time before the scheduled departure (no actual departure known yet)', () => {
    expect(computeLivePunctuality('2026-08-01T12:00:00.000Z', null, '2026-08-01T11:50:00.000Z')).toBe('on_time')
  })

  it('is on time within the 10 minute grace period while still waiting to depart', () => {
    expect(computeLivePunctuality('2026-08-01T12:00:00.000Z', null, '2026-08-01T12:08:00.000Z')).toBe('on_time')
  })

  it('grows as delayed while still waiting to depart, based on the current time', () => {
    expect(computeLivePunctuality('2026-08-01T12:00:00.000Z', null, '2026-08-01T12:30:00.000Z')).toBe('delayed_10_60')
    expect(computeLivePunctuality('2026-08-01T12:00:00.000Z', null, '2026-08-01T14:00:00.000Z')).toBe('delayed_60_plus')
  })

  it('freezes on the actual departure delay once known, regardless of how long the flight has been going', () => {
    // Departed only 5 minutes late, but it's now 2 hours after scheduled departure (well into the
    // flight) — must stay on_time, not grow into delayed_60_plus just because time has passed.
    expect(
      computeLivePunctuality('2026-08-01T12:00:00.000Z', '2026-08-01T12:05:00.000Z', '2026-08-01T14:00:00.000Z')
    ).toBe('on_time')
  })

  it('still reports a genuine departure delay correctly once frozen', () => {
    expect(
      computeLivePunctuality('2026-08-01T12:00:00.000Z', '2026-08-01T13:15:00.000Z', '2026-08-01T15:00:00.000Z')
    ).toBe('delayed_60_plus')
  })
})
