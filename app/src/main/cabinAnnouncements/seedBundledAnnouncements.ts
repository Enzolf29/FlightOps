import { app } from 'electron'
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { getDb } from '../db'
import {
  addCabinAnnouncementFile,
  clearCabinAnnouncementsForCompany,
  hasCabinAnnouncementFiles,
  isBundledAnnouncementSeeded,
  markBundledAnnouncementSeeded,
  restoreBundledAnnouncementName
} from '../db/repositories/cabinAnnouncementRepository'
import {
  isCabinAnnouncementType,
  isCabinAnnouncementVariant,
  type CabinAnnouncementVariant
} from '@shared/types/cabinAnnouncements'
import { getCompanyById } from '../db/repositories/companyRepository'
import { cabinAnnouncementDirectory } from './cabinAnnouncementFiles'

function bundledDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'cabin-announcements')
    : join(app.getAppPath(), 'resources', 'cabin-announcements')
}

/** Nom d'origine de chaque fichier livré (voir manifest.json produit par prepare-cabin-announcements). */
function readManifest(root: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
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
export function seedBundledCabinAnnouncements(onlyCompanyId?: number): void {
  const root = bundledDirectory()
  if (!existsSync(root)) return

  const manifest = readManifest(root)
  const companyIdByIcao = new Map(
    (getDb().prepare('SELECT id, icao_code FROM companies').all() as Array<{ id: number; icao_code: string }>).map(
      (row) => [row.icao_code.toUpperCase(), row.id]
    )
  )

  for (const icao of subdirectories(root)) {
    const companyId = companyIdByIcao.get(icao.toUpperCase())
    if (companyId === undefined || (onlyCompanyId !== undefined && companyId !== onlyCompanyId)) continue

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
        if (type === 'cabin_dim_takeoff' && filename.startsWith('night-') && manifest[bundledKey]) {
          // Ces fichiers étaient livrés "toujours" (any-N) avant d'être réservés à la nuit : même fichier, autre clé.
          const legacyName = filename.replace('night-', 'any-')
          restoreBundledAnnouncementName(companyId, type, `${type}-bundled-${legacyName}`, legacyName, manifest[bundledKey])
        }

        if (isBundledAnnouncementSeeded(bundledKey)) {
          // Copié par une version précédente sous son nom normalisé (ex. "any-1.mp3") : on lui rend son nom d'origine.
          if (manifest[bundledKey]) {
            restoreBundledAnnouncementName(companyId, type, `${type}-bundled-${filename}`, filename, manifest[bundledKey])
          }
          continue
        }

        if (!skipBecausePlayerOwnsThisType) {
          const variant = filename.split('-')[0] as CabinAnnouncementVariant
          const targetPath = join(cabinAnnouncementDirectory(companyId), `${type}-bundled-${filename}`)
          copyFileSync(join(typeDirectory, filename), targetPath)
          addCabinAnnouncementFile(companyId, type, variant, targetPath, manifest[bundledKey] ?? filename)
        }
        markBundledAnnouncementSeeded(bundledKey)
      }
    }
  }
}

/**
 * Remet les annonces d'une compagnie dans leur état d'origine : supprime tout ce que le joueur a
 * ajouté, supprimé ou réglé (volumes compris), puis recopie les annonces de base livrées avec
 * l'application. Une compagnie sans annonces de base se retrouve simplement sans aucune annonce.
 */
export function resetCabinAnnouncementsToDefaults(companyId: number): void {
  const company = getCompanyById(companyId)
  if (!company) throw new Error('Compagnie inconnue.')

  clearCabinAnnouncementsForCompany(companyId, company.icaoCode)
  try {
    rmSync(cabinAnnouncementDirectory(companyId), { recursive: true, force: true })
  } catch {
    // Les lignes de base sont déjà supprimées : un fichier gardé ouvert par Windows reste orphelin.
  }
  seedBundledCabinAnnouncements(companyId)
}
