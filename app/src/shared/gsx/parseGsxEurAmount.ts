/** Extrait le montant en euros d'une chaîne de facture GSX ("€4,637.14 ~$ 5,396.42" -> 4637.14).
 * Le séparateur de milliers "," est toujours utilisé dans ces chaînes, quelle que soit la locale
 * système — retiré avant conversion. Retourne null si aucun montant en euros n'est trouvé. */
export function parseGsxEurAmount(text: string): number | null {
  const match = /€\s?([\d,]+\.\d{2})/.exec(text)
  if (!match) return null
  const value = Number.parseFloat(match[1].replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}
