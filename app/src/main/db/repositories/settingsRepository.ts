import { getDb } from '../index'
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types/settings'

export function getSettings(): AppSettings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string | null
  }>

  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]))

  return {
    theme: (stored.theme as AppSettings['theme']) ?? DEFAULT_SETTINGS.theme,
    simbriefUserId: stored.simbriefUserId ?? DEFAULT_SETTINGS.simbriefUserId,
    displayTimezone: stored.displayTimezone ?? DEFAULT_SETTINGS.displayTimezone
  }
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value === null ? null : typeof value === 'object' ? JSON.stringify(value) : String(value))
}
