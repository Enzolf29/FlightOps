import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Fonds d'écran compagnie de l'accueil tablette : un PNG par code OACI, ajouté au coup par coup
 * dans resources/tablet-backgrounds. Absent d'une compagnie, l'accueil retombe sur le dégradé uni.
 */
function backgroundsDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tablet-backgrounds')
    : join(app.getAppPath(), 'resources', 'tablet-backgrounds')
}

export function getCompanyBackgroundPng(icaoCode: string): Buffer | null {
  const path = join(backgroundsDirectory(), `${icaoCode.toUpperCase()}.png`)
  if (!existsSync(path)) return null
  return readFileSync(path)
}
