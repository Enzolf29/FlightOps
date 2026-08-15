export interface Rank {
  id: number
  name: string
  minHours: number
  sortOrder: number
}

export interface RankStatus {
  current: Rank
  next: Rank | null
  hoursRemaining: number
  progressToNextPct: number
}
