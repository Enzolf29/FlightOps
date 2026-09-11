export interface GsxReceiptItem {
  description: string
  qty: string
  unitPrice: string
  amount: string
}

export interface GsxReceiptTax {
  label: string
  rate: string
  amount: string
  reason: string
}

export interface GsxReceiptInfoRow {
  label: string
  value: string
}

export interface GsxReceipt {
  category: string
  receiptId: string
  title: string
  dateText: string
  timestampIso: string
  icao: string
  airportName: string
  tail: string
  htmlPath: string
  operator: string
  logoDataUri: string
  receiverName: string
  serviceSectionLabel: string
  chargesSectionLabel: string
  serviceInfoRows: GsxReceiptInfoRow[]
  items: GsxReceiptItem[]
  subtotal: string
  taxes: GsxReceiptTax[]
  total: string
  fxDisclosure: string
}

export const GSX_CATEGORY_LABEL: Record<string, string> = {
  Fuel: 'Carburant',
  Catering: 'Catering',
  Handling: 'Manutention',
  PassengerBus: 'Bus passagers'
}

export interface GsxCostCategoryTotal {
  category: string
  label: string
  totalEur: number
}

export interface GsxCostStats {
  totalEur: number
  /** Nombre de vols terminés pour lesquels au moins une facture GSX a pu être rattachée — tous les
   * vols n'ont pas forcément de données GSX (avion sans addon, service désactivé, etc.). */
  flightsWithData: number
  byCategory: GsxCostCategoryTotal[]
}
