import { app, dialog } from 'electron'
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { basename, extname, join } from 'path'
import type {
  CabinAnnouncementFile,
  CabinAnnouncementType,
  CabinAnnouncementVariant
} from '@shared/types/cabinAnnouncements'
import { isCabinAnnouncementType, isCabinAnnouncementVariant } from '@shared/types/cabinAnnouncements'
import { getCompanyById } from '../db/repositories/companyRepository'
import {
  addCabinAnnouncementFile,
  deleteCabinAnnouncementFileById,
  getCabinAnnouncementFileById,
  listCabinAnnouncementFiles,
  updateCabinAnnouncementVolume,
  type StoredCabinAnnouncementFile
} from '../db/repositories/cabinAnnouncementRepository'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac'])

function toPublicFile(file: StoredCabinAnnouncementFile): CabinAnnouncementFile {
  const version = encodeURIComponent(file.updatedAt)
  return {
    id: file.id,
    companyId: file.companyId,
    type: file.type,
    variant: file.variant,
    originalFilename: file.originalFilename,
    updatedAt: file.updatedAt,
    audioUrl: `flightops-audio://library/${file.id}?v=${version}`,
    volume: file.volume
  }
}

/** Dossier des annonces d'une compagnie chez le joueur (import manuel comme annonces de base). */
export function cabinAnnouncementDirectory(companyId: number): string {
  const directory = join(app.getPath('userData'), 'cabin-announcements', String(companyId))
  mkdirSync(directory, { recursive: true })
  return directory
}

export function listCabinAnnouncements(companyId: number): CabinAnnouncementFile[] {
  return listCabinAnnouncementFiles(companyId).map(toPublicFile)
}

export function resolveCabinAnnouncementPath(fileIdText: string): string | null {
  const fileId = Number(fileIdText)
  if (!Number.isInteger(fileId) || fileId <= 0) return null
  const file = getCabinAnnouncementFileById(fileId)
  return file && existsSync(file.filePath) ? file.filePath : null
}

/** Ajoute un fichier choisi par le joueur à une annonce : les fichiers existants sont conservés,
 * un des fichiers de l'annonce est ensuite tiré au hasard à chaque lecture. */
export async function importCabinAnnouncement(
  companyId: number,
  type: CabinAnnouncementType,
  variant: CabinAnnouncementVariant
): Promise<CabinAnnouncementFile | null> {
  if (!getCompanyById(companyId)) throw new Error('Compagnie inconnue.')
  if (!isCabinAnnouncementType(type)) throw new Error('Type d’annonce inconnu.')
  if (!isCabinAnnouncementVariant(variant)) throw new Error('Variante d’annonce inconnue.')

  const selection = await dialog.showOpenDialog({
    title: 'Ajouter une annonce cabine',
    properties: ['openFile'],
    filters: [
      { name: 'Fichiers audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  })
  if (selection.canceled || selection.filePaths.length === 0) return null

  const sourcePath = selection.filePaths[0]
  const extension = extname(sourcePath).toLowerCase()
  if (!AUDIO_EXTENSIONS.has(extension)) {
    throw new Error('Format non pris en charge. Utilisez MP3, WAV, OGG, M4A ou AAC.')
  }

  const targetPath = join(cabinAnnouncementDirectory(companyId), `${type}-${Date.now()}${extension}`)
  copyFileSync(sourcePath, targetPath)
  return toPublicFile(addCabinAnnouncementFile(companyId, type, variant, targetPath, basename(sourcePath)))
}

export function removeCabinAnnouncement(fileId: number): void {
  const existing = getCabinAnnouncementFileById(fileId)
  if (!existing) return
  deleteCabinAnnouncementFileById(fileId)
  if (existsSync(existing.filePath)) {
    try {
      unlinkSync(existing.filePath)
    } catch {
      // La configuration est bien supprimée même si Windows garde momentanément le fichier ouvert.
    }
  }
}

export function setCabinAnnouncementVolume(fileId: number, requestedVolume: number): CabinAnnouncementFile {
  if (!Number.isFinite(requestedVolume)) throw new Error('Volume invalide.')
  const volume = Math.min(1, Math.max(0, requestedVolume))
  return toPublicFile(updateCabinAnnouncementVolume(fileId, volume))
}
