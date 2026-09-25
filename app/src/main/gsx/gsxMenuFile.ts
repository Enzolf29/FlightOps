import { readFileSync } from 'fs'
import { join } from 'path'
import * as regedit from 'regedit'

const REGISTRY_KEY = 'HKCU\\SOFTWARE\\FSDreamTeam'
const REGISTRY_VALUE = 'root'
/** Installateur GSX par défaut si la clé de registre est absente — même valeur que celle utilisée
 * par les intégrations tierces déjà publiées (ex. Fenix2GSX) pour ce même cas de repli. */
const DEFAULT_INSTALL_ROOT = 'C:\\Program Files (x86)\\Addon Manager'
const RELATIVE_MENU_PATH = ['MSFS', 'fsdreamteam-gsx-pro', 'html_ui', 'InGamePanels', 'FSDT_GSX_Panel', 'menu']

export interface GsxMenuSnapshot {
  title: string
  options: string[]
}

let cachedMenuFilePath: string | null = null

/**
 * Localise le fichier texte dans lequel GSX Pro écrit son menu courant (titre + options), pour un
 * pilotage externe sans dépendre d'un évènement SimConnect dédié — GSX documente ce chemin comme
 * relatif à son propre dossier d'installation, lui-même résolu via le registre (clé utilisée par
 * l'Addon Manager FSDreamTeam). Mémorisé après la première résolution réussie : ce chemin ne change
 * pas en cours de session.
 */
async function resolveGsxMenuFilePath(): Promise<string> {
  if (cachedMenuFilePath) return cachedMenuFilePath
  let installRoot = DEFAULT_INSTALL_ROOT
  try {
    const result = await regedit.promisified.list([REGISTRY_KEY])
    const value = result[REGISTRY_KEY]?.values?.[REGISTRY_VALUE]?.value
    if (typeof value === 'string' && value.trim()) installRoot = value
  } catch {
    // Registre inaccessible (GSX non installé, permissions...) : on retombe sur le chemin par défaut.
  }
  cachedMenuFilePath = join(installRoot, ...RELATIVE_MENU_PATH)
  return cachedMenuFilePath
}

/**
 * Lit l'état courant du menu GSX (première ligne = titre, suivantes = options sélectionnables dans
 * l'ordre — l'index affiché correspond à celui attendu par L:FSDT_GSX_MENU_CHOICE). Null si GSX n'a
 * aucun menu actuellement ouvert, ou si le fichier est introuvable.
 */
export async function readGsxMenuFile(): Promise<GsxMenuSnapshot | null> {
  const path = await resolveGsxMenuFilePath()
  let content: string
  try {
    content = readFileSync(path, 'utf-8')
  } catch {
    return null
  }
  const lines = content.split(/\r?\n/)
  // Une seule ligne finale vide vient du saut de ligne terminal du fichier, pas d'une vraie option
  // vide — les autres lignes (y compris vides ailleurs) sont conservées telles quelles pour que
  // l'index d'une option corresponde exactement à celui attendu par L:FSDT_GSX_MENU_CHOICE.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length === 0) return null
  const [title, ...options] = lines
  return { title, options }
}
