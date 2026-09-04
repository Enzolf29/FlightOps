import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'

// Dossier de données séparé de l'app packagée (app.getPath('userData') dépend du nom de l'app) :
// sans ça, la version dev (npm run dev) et le .exe installé lisent/écrivent le même fichier
// SQLite. Les deux tournant parfois en même temps pendant les tests, un accès concurrent
// combiné à un arrêt forcé du process dev a fini par corrompre la base partagée.
if (!app.isPackaged) {
  app.setName('flightops-dev')
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
import { createMainWindow } from './window'
import { getDb, closeDb } from './db/index'
import { registerSettingsHandlers } from './ipc/registerSettingsHandlers'
import { registerAppHandlers } from './ipc/registerAppHandlers'
import { registerHomeHandlers } from './ipc/registerHomeHandlers'
import { registerFleetHandlers } from './ipc/registerFleetHandlers'
import { registerPilotHandlers } from './ipc/registerPilotHandlers'
import { registerSimbriefHandlers } from './ipc/registerSimbriefHandlers'
import { registerAdsbdbHandlers } from './ipc/registerAdsbdbHandlers'
import { registerRealFlightsHandlers } from './ipc/registerRealFlightsHandlers'
import { registerBookingHandlers } from './ipc/registerBookingHandlers'
import { registerPirepHandlers } from './ipc/registerPirepHandlers'
import { registerFlightHandlers } from './ipc/registerFlightHandlers'
import { registerSimconnectHandlers } from './ipc/registerSimconnectHandlers'
import { registerStatsHandlers } from './ipc/registerStatsHandlers'
import { flushFlightRecorder } from './simconnect/flightStatusDetector'
import { startFlightStatusScheduler, stopFlightStatusScheduler } from './flightStatusScheduler'
import { registerCabinAnnouncementHandlers } from './ipc/registerCabinAnnouncementHandlers'
import {
  registerCabinAnnouncementProtocol,
  registerCabinAnnouncementScheme
} from './cabinAnnouncements/cabinAnnouncementProtocol'
import { registerSimbriefPdfProtocol, registerSimbriefPdfScheme } from './simbrief/simbriefPdfProtocol'
import { registerTabletHandlers } from './ipc/registerTabletHandlers'
import { getTabletServerInfo, startTabletServer, stopTabletServer } from './tablet/tabletServer'
import { registerUpdateHandlers } from './ipc/registerUpdateHandlers'
import { startAppUpdater, stopAppUpdater } from './updater/appUpdater'

registerCabinAnnouncementScheme()
registerSimbriefPdfScheme()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.flightops.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  getDb()
  registerCabinAnnouncementProtocol()
  registerSimbriefPdfProtocol()
  startFlightStatusScheduler()

  registerSettingsHandlers()
  registerAppHandlers()
  registerHomeHandlers()
  registerFleetHandlers()
  registerPilotHandlers()
  registerSimbriefHandlers()
  registerAdsbdbHandlers()
  registerRealFlightsHandlers()
  registerBookingHandlers()
  registerPirepHandlers()
  registerFlightHandlers()
  registerSimconnectHandlers()
  registerStatsHandlers()
  registerCabinAnnouncementHandlers()
  registerTabletHandlers()
  registerUpdateHandlers()
  startAppUpdater()

  void startTabletServer()
    .then(() => {
      // Pratique pendant les tests locaux ; la version installée affiche ces informations
      // uniquement dans Paramètres et ne révèle jamais son PIN dans un journal système.
      if (!app.isPackaged) console.info('[Tablette]', getTabletServerInfo())
    })
    .catch((error) => {
      console.error('Impossible de démarrer l’interface tablette :', error)
    })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  stopTabletServer()
  stopAppUpdater()
  stopFlightStatusScheduler()
  flushFlightRecorder()
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
