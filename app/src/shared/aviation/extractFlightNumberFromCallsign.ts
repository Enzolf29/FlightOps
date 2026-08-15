/**
 * Extrait le suffixe numéro de vol d'un callsign/numéro de vol (préfixe OACI ou IATA) émis par la
 * compagnie concernée, ex. "AFR1445" + "AFR" -> "1445", ou "AF1445" + "AF" -> "1445". Retourne
 * null si le préfixe ne correspond pas ou si le suffixe restant n'a pas la forme d'un numéro
 * plausible.
 */
export function extractFlightNumberFromCallsign(callsign: string, companyIcaoCode: string): string | null {
  const normalized = callsign.trim().toUpperCase().replace(/\s+/g, '')
  const prefix = companyIcaoCode.trim().toUpperCase()
  if (!prefix || !normalized.startsWith(prefix)) return null

  const suffix = normalized.slice(prefix.length)
  if (!/^[A-Z0-9]{1,4}$/.test(suffix)) return null

  return suffix
}
