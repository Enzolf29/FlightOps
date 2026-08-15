import { describe, expect, it } from 'vitest'
import { computeRank } from './computeRank'
import type { Rank } from '../types/rank'

const RANKS: Rank[] = [
  { id: 1, name: 'Cadet', minHours: 0, sortOrder: 1 },
  { id: 2, name: 'First Officer', minHours: 50, sortOrder: 2 },
  { id: 3, name: 'Captain', minHours: 300, sortOrder: 3 }
]

describe('computeRank', () => {
  it('returns the first rank and full progress info at 0 hours', () => {
    const status = computeRank(RANKS, 0)
    expect(status.current.name).toBe('Cadet')
    expect(status.next?.name).toBe('First Officer')
    expect(status.hoursRemaining).toBe(50)
    expect(status.progressToNextPct).toBe(0)
  })

  it('picks the correct current/next rank mid-range', () => {
    const status = computeRank(RANKS, 175)
    expect(status.current.name).toBe('First Officer')
    expect(status.next?.name).toBe('Captain')
    expect(status.hoursRemaining).toBe(125)
    expect(status.progressToNextPct).toBeCloseTo(50, 5)
  })

  it('caps progress at the highest rank with no next rank', () => {
    const status = computeRank(RANKS, 5000)
    expect(status.current.name).toBe('Captain')
    expect(status.next).toBeNull()
    expect(status.hoursRemaining).toBe(0)
    expect(status.progressToNextPct).toBe(100)
  })

  it('handles an exact threshold match', () => {
    const status = computeRank(RANKS, 50)
    expect(status.current.name).toBe('First Officer')
  })
})
