import { getDb } from '../index'
import type { CallsignPattern, Company, CompanyPatch } from '@shared/types/company'

const SELECT_COMPANY =
  'SELECT id, icao_code, iata_code, radio_callsign, display_name, logo_filename, callsign_pattern, active FROM companies'

interface CompanyRow {
  id: number
  icao_code: string
  iata_code: string
  radio_callsign: string
  display_name: string
  logo_filename: string
  callsign_pattern: CallsignPattern
  active: number
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    icaoCode: row.icao_code,
    iataCode: row.iata_code,
    radioCallsign: row.radio_callsign,
    displayName: row.display_name,
    logoFilename: row.logo_filename,
    callsignPattern: row.callsign_pattern,
    active: row.active === 1
  }
}

export function getAllCompanies(): Company[] {
  const rows = getDb()
    .prepare(`${SELECT_COMPANY} ORDER BY display_name ASC`)
    .all() as CompanyRow[]
  return rows.map(mapCompany)
}

export function getCompanyById(id: number): Company | null {
  const row = getDb().prepare(`${SELECT_COMPANY} WHERE id = ?`).get(id) as CompanyRow | undefined
  return row ? mapCompany(row) : null
}

export function updateCompany(id: number, patch: CompanyPatch): Company {
  const current = getDb().prepare(`${SELECT_COMPANY} WHERE id = ?`).get(id) as CompanyRow | undefined
  if (!current) {
    throw new Error(`Company ${id} not found`)
  }

  const next = {
    display_name: patch.displayName ?? current.display_name,
    radio_callsign: patch.radioCallsign ?? current.radio_callsign,
    callsign_pattern: patch.callsignPattern ?? current.callsign_pattern,
    active: patch.active !== undefined ? (patch.active ? 1 : 0) : current.active
  }

  getDb()
    .prepare('UPDATE companies SET display_name = ?, radio_callsign = ?, callsign_pattern = ?, active = ? WHERE id = ?')
    .run(next.display_name, next.radio_callsign, next.callsign_pattern, next.active, id)

  return mapCompany({ ...current, ...next })
}
