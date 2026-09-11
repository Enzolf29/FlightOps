export type AppUpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'up_to_date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateStatus {
  phase: AppUpdatePhase
  currentVersion: string
  availableVersion: string | null
  downloadPercent: number | null
  message: string
}

/** Notes de version publiées sur GitHub pour la version installée — voir getLatestReleaseChangelog. */
export interface ReleaseChangelog {
  version: string
  publishedAt: string | null
  body: string | null
  htmlUrl: string | null
}
