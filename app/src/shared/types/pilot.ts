import type { RankStatus } from './rank'

export interface PilotProfile {
  displayName: string
  simbriefUserId: string | null
  cumulativeHours: number
  totalFlights: number
  rank: RankStatus
}
