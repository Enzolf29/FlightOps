import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { AppUpdateStatus, ReleaseChangelog } from '@shared/types/appUpdate'
import { IPC } from '@shared/ipc/contract'

const INITIAL_CHECK_DELAY_MS = 15_000
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const GITHUB_REPO = 'Enzolf29/FlightOps'

const { autoUpdater } = electronUpdater
let periodicTimer: ReturnType<typeof setInterval> | null = null
let initialTimer: ReturnType<typeof setTimeout> | null = null
let started = false
let status: AppUpdateStatus = {
  phase: app.isPackaged ? 'idle' : 'disabled',
  currentVersion: app.getVersion(),
  availableVersion: null,
  downloadPercent: null,
  message: app.isPackaged
    ? 'Recherche automatique des nouvelles versions activée.'
    : 'Les mises à jour sont vérifiées uniquement dans la version installée.'
}

function publish(patch: Partial<AppUpdateStatus>): void {
  status = { ...status, ...patch }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC.updates.statusChanged, status)
  }
}

function readableError(error: Error): string {
  if (/404|latest\.yml|Cannot find latest/i.test(error.message)) {
    return 'Aucune version publiée n’est encore disponible sur GitHub.'
  }
  if (/net::|ENOTFOUND|ETIMEDOUT|internet|network/i.test(error.message)) {
    return 'Impossible de joindre GitHub. Vérifiez la connexion Internet.'
  }
  return 'La vérification des mises à jour a échoué.'
}

export function getAppUpdateStatus(): AppUpdateStatus {
  return status
}

export async function checkForAppUpdates(): Promise<AppUpdateStatus> {
  if (!app.isPackaged) return status
  publish({ phase: 'checking', downloadPercent: null, message: 'Recherche d’une nouvelle version…' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    publish({ phase: 'error', message: readableError(error as Error) })
  }
  return status
}

/** Notes de version publiées sur GitHub pour la version actuellement installée — sert au bouton
 * "Changelog" des paramètres. Retourne des champs null si le dépôt n'a pas de release pour cette
 * version (ex. build de développement) ou en cas d'échec réseau, plutôt que de lever une erreur. */
export async function getLatestReleaseChangelog(): Promise<ReleaseChangelog> {
  const version = app.getVersion()
  const empty: ReleaseChangelog = { version, publishedAt: null, body: null, htmlUrl: null }
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!response.ok) return empty
    const data = (await response.json()) as { body?: string; published_at?: string; html_url?: string }
    return {
      version,
      publishedAt: data.published_at ?? null,
      body: data.body ?? null,
      htmlUrl: data.html_url ?? null
    }
  } catch {
    return empty
  }
}

export function installDownloadedUpdate(): void {
  if (status.phase !== 'downloaded') throw new Error('Aucune mise à jour téléchargée.')
  autoUpdater.quitAndInstall(false, true)
}

export function startAppUpdater(): void {
  if (started || !app.isPackaged) return
  started = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false

  autoUpdater.on('checking-for-update', () => {
    publish({ phase: 'checking', downloadPercent: null, message: 'Recherche d’une nouvelle version…' })
  })
  autoUpdater.on('update-available', (info) => {
    publish({
      phase: 'available',
      availableVersion: info.version,
      downloadPercent: 0,
      message: `Version ${info.version} disponible. Téléchargement en cours…`
    })
  })
  autoUpdater.on('download-progress', (progress) => {
    publish({
      phase: 'downloading',
      downloadPercent: Math.max(0, Math.min(100, progress.percent)),
      message: `Téléchargement de la version ${status.availableVersion ?? ''}…`
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    publish({
      phase: 'downloaded',
      availableVersion: info.version,
      downloadPercent: 100,
      message: `Version ${info.version} prête à être installée.`
    })
  })
  autoUpdater.on('update-not-available', () => {
    publish({
      phase: 'up_to_date',
      availableVersion: null,
      downloadPercent: null,
      message: 'FlightOps est à jour.'
    })
  })
  autoUpdater.on('error', (error) => {
    publish({ phase: 'error', downloadPercent: null, message: readableError(error) })
  })

  initialTimer = setTimeout(() => void checkForAppUpdates(), INITIAL_CHECK_DELAY_MS)
  periodicTimer = setInterval(() => void checkForAppUpdates(), PERIODIC_CHECK_INTERVAL_MS)
}

export function stopAppUpdater(): void {
  if (initialTimer) clearTimeout(initialTimer)
  if (periodicTimer) clearInterval(periodicTimer)
  initialTimer = null
  periodicTimer = null
}
