import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clusterGsxReceiptsByTime,
  getGsxCostStatsForFlights,
  getGsxReceiptsForFlight,
  listAllGsxReceipts,
  parseGsxEurAmount,
  parseGsxReceiptJson,
  parseGsxTimestamp,
  pickClusterNearestAnchor,
  readGsxReceiptHtml
} from './gsxReceiptsRepository'
import type { GsxReceipt } from '@shared/types/gsxReceipt'

function makeReceiptJson(overrides: Partial<{ receiptId: string; icao: string; tail: string; total: string }> = {}): string {
  return JSON.stringify({
    title: 'FUEL DELIVERY RECEIPT',
    receiptId: overrides.receiptId ?? 'GSX-fuel',
    dateText: '11-sept.-2026 14:46 UTC',
    icao: overrides.icao ?? 'LFRS',
    airportName: 'Nantes/Atlantique',
    tail: overrides.tail ?? 'EC-NOP',
    operator: 'British Petroleum',
    logoDataUri: 'data:image/png;base64,abc',
    airline: 'Alaeo S.L. t/a Volotea Airlines',
    serviceSectionLabel: 'PRODUCT INFORMATION',
    chargesSectionLabel: 'CHARGES',
    serviceInfoRows: [['PRODUCT TYPE', 'Jet-A1'], ['UPLIFT DATE', '11-sept.-2026']],
    items: [{ description: 'Jet-A1 fuel', qty: '1,169 gal', unitPrice: '€3.84/gal', amount: '€4,486.46' }],
    subtotal: '€4,486.46',
    taxes: [{ label: 'France VAT', rate: '0%', amount: '€0.00', reason: 'Intra-EU flight' }],
    total: overrides.total ?? '€4,637.14',
    fxDisclosure: 'Rates as of 2026-09-10 via Frankfurter · 1 USD = 0.8593 EUR'
  })
}

function makeReceipt(timestampIso: string, overrides: Partial<GsxReceipt> = {}): GsxReceipt {
  return {
    category: 'Fuel',
    receiptId: overrides.receiptId ?? `GSX-${timestampIso}`,
    title: 'FUEL DELIVERY RECEIPT',
    dateText: '',
    timestampIso,
    icao: overrides.icao ?? 'LFRS',
    airportName: '',
    tail: overrides.tail ?? 'EC-NOP',
    htmlPath: '',
    operator: '',
    logoDataUri: '',
    receiverName: '',
    serviceSectionLabel: '',
    chargesSectionLabel: '',
    serviceInfoRows: [],
    items: [],
    subtotal: '',
    taxes: [],
    total: overrides.total ?? '',
    fxDisclosure: ''
  }
}

function makeFlight(overrides: Partial<{
  departureIcao: string
  arrivalIcao: string
  scheduledDeparture: string
  registration: string | null
}> = {}) {
  return {
    departureIcao: overrides.departureIcao ?? 'LFRS',
    arrivalIcao: overrides.arrivalIcao ?? 'LEBL',
    scheduledDeparture: overrides.scheduledDeparture ?? '2026-09-11 15:00:00',
    aircraft: { type: 'A320', registration: overrides.registration === undefined ? 'EC-NOP' : overrides.registration }
  }
}

describe('parseGsxTimestamp', () => {
  it('converts a GSX filename timestamp to ISO 8601', () => {
    expect(parseGsxTimestamp('20260911T144638Z')).toBe('2026-09-11T14:46:38Z')
  })

  it('returns null for an unrecognised format', () => {
    expect(parseGsxTimestamp('not-a-timestamp')).toBeNull()
  })
})

describe('parseGsxReceiptJson', () => {
  it('parses a valid receipt file into a GsxReceipt', () => {
    const receipt = parseGsxReceiptJson('Fuel', '20260911T144638Z_LFRS_EC-NOP.json', makeReceiptJson())
    expect(receipt).toEqual({
      category: 'Fuel',
      receiptId: 'GSX-fuel',
      title: 'FUEL DELIVERY RECEIPT',
      dateText: '11-sept.-2026 14:46 UTC',
      timestampIso: '2026-09-11T14:46:38Z',
      icao: 'LFRS',
      airportName: 'Nantes/Atlantique',
      tail: 'EC-NOP',
      htmlPath: '',
      operator: 'British Petroleum',
      logoDataUri: 'data:image/png;base64,abc',
      receiverName: 'Alaeo S.L. t/a Volotea Airlines',
      serviceSectionLabel: 'PRODUCT INFORMATION',
      chargesSectionLabel: 'CHARGES',
      serviceInfoRows: [
        { label: 'PRODUCT TYPE', value: 'Jet-A1' },
        { label: 'UPLIFT DATE', value: '11-sept.-2026' }
      ],
      items: [{ description: 'Jet-A1 fuel', qty: '1,169 gal', unitPrice: '€3.84/gal', amount: '€4,486.46' }],
      subtotal: '€4,486.46',
      taxes: [{ label: 'France VAT', rate: '0%', amount: '€0.00', reason: 'Intra-EU flight' }],
      total: '€4,637.14',
      fxDisclosure: 'Rates as of 2026-09-10 via Frankfurter · 1 USD = 0.8593 EUR'
    })
  })

  it('returns null when the filename does not match the GSX receipt pattern', () => {
    expect(parseGsxReceiptJson('Fuel', 'not-a-receipt.json', makeReceiptJson())).toBeNull()
  })

  it('returns null for invalid JSON instead of throwing', () => {
    expect(parseGsxReceiptJson('Fuel', '20260911T144638Z_LFRS_EC-NOP.json', 'not json')).toBeNull()
  })
})

describe('clusterGsxReceiptsByTime', () => {
  it('groups receipts less than 90 minutes apart into one cluster', () => {
    const receipts = [
      makeReceipt('2026-09-11T11:58:20Z'),
      makeReceipt('2026-09-11T12:01:24Z'),
      makeReceipt('2026-09-11T12:04:00Z')
    ]
    expect(clusterGsxReceiptsByTime(receipts)).toHaveLength(1)
  })

  it('splits receipts more than 90 minutes apart into separate clusters', () => {
    // Un tour d'escale vers midi (arrivée du vol précédent), puis un autre vers 14h43 (préparation
    // du vol suivant) sur le même avion et le même aéroport — le cas réel qui a motivé ce test.
    const receipts = [
      makeReceipt('2026-09-11T11:58:20Z'),
      makeReceipt('2026-09-11T12:04:00Z'),
      makeReceipt('2026-09-11T14:43:49Z'),
      makeReceipt('2026-09-11T15:12:00Z')
    ]
    const clusters = clusterGsxReceiptsByTime(receipts)
    expect(clusters).toHaveLength(2)
    expect(clusters[0]).toHaveLength(2)
    expect(clusters[1]).toHaveLength(2)
  })
})

describe('pickClusterNearestAnchor', () => {
  const earlyCluster = [makeReceipt('2026-09-11T11:58:20Z'), makeReceipt('2026-09-11T12:04:00Z')]
  const lateCluster = [makeReceipt('2026-09-11T14:43:49Z'), makeReceipt('2026-09-11T15:12:00Z')]

  it('keeps only the cluster closest to the anchor time', () => {
    expect(pickClusterNearestAnchor([earlyCluster, lateCluster], '2026-09-11T15:00:00Z')).toBe(lateCluster)
    expect(pickClusterNearestAnchor([earlyCluster, lateCluster], '2026-09-11T12:00:00Z')).toBe(earlyCluster)
  })

  it('returns an empty array when no cluster is within range of the anchor', () => {
    expect(pickClusterNearestAnchor([earlyCluster], '2026-09-20T12:00:00Z')).toEqual([])
  })

  it('returns an empty array for no clusters', () => {
    expect(pickClusterNearestAnchor([], '2026-09-11T15:00:00Z')).toEqual([])
  })
})

describe('listAllGsxReceipts and getGsxReceiptsForFlight', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gsx-receipts-test-'))
    const fuelDir = join(root, 'Fuel')
    const handlingDir = join(root, 'Handling')
    mkdirSync(fuelDir, { recursive: true })
    mkdirSync(handlingDir, { recursive: true })

    // Passage sol de l'arrivée du vol précédent, vers midi.
    writeFileSync(
      join(handlingDir, '20260911T120400Z_LFRS_EC-NOP.json'),
      makeReceiptJson({ receiptId: 'GSX-arrival-turn', total: '€262.70' })
    )
    // Passage sol de préparation du vol suivi (départ prévu 15:00), vers 14h46.
    writeFileSync(
      join(fuelDir, '20260911T144638Z_LFRS_EC-NOP.json'),
      makeReceiptJson({ receiptId: 'GSX-departure-fuel', total: '€4,637.14' })
    )
    // Fichier corrompu : ne doit pas faire échouer la lecture du dossier.
    writeFileSync(join(fuelDir, '20260911T150000Z_LFRS_EC-NOP.json'), '{ broken')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('returns an empty list when the GSX receipts folder does not exist', () => {
    expect(listAllGsxReceipts(join(root, 'missing'))).toEqual([])
  })

  it('lists valid receipts and silently skips corrupted ones', () => {
    const receipts = listAllGsxReceipts(root)
    expect(receipts).toHaveLength(2)
  })

  it('only attaches the ground-service pass closest to this flight, not an earlier turnaround on the same tail', () => {
    const matched = getGsxReceiptsForFlight(makeFlight(), null, root)
    expect(matched).toHaveLength(1)
    expect(matched[0].receiptId).toBe('GSX-departure-fuel')
  })

  it('returns no receipts for a different tail number', () => {
    expect(getGsxReceiptsForFlight(makeFlight({ registration: 'F-HBLF' }), null, root)).toEqual([])
  })

  it('returns no receipts when the flight has no assigned aircraft', () => {
    expect(getGsxReceiptsForFlight(makeFlight({ registration: null }), null, root)).toEqual([])
  })

  it('returns no receipts when the receipt airport matches neither departure nor arrival', () => {
    expect(
      getGsxReceiptsForFlight(makeFlight({ departureIcao: 'LFPO', arrivalIcao: 'LFPG' }), null, root)
    ).toEqual([])
  })
})

describe('readGsxReceiptHtml', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gsx-receipts-html-test-'))
    mkdirSync(join(root, 'Fuel'), { recursive: true })
    writeFileSync(join(root, 'Fuel', '20260911T144638Z_LFRS_EC-NOP.html'), '<html><body>Facture</body></html>')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reads a receipt HTML file located under the receipts root', () => {
    const htmlPath = join(root, 'Fuel', '20260911T144638Z_LFRS_EC-NOP.html')
    expect(readGsxReceiptHtml(htmlPath, root)).toBe('<html><body>Facture</body></html>')
  })

  it('refuses to read a path outside the receipts root', () => {
    const outsidePath = join(tmpdir(), 'not-a-gsx-receipt.html')
    writeFileSync(outsidePath, '<html>evil</html>')
    expect(readGsxReceiptHtml(outsidePath, root)).toBeNull()
    rmSync(outsidePath, { force: true })
  })

  it('returns null when the file does not exist', () => {
    expect(readGsxReceiptHtml(join(root, 'Fuel', 'missing.html'), root)).toBeNull()
  })
})

describe('parseGsxEurAmount', () => {
  it('extracts the euro amount from a dual-currency total string', () => {
    expect(parseGsxEurAmount('€4,637.14 ~$ 5,396.42')).toBe(4637.14)
    expect(parseGsxEurAmount('€262.70 ~$ 305.72')).toBe(262.7)
  })

  it('returns null when no euro amount is present', () => {
    expect(parseGsxEurAmount('$ 305.72')).toBeNull()
    expect(parseGsxEurAmount('')).toBeNull()
  })
})

describe('getGsxCostStatsForFlights', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gsx-cost-stats-test-'))
    const fuelDir = join(root, 'Fuel')
    const cateringDir = join(root, 'Catering')
    mkdirSync(fuelDir, { recursive: true })
    mkdirSync(cateringDir, { recursive: true })

    writeFileSync(
      join(fuelDir, '20260911T144638Z_LFRS_EC-NOP.json'),
      makeReceiptJson({ receiptId: 'GSX-fuel', total: '€4,637.14 ~$ 5,396.42' })
    )
    writeFileSync(
      join(cateringDir, '20260911T144349Z_LFRS_EC-NOP.json'),
      makeReceiptJson({ receiptId: 'GSX-catering', total: '€188.55 ~$ 219.42' })
    )
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('aggregates matched receipts across flights, ignoring flights with no match', () => {
    const stats = getGsxCostStatsForFlights(
      [
        { ...makeFlight(), referenceEndIso: null },
        { ...makeFlight({ registration: 'F-HBLF' }), referenceEndIso: null }
      ],
      root
    )

    expect(stats.flightsWithData).toBe(1)
    expect(stats.totalEur).toBeCloseTo(4637.14 + 188.55, 2)
    expect(stats.byCategory).toEqual([
      { category: 'Fuel', label: 'Carburant', totalEur: 4637.14 },
      { category: 'Catering', label: 'Catering', totalEur: 188.55 }
    ])
  })

  it('returns zeroed stats when no flight has GSX data', () => {
    const stats = getGsxCostStatsForFlights([{ ...makeFlight({ registration: null }), referenceEndIso: null }], root)
    expect(stats).toEqual({ totalEur: 0, flightsWithData: 0, byCategory: [] })
  })
})
