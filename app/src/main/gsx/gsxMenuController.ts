import { setGsxLVar } from '../simconnect/connectionManager'
import { readGsxMenuFile, type GsxMenuSnapshot } from './gsxMenuFile'

const MENU_OPEN_LVAR = 'L:FSDT_GSX_MENU_OPEN'
const MENU_CHOICE_LVAR = 'L:FSDT_GSX_MENU_CHOICE'
const POLL_INTERVAL_MS = 250
/** GSX peut prendre plusieurs secondes à afficher un sous-menu (ex. sélection d'un opérateur) —
 * au-delà, on considère que le menu ne changera plus (fermé, ou action déjà exécutée). */
const POLL_TIMEOUT_MS = 4_000

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sameSnapshot(a: GsxMenuSnapshot | null, b: GsxMenuSnapshot | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.title === b.title && a.options.length === b.options.length && a.options.every((option, index) => option === b.options[index])
}

async function waitForMenuChange(previous: GsxMenuSnapshot | null): Promise<GsxMenuSnapshot | null> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await wait(POLL_INTERVAL_MS)
    const current = await readGsxMenuFile()
    if (!sameSnapshot(current, previous)) return current
  }
  return null
}

/** Ouvre (ou rafraîchit) le menu GSX courant et attend que son contenu apparaisse/change. Null si
 * SimConnect n'est pas connecté ou si GSX ne répond pas dans le délai imparti. */
export async function openGsxMenu(): Promise<GsxMenuSnapshot | null> {
  const previous = await readGsxMenuFile()
  if (!setGsxLVar(MENU_OPEN_LVAR, 1)) return null
  return waitForMenuChange(previous)
}

/** Sélectionne une option du menu GSX actuellement affiché (index 0 = première ligne sous le
 * titre) et attend la mise à jour du menu (sous-menu suivant, ou fermeture si c'était l'action
 * finale — auquel cas le délai expire et null est renvoyé). */
export async function selectGsxMenuItem(index: number): Promise<GsxMenuSnapshot | null> {
  const previous = await readGsxMenuFile()
  if (!setGsxLVar(MENU_CHOICE_LVAR, index)) return null
  return waitForMenuChange(previous)
}
