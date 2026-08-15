import { describe, expect, it } from 'vitest'
import { computePirepOutcome } from './computePirepOutcome'

describe('computePirepOutcome', () => {
  it('marks an on-time departure (<=10min) as on_time', () => {
    const outcome = computePirepOutcome('2026-08-01 12:00:00', '2026-08-01T12:05:00.000Z', '2026-08-01T13:35:00.000Z')
    expect(outcome.status).toBe('completed')
    expect(outcome.delayMinutes).toBe(5)
    expect(outcome.delayBucket).toBe('on_time')
    expect(outcome.flightTimeMinutes).toBe(90)
  })

  it('marks a 10-60 min delay as delayed_10_60', () => {
    const outcome = computePirepOutcome('2026-08-01 12:00:00', '2026-08-01T12:30:00.000Z', '2026-08-01T14:00:00.000Z')
    expect(outcome.delayBucket).toBe('delayed_10_60')
  })

  it('marks a >60 min delay as delayed_60_plus', () => {
    const outcome = computePirepOutcome('2026-08-01 12:00:00', '2026-08-01T13:30:00.000Z', '2026-08-01T15:00:00.000Z')
    expect(outcome.delayBucket).toBe('delayed_60_plus')
  })

  it('cancels the flight instead of completing it beyond the 3h threshold', () => {
    const outcome = computePirepOutcome('2026-08-01 12:00:00', '2026-08-01T15:30:00.000Z', '2026-08-01T17:00:00.000Z')
    expect(outcome.status).toBe('cancelled')
    expect(outcome.delayBucket).toBeNull()
  })

  it('handles an early departure (negative delay) as on_time', () => {
    const outcome = computePirepOutcome('2026-08-01 12:00:00', '2026-08-01T11:55:00.000Z', '2026-08-01T13:25:00.000Z')
    expect(outcome.delayMinutes).toBe(-5)
    expect(outcome.delayBucket).toBe('on_time')
  })
})
