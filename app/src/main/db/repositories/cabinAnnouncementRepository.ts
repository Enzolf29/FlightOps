import { getDb } from '../index'
import type { CabinAnnouncementType } from '@shared/types/cabinAnnouncements'

export interface StoredCabinAnnouncementFile {
  companyId: number
  type: CabinAnnouncementType
  filePath: string
  originalFilename: string
  updatedAt: string
  volume: number
}

interface CabinAnnouncementRow {
  company_id: number
  announcement_type: CabinAnnouncementType
  file_path: string
  original_filename: string
  updated_at: string
  volume: number
}

function mapRow(row: CabinAnnouncementRow): StoredCabinAnnouncementFile {
  return {
    companyId: row.company_id,
    type: row.announcement_type,
    filePath: row.file_path,
    originalFilename: row.original_filename,
    updatedAt: row.updated_at,
    volume: row.volume
  }
}

export function listCabinAnnouncementFiles(companyId: number): StoredCabinAnnouncementFile[] {
  const rows = getDb()
    .prepare(
      `SELECT company_id, announcement_type, file_path, original_filename, updated_at, volume
       FROM cabin_announcement_files WHERE company_id = ? ORDER BY announcement_type`
    )
    .all(companyId) as CabinAnnouncementRow[]
  return rows.map(mapRow)
}

export function getCabinAnnouncementFile(
  companyId: number,
  type: CabinAnnouncementType
): StoredCabinAnnouncementFile | null {
  const row = getDb()
    .prepare(
      `SELECT company_id, announcement_type, file_path, original_filename, updated_at, volume
       FROM cabin_announcement_files WHERE company_id = ? AND announcement_type = ?`
    )
    .get(companyId, type) as CabinAnnouncementRow | undefined
  return row ? mapRow(row) : null
}

export function saveCabinAnnouncementFile(
  companyId: number,
  type: CabinAnnouncementType,
  filePath: string,
  originalFilename: string
): StoredCabinAnnouncementFile {
  getDb()
    .prepare(
      `INSERT INTO cabin_announcement_files
         (company_id, announcement_type, file_path, original_filename, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(company_id, announcement_type) DO UPDATE SET
         file_path = excluded.file_path,
         original_filename = excluded.original_filename,
         updated_at = datetime('now')`
    )
    .run(companyId, type, filePath, originalFilename)
  return getCabinAnnouncementFile(companyId, type)!
}

export function deleteCabinAnnouncementFile(companyId: number, type: CabinAnnouncementType): void {
  getDb()
    .prepare('DELETE FROM cabin_announcement_files WHERE company_id = ? AND announcement_type = ?')
    .run(companyId, type)
}

export function updateCabinAnnouncementVolume(
  companyId: number,
  type: CabinAnnouncementType,
  volume: number
): StoredCabinAnnouncementFile {
  const result = getDb()
    .prepare('UPDATE cabin_announcement_files SET volume = ? WHERE company_id = ? AND announcement_type = ?')
    .run(volume, companyId, type)
  if (result.changes === 0) throw new Error('Importez d’abord un fichier pour cette annonce.')
  return getCabinAnnouncementFile(companyId, type)!
}
