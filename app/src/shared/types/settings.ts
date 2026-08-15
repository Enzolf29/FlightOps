export type Theme = 'light' | 'dark'

export interface AppSettings {
  theme: Theme
  simbriefUserId: string | null
  displayTimezone: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  simbriefUserId: null,
  displayTimezone: 'UTC'
}
