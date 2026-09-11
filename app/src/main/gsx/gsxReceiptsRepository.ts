import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import type { FlightWithRelations } from '@shared/types/flight'
import type { GsxCostCategoryTotal, GsxCostStats, GsxReceipt } from '@shared/types/gsxReceipt'
import { GSX_CATEGORY_LABEL } from '@shared/types/gsxReceipt'
import { parseUtc } from '@shared/lib/datetime'

const RECEIPT_FILENAME_PATTERN = /^(\d{8}T\d{6}Z)_([A-Z0-9]{3,4})_.+\.json$/

/** Deux factures GSX séparées de plus de cette durée sont considérées comme deux passages sol
 * distincts (ex. l'arrivée d'un vol précédent puis, des heures plus tard, la préparation du vol
 * suivant sur le même avion et le même aéroport) plutôt qu'un seul et même tour d'escale. */
const CLUSTER_GAP_MS = 90 * 60 * 1000

/** Distance maximale entre un passage sol et l'horaire du vol pour être rattaché : au-delà, on
 * considère qu'il n'y a aucune facture plausible plutôt que de rattacher au hasard. */
const MAX_ANCHOR_DISTANCE_MS = 24 * 60 * 60 * 1000

interface RawGsxReceiptJson {
  title?: string
  receiptId?: string
  dateText?: string
  icao?: string
  airportName?: string
  tail?: string
  operator?: string
  logoDataUri?: string
  airline?: string
  serviceSectionLabel?: string
  chargesSectionLabel?: string
  serviceInfoRows?: Array<[string?, string?]>
  items?: Array<{ description?: string; qty?: string; unitPrice?: string; amount?: string }>
  subtotal?: string
  taxes?: Array<{ label?: string; rate?: string; amount?: string; reason?: string }>
  total?: string
  fxDisclosure?: string
}

export function getGsxReceiptsRootDir(): string {
  return join(process.env.APPDATA ?? '', 'Virtuali', 'GSX', 'Receipts')
}

/** Lit le fichier HTML jumeau d'une facture (rendu "papier" natif de GSX, avec logo, généré à côté
 * du JSON) pour l'afficher tel quel côté renderer. Refuse tout chemin hors du dossier de factures
 * GSX plutôt que de servir un fichier arbitraire du disque. */
export function readGsxReceiptHtml(htmlPath: string, rootDir: string = getGsxReceiptsRootDir()): string | null {
  if (!htmlPath.startsWith(rootDir)) return null
  try {
    return readFileSync(htmlPath, 'utf-8')
  } catch {
    return null
  }
}

/** "20260911T144638Z" -> "2026-09-11T14:46:38Z". Retourne null si le format ne correspond pas. */
export function parseGsxTimestamp(raw: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
}

export function parseGsxReceiptJson(category: string, filename: string, rawJson: string): GsxReceipt | null {
  const nameMatch = RECEIPT_FILENAME_PATTERN.exec(filename)
  if (!nameMatch) return null
  const timestampIso = parseGsxTimestamp(nameMatch[1])
  if (!timestampIso) return null

  let raw: RawGsxReceiptJson
  try {
    raw = JSON.parse(rawJson) as RawGsxReceiptJson
  } catch {
    return null
  }

  return {
    category,
    receiptId: raw.receiptId ?? filename,
    title: raw.title ?? category,
    dateText: raw.dateText ?? '',
    timestampIso,
    icao: (raw.icao ?? nameMatch[2]).toUpperCase(),
    airportName: raw.airportName ?? '',
    tail: (raw.tail ?? '').toUpperCase(),
    htmlPath: '',
    operator: raw.operator ?? '',
    logoDataUri: raw.logoDataUri ?? '',
    receiverName: raw.airline ?? '',
    serviceSectionLabel: raw.serviceSectionLabel ?? '',
    chargesSectionLabel: raw.chargesSectionLabel ?? '',
    serviceInfoRows: (raw.serviceInfoRows ?? []).map(([label, value]) => ({ label: label ?? '', value: value ?? '' })),
    items: (raw.items ?? []).map((item) => ({
      description: item.description ?? '',
      qty: item.qty ?? '',
      unitPrice: item.unitPrice ?? '',
      amount: item.amount ?? ''
    })),
    subtotal: raw.subtotal ?? '',
    taxes: (raw.taxes ?? []).map((tax) => ({
      label: tax.label ?? '',
      rate: tax.rate ?? '',
      amount: tax.amount ?? '',
      reason: tax.reason ?? ''
    })),
    total: raw.total ?? '',
    fxDisclosure: raw.fxDisclosure ?? ''
  }
}

/** Lit toutes les factures GSX (carburant, catering, handling, bus passagers…) déposées sur le
 * disque par GSX Pro 4+. GSX n'a aucune notion des vols FlightOps : chaque facture ne porte que
 * l'immatriculation, l'aéroport et l'heure — voir getGsxReceiptsForFlight pour le rapprochement. */
export function listAllGsxReceipts(rootDir: string = getGsxReceiptsRootDir()): GsxReceipt[] {
  let categories: string[]
  try {
    categories = readdirSync(rootDir).filter((entry) => statSync(join(rootDir, entry)).isDirectory())
  } catch {
    return []
  }

  const receipts: GsxReceipt[] = []
  for (const category of categories) {
    const categoryDir = join(rootDir, category)
    let files: string[]
    try {
      files = readdirSync(categoryDir).filter((name) => name.endsWith('.json'))
    } catch {
      continue
    }
    for (const file of files) {
      try {
        const receipt = parseGsxReceiptJson(category, file, readFileSync(join(categoryDir, file), 'utf-8'))
        if (receipt) receipts.push({ ...receipt, htmlPath: join(categoryDir, file.replace(/\.json$/, '.html')) })
      } catch {
        // Facture corrompue ou en cours d'écriture par GSX : ignorée plutôt que de faire échouer la liste.
      }
    }
  }
  return receipts
}

/** Regroupe des factures triées chronologiquement en passages sol distincts : deux factures dans
 * le même groupe sont séparées de moins de CLUSTER_GAP_MS. */
export function clusterGsxReceiptsByTime(receipts: GsxReceipt[]): GsxReceipt[][] {
  const sorted = [...receipts].sort((a, b) => a.timestampIso.localeCompare(b.timestampIso))
  const clusters: GsxReceipt[][] = []
  for (const receipt of sorted) {
    const currentCluster = clusters[clusters.length - 1]
    const previous = currentCluster?.[currentCluster.length - 1]
    if (previous && parseUtc(receipt.timestampIso).getTime() - parseUtc(previous.timestampIso).getTime() <= CLUSTER_GAP_MS) {
      currentCluster.push(receipt)
    } else {
      clusters.push([receipt])
    }
  }
  return clusters
}

/** Choisit, parmi des passages sol distincts, celui dont l'heure est la plus proche de l'horaire
 * du vol — et seulement s'il reste sous MAX_ANCHOR_DISTANCE_MS de cet horaire. */
export function pickClusterNearestAnchor(clusters: GsxReceipt[][], anchorIso: string): GsxReceipt[] {
  const anchor = parseUtc(anchorIso).getTime()
  let best: { cluster: GsxReceipt[]; distanceMs: number } | null = null
  for (const cluster of clusters) {
    const distanceMs = Math.min(...cluster.map((receipt) => Math.abs(parseUtc(receipt.timestampIso).getTime() - anchor)))
    if (!best || distanceMs < best.distanceMs) best = { cluster, distanceMs }
  }
  if (!best || best.distanceMs > MAX_ANCHOR_DISTANCE_MS) return []
  return best.cluster
}

type MatchableFlight = Pick<FlightWithRelations, 'departureIcao' | 'arrivalIcao' | 'scheduledDeparture' | 'aircraft'>

/**
 * Rapproche des factures GSX déjà lues avec un vol FlightOps par immatriculation + aéroport, puis
 * ne garde que le passage sol (côté départ, côté arrivée) le plus proche des horaires du vol : un
 * même avion peut faire plusieurs rotations le même jour par le même aéroport, et GSX ne référence
 * jamais le vol FlightOps concerné — seule la proximité temporelle permet de trancher.
 * `referenceEndIso` ancre le côté arrivée : heure de coupure moteurs (PIREP) pour un vol terminé,
 * heure courante pour un vol en cours.
 */
export function matchGsxReceiptsForFlight(
  receipts: GsxReceipt[],
  flight: MatchableFlight,
  referenceEndIso: string
): GsxReceipt[] {
  const registration = flight.aircraft?.registration
  if (!registration) return []

  const candidates = receipts.filter((receipt) => receipt.tail === registration.toUpperCase())
  const departureCluster = pickClusterNearestAnchor(
    clusterGsxReceiptsByTime(candidates.filter((receipt) => receipt.icao === flight.departureIcao)),
    flight.scheduledDeparture
  )
  const arrivalCluster = pickClusterNearestAnchor(
    clusterGsxReceiptsByTime(candidates.filter((receipt) => receipt.icao === flight.arrivalIcao)),
    referenceEndIso
  )

  const byReceiptId = new Map([...departureCluster, ...arrivalCluster].map((receipt) => [receipt.receiptId, receipt]))
  return [...byReceiptId.values()].sort((a, b) => a.timestampIso.localeCompare(b.timestampIso))
}

/** `referenceEndIso` : passer l'heure de coupure moteurs (PIREP) pour un vol terminé, ou omettre
 * pour un vol en cours (ancre = maintenant). */
export function getGsxReceiptsForFlight(
  flight: MatchableFlight,
  referenceEndIso: string | null = null,
  rootDir: string = getGsxReceiptsRootDir()
): GsxReceipt[] {
  if (!flight.aircraft?.registration) return []
  return matchGsxReceiptsForFlight(listAllGsxReceipts(rootDir), flight, referenceEndIso ?? new Date().toISOString())
}

/** Extrait le montant en euros d'une chaîne de facture GSX ("€4,637.14 ~$ 5,396.42" -> 4637.14).
 * Le séparateur de milliers "," est toujours utilisé dans ces chaînes, quelle que soit la locale
 * système — retiré avant conversion. Retourne null si aucun montant en euros n'est trouvé. */
export function parseGsxEurAmount(text: string): number | null {
  const match = /€\s?([\d,]+\.\d{2})/.exec(text)
  if (!match) return null
  const value = Number.parseFloat(match[1].replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

export interface GsxCostFlightInput extends MatchableFlight {
  /** Heure de coupure moteurs (PIREP) si le vol est terminé, sinon null. */
  referenceEndIso: string | null
}

/**
 * Agrège le coût réel des vols (frais GSX) sur un ensemble de vols, pour les statistiques.
 * Ne lit le disque qu'une seule fois (potentiellement des centaines de fichiers) quel que soit le
 * nombre de vols, plutôt que d'appeler getGsxReceiptsForFlight vol par vol.
 */
export function getGsxCostStatsForFlights(
  flights: GsxCostFlightInput[],
  rootDir: string = getGsxReceiptsRootDir()
): GsxCostStats {
  const allReceipts = listAllGsxReceipts(rootDir)
  const categoryTotals = new Map<string, number>()
  let totalEur = 0
  let flightsWithData = 0

  for (const flight of flights) {
    const matched = matchGsxReceiptsForFlight(allReceipts, flight, flight.referenceEndIso ?? flight.scheduledDeparture)
    if (matched.length === 0) continue
    flightsWithData += 1
    for (const receipt of matched) {
      const amount = parseGsxEurAmount(receipt.total)
      if (amount === null) continue
      totalEur += amount
      categoryTotals.set(receipt.category, (categoryTotals.get(receipt.category) ?? 0) + amount)
    }
  }

  const byCategory: GsxCostCategoryTotal[] = [...categoryTotals.entries()]
    .map(([category, categoryTotalEur]) => ({
      category,
      label: GSX_CATEGORY_LABEL[category] ?? category,
      totalEur: categoryTotalEur
    }))
    .sort((a, b) => b.totalEur - a.totalEur)

  return { totalEur, flightsWithData, byCategory }
}
