import { ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc/contract'
import { getDb } from '../db/index'

export function registerAppHandlers(): void {
  ipcMain.handle(IPC.app.openExternal, (_event, url: string) => {
    return shell.openExternal(url)
  })

  ipcMain.handle(IPC.app.deleteAllData, () => {
    const db = getDb()

    // Compagnies et rangs sont des données de référence (seedées par migration), pas des données
    // utilisateur/démo — elles ne sont jamais réappliquées après le premier lancement, donc les
    // effacer casserait l'app de façon permanente. Ordre de suppression = ordre des clés étrangères
    // (enfants avant parents), sinon SQLite rejette la suppression et TOUTE la transaction annule.
    const wipe = db.transaction(() => {
      db.prepare('DELETE FROM pireps').run()
      db.prepare('DELETE FROM flights').run()
      db.prepare('DELETE FROM aircraft').run()
      db.prepare('DELETE FROM settings').run()
      db.prepare('DELETE FROM pilot').run()
      db.prepare("INSERT INTO pilot (id, display_name) VALUES (1, 'Pilote')").run()
    })
    wipe()

    return true
  })
}
