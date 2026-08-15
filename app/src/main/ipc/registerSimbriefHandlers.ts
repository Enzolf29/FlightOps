import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { SimbriefOfp } from '@shared/types/simbrief'
import { fetchLatestOfp, SimbriefFetchError } from '../simbrief/simbriefClient'
import { getPilot } from '../db/repositories/pilotRepository'

export function registerSimbriefHandlers(): void {
  ipcMain.handle(IPC.simbrief.fetchLatestOfp, async (): Promise<SimbriefOfp> => {
    const pilot = getPilot()
    if (!pilot.simbrief_user_id) {
      throw new Error('Aucun ID SimBrief renseigné dans les Paramètres.')
    }

    try {
      return await fetchLatestOfp(pilot.simbrief_user_id)
    } catch (error) {
      if (error instanceof SimbriefFetchError) {
        throw error
      }
      throw new Error('Erreur inattendue lors de la récupération du plan SimBrief.')
    }
  })
}
