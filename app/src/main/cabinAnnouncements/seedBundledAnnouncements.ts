import { app } from 'electron'
import { copyFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { getDb } from '../db'
import {
  addCabinAnnouncementFile,
  hasCabinAnnouncementFiles,
  isBundledAnnouncementSeeded,
  markBundledAnnouncementSeeded
} from '../db/repositories/cabinAnnouncementRepository'
import {
  isCabinAnnouncementType,
  isCabinAnnouncementVariant,
  type CabinAnnouncementVariant
} from '@shared/types/cabinAnnouncements'
import { cabinAnnouncementDirectory } from './cabinAnnouncementFiles'

function bundledDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'cabin-announcements')
    : join(app.getAppPath(), 'resources', 'cabin-announcements')
}

function subdirectories(path: string): string[] {
  return readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory())
}

/**
 * Copie chez le joueur les annonces de base livrées avec l'application
 * (resources/cabin-announcements/<ICAO>/<type>/<variante>-<n>.<ext>, voir
 * scripts/prepare-cabin-announcements.ts). Une fois copiées ce sont des fichiers ordinaires : le
 * joueur peut les supprimer, en ajouter d'autres ou les écouter comme n'importe quelle annonce.
 *
 * Chaque fichier n'est copié qu'une seule fois (cabin_announcement_seeded) : une annonce supprimée
 * ne revient donc pas au démarrage suivant, alors qu'un fichier ajouté dans une mise à jour ultérieure
 * est bien livré. Si le joueur a déjà ses propres fichiers pour un type d'annonce, ceux de base
 * sont ignorés (et marqués comme traités) plutôt que mélangés aux siens.
 */
export function seedBundledCabinAnnouncements(): void {
  const root = bundledDirectory()
  if (!existsSync(root)) return

  const companyIdByIcao = new Map(
    (getDb().prepare('SELECT id, icao_code FROM companies').all() as Array<{ id: number; icao_code: string }>).map(
      (row) => [row.icao_code.toUpperCase(), row.id]
    )
  )

  for (const icao of subdirectories(root)) {
    const companyId = companyIdByIcao.get(icao.toUpperCase())
    if (companyId === undefined) continue

    for (const type of subdirectories(join(root, icao))) {
      if (!isCabinAnnouncementType(type)) continue
      const typeDirectory = join(root, icao, type)
      const filenames = readdirSync(typeDirectory).filter((name) => isCabinAnnouncementVariant(name.split('-')[0]))
      const keyOf = (filename: string): string => `${icao}/${type}/${filename}`
      // Des fichiers déjà présents sans qu'aucun fichier de base de ce type n'ait jamais été copié
      // sont ceux du joueur : on ne les mélange pas aux annonces de base.
      const skipBecausePlayerOwnsThisType =
        hasCabinAnnouncementFiles(companyId, type) && !filenames.some((name) => isBundledAnnouncementSeeded(keyOf(name)))

      for (const filename of filenames) {
        const bundledKey = keyOf(filename)
        if (isBundledAnnouncementSeeded(bundledKey)) continue

        if (!skipBecausePlayerOwnsThisType) {
          const variant = filename.split('-')[0] as CabinAnnouncementVariant
          const targetPath = join(cabinAnnouncementDirectory(companyId), `${type}-bundled-${filename}`)
          copyFileSync(join(typeDirectory, filename), targetPath)
          addCabinAnnouncementFile(companyId, type, variant, targetPath, filename)
        }
        markBundledAnnouncementSeeded(bundledKey)
      }
    }
  }
}
