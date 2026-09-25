import { getDb } from '../index'
import type { CabinAnnouncementType, CabinAnnouncementVariant } from '@shared/types/cabinAnnouncements'

export interface StoredCabinAnnouncementFile {
  id: number
  companyId: number
  type: CabinAnnouncementType
  variant: CabinAnnouncementVariant
  filePath: string
  originalFilename: string
  updatedAt: string
  volume: number
}

interface CabinAnnouncementRow {
  id: number
  company_id: number
  announcement_type: CabinAnnouncementType
  variant: CabinAnnouncementVariant
  file_path: string
  original_filename: string
  updated_at: string
  volume: number
}

const SELECT_COLUMNS = 'id, company_id, announcement_type, variant, file_path, original_filename, updated_at, volume'

function mapRow(row: CabinAnnouncementRow): StoredCabinAnnouncementFile {
  return {
    id: row.id,
    companyId: row.company_id,
    type: row.announcement_type,
    variant: row.variant,
    filePath: row.file_path,
    originalFilename: row.original_filename,
    updatedAt: row.updated_at,
    volume: row.volume
  }
}

export function listCabinAnnouncementFiles(companyId: number): StoredCabinAnnouncementFile[] {
  const rows = getDb()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM cabin_announcement_files WHERE company_id = ? ORDER BY announcement_type, variant, id`)
    .all(companyId) as CabinAnnouncementRow[]
  return rows.map(mapRow)
}

export function getCabinAnnouncementFileById(id: number): StoredCabinAnnouncementFile | null {
  const row = getDb().prepare(`SELECT ${SELECT_COLUMNS} FROM cabin_announcement_files WHERE id = ?`).get(id) as
    | CabinAnnouncementRow
    | undefined
  return row ? mapRow(row) : null
}

export function addCabinAnnouncementFile(
  companyId: number,
  type: CabinAnnouncementType,
  variant: CabinAnnouncementVariant,
  filePath: string,
  originalFilename: string
): StoredCabinAnnouncementFile {
  const result = getDb()
    .prepare(
      `INSERT INTO cabin_announcement_files (company_id, announcement_type, variant, file_path, original_filename, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(companyId, type, variant, filePath, originalFilename)
  return getCabinAnnouncementFileById(Number(result.lastInsertRowid))!
}

export function deleteCabinAnnouncementFileById(id: number): void {
  getDb().prepare('DELETE FROM cabin_announcement_files WHERE id = ?').run(id)
}

export function updateCabinAnnouncementVolume(id: number, volume: number): StoredCabinAnnouncementFile {
  const result = getDb().prepare('UPDATE cabin_announcement_files SET volume = ? WHERE id = ?').run(volume, id)
  if (result.changes === 0) throw new Error('Annonce introuvable.')
  return getCabinAnnouncementFileById(id)!
}

export function hasCabinAnnouncementFiles(companyId: number, type: CabinAnnouncementType): boolean {
  const row = getDb()
    .prepare('SELECT 1 AS found FROM cabin_announcement_files WHERE company_id = ? AND announcement_type = ? LIMIT 1')
    .get(companyId, type)
  return row !== undefined
}

export function isBundledAnnouncementSeeded(bundledKey: string): boolean {
  return getDb().prepare('SELECT 1 AS found FROM cabin_announcement_seeded WHERE bundled_key = ?').get(bundledKey) !== undefined
}

export function markBundledAnnouncementSeeded(bundledKey: string): void {
  getDb().prepare('INSERT OR IGNORE INTO cabin_announcement_seeded (bundled_key) VALUES (?)').run(bundledKey)
}
