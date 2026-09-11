import { getDb } from '../index'
import type { FlightWithRelations } from '@shared/types/flight'
import type { GsxReceipt } from '@shared/types/gsxReceipt'
import { listAllGsxReceipts, matchGsxReceiptsForFlight } from '../../gsx/gsxReceiptsRepository'

type MatchableFlight = Pick<FlightWithRelations, 'departureIcao' | 'arrivalIcao' | 'scheduledDeparture' | 'aircraft'>

function getExcludedReceiptIds(): Set<string> {
  const rows = getDb().prepare('SELECT receipt_id FROM gsx_receipt_exclusions').all() as Array<{ receipt_id: string }>
  return new Set(rows.map((row) => row.receipt_id))
}

function getReceiptIdsClaimedByOtherFlights(flightId: number): Set<string> {
  const rows = getDb()
    .prepare('SELECT receipt_id FROM gsx_receipt_links WHERE flight_id != ?')
    .all(flightId) as Array<{ receipt_id: string }>
  return new Set(rows.map((row) => row.receipt_id))
}

function linkReceiptsToFlight(flightId: number, receiptIds: string[]): void {
  if (receiptIds.length === 0) return
  const insert = getDb().prepare('INSERT OR IGNORE INTO gsx_receipt_links (receipt_id, flight_id) VALUES (?, ?)')
  const run = getDb().transaction((ids: string[]) => {
    for (const id of ids) insert.run(id, flightId)
  })
  run(receiptIds)
}

/**
 * Rapproche les factures GSX d'un vol puis mémorise durablement l'attribution (table
 * gsx_receipt_links) : une fois une facture attribuée à un vol, elle n'est plus jamais proposée à
 * un autre — sans ça, deux vols enchaînés sur le même avion au même parking se disputaient les
 * mêmes factures à chaque nouveau calcul (la plus récemment arrivée gagnait à chaque fois).
 */
export function claimGsxReceiptsForFlight(
  flightId: number,
  flight: MatchableFlight,
  referenceEndIso: string
): GsxReceipt[] {
  const excluded = getExcludedReceiptIds()
  const claimedByOthers = getReceiptIdsClaimedByOtherFlights(flightId)
  const candidates = listAllGsxReceipts().filter(
    (receipt) => !excluded.has(receipt.receiptId) && !claimedByOthers.has(receipt.receiptId)
  )
  const matched = matchGsxReceiptsForFlight(candidates, flight, referenceEndIso)
  linkReceiptsToFlight(
    flightId,
    matched.map((receipt) => receipt.receiptId)
  )
  return matched
}

/** Supprime définitivement une facture de l'affichage (tous vols confondus) — ex. rattachement
 * erroné qu'aucun vol ne devrait revendiquer. Le fichier GSX lui-même n'est pas touché. */
export function excludeGsxReceipt(receiptId: string): void {
  getDb().prepare('INSERT OR IGNORE INTO gsx_receipt_exclusions (receipt_id) VALUES (?)').run(receiptId)
  getDb().prepare('DELETE FROM gsx_receipt_links WHERE receipt_id = ?').run(receiptId)
}
