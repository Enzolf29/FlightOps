import { getDb } from '../index'
import type { Rank } from '@shared/types/rank'

interface RankRow {
  id: number
  name: string
  min_hours: number
  sort_order: number
}

function mapRank(row: RankRow): Rank {
  return { id: row.id, name: row.name, minHours: row.min_hours, sortOrder: row.sort_order }
}

export function getAllRanks(): Rank[] {
  const rows = getDb().prepare('SELECT id, name, min_hours, sort_order FROM ranks ORDER BY sort_order ASC').all() as RankRow[]
  return rows.map(mapRank)
}
