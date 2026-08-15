import type { Rank, RankStatus } from '../types/rank'

export function computeRank(ranks: Rank[], cumulativeHours: number): RankStatus {
  if (ranks.length === 0) {
    throw new Error('computeRank requires at least one rank')
  }

  const sorted = [...ranks].sort((a, b) => a.sortOrder - b.sortOrder)

  let current = sorted[0]
  let next: Rank | null = null

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].minHours <= cumulativeHours) {
      current = sorted[i]
      next = sorted[i + 1] ?? null
    } else {
      break
    }
  }

  if (!next) {
    return { current, next: null, hoursRemaining: 0, progressToNextPct: 100 }
  }

  const hoursRemaining = Math.max(0, next.minHours - cumulativeHours)
  const span = next.minHours - current.minHours
  const progressToNextPct = span <= 0 ? 100 : Math.min(100, Math.max(0, ((cumulativeHours - current.minHours) / span) * 100))

  return { current, next, hoursRemaining, progressToNextPct }
}
