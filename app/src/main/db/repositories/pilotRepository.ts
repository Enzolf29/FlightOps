import { getDb } from '../index'

interface PilotRow {
  display_name: string
  simbrief_user_id: string | null
  aerodatabox_api_key: string | null
}

export function getPilot(): PilotRow {
  return getDb()
    .prepare('SELECT display_name, simbrief_user_id, aerodatabox_api_key FROM pilot WHERE id = 1')
    .get() as PilotRow
}

export function updateSimbriefUserId(simbriefUserId: string | null): void {
  getDb().prepare('UPDATE pilot SET simbrief_user_id = ? WHERE id = 1').run(simbriefUserId)
}

export function updateAerodataboxApiKey(apiKey: string | null): void {
  getDb().prepare('UPDATE pilot SET aerodatabox_api_key = ? WHERE id = 1').run(apiKey)
}
