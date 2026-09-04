import { app, dialog } from 'electron'
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { basename, extname, join } from 'path'
import type { CabinAnnouncementFile, CabinAnnouncementType } from '@shared/types/cabinAnnouncements'
import { isCabinAnnouncementType } from '@shared/types/cabinAnnouncements'
import { getCompanyById } from '../db/repositories/companyRepository'
import {
  deleteCabinAnnouncementFile,
  getCabinAnnouncementFile,
  listCabinAnnouncementFiles,
  saveCabinAnnouncementFile,
  updateCabinAnnouncementVolume,
  type StoredCabinAnnouncementFile
} from '../db/repositories/cabinAnnouncementRepository'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac'])

function toPublicFile(file: StoredCabinAnnouncementFile): CabinAnnouncementFile {
  const version = encodeURIComponent(file.updatedAt)
  return {
    companyId: file.companyId,
    type: file.type,
    originalFilename: file.originalFilename,
    updatedAt: file.updatedAt,
    audioUrl: `flightops-audio://library/${file.companyId}/${file.type}?v=${version}`,
    volume: file.volume
  }
}

export function listCabinAnnouncements(companyId: number): CabinAnnouncementFile[] {
  return listCabinAnnouncementFiles(companyId).map(toPublicFile)
}

export function resolveCabinAnnouncementPath(companyIdText: string, typeText: string): string | null {
  const companyId = Number(companyIdText)
  if (!Number.isInteger(companyId) || companyId <= 0 || !isCabinAnnouncementType(typeText)) return null
  const file = getCabinAnnouncementFile(companyId, typeText)
  return file && existsSync(file.filePath) ? file.filePath : null
}

export async function importCabinAnnouncement(
  companyId: number,
  type: CabinAnnouncementType
): Promise<CabinAnnouncementFile | null> {
  if (!getCompanyById(companyId)) throw new Error('Compagnie inconnue.')
  if (!isCabinAnnouncementType(type)) throw new Error('Type d’annonce inconnu.')

  const selection = await dialog.showOpenDialog({
    title: 'Importer une annonce cabine',
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

  const targetDirectory = join(app.getPath('userData'), 'cabin-announcements', String(companyId))
  mkdirSync(targetDirectory, { recursive: true })
  const targetPath = join(targetDirectory, `${type}-${Date.now()}${extension}`)
  const previous = getCabinAnnouncementFile(companyId, type)

  copyFileSync(sourcePath, targetPath)
  const saved = saveCabinAnnouncementFile(companyId, type, targetPath, basename(sourcePath))
  if (previous && previous.filePath !== targetPath && existsSync(previous.filePath)) {
    try {
      unlinkSync(previous.filePath)
    } catch {
      // Le nouveau fichier est déjà enregistré. Un ancien fichier verrouillé sera simplement
      // laissé sur le disque plutôt que de faire échouer l'import demandé par l'utilisateur.
    }
  }
  return toPublicFile(saved)
}

export function removeCabinAnnouncement(companyId: number, type: CabinAnnouncementType): void {
  if (!isCabinAnnouncementType(type)) throw new Error('Type d’annonce inconnu.')
  const existing = getCabinAnnouncementFile(companyId, type)
  deleteCabinAnnouncementFile(companyId, type)
  if (existing && existsSync(existing.filePath)) {
    try {
      unlinkSync(existing.filePath)
    } catch {
      // La configuration est bien supprimée même si Windows garde momentanément le fichier ouvert.
    }
  }
}

export function setCabinAnnouncementVolume(
  companyId: number,
  type: CabinAnnouncementType,
  requestedVolume: number
): CabinAnnouncementFile {
  if (!isCabinAnnouncementType(type)) throw new Error('Type d’annonce inconnu.')
  if (!Number.isFinite(requestedVolume)) throw new Error('Volume invalide.')
  const volume = Math.min(1, Math.max(0, requestedVolume))
  return toPublicFile(updateCabinAnnouncementVolume(companyId, type, volume))
}
