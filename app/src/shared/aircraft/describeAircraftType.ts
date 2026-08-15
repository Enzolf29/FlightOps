/** Codes OACI courants (compagnies suivies) vers un nom de modèle lisible et complet. */
const ICAO_TYPE_NAMES: Record<string, string> = {
  A19N: 'A319neo',
  A20N: 'A320neo',
  A21N: 'A321neo',
  A318: 'A318',
  A319: 'A319',
  A320: 'A320',
  A321: 'A321',
  A332: 'A330-200',
  A333: 'A330-300',
  A338: 'A330-800neo',
  A339: 'A330-900neo',
  A342: 'A340-200',
  A343: 'A340-300',
  A345: 'A340-500',
  A346: 'A340-600',
  A359: 'A350-900',
  A35K: 'A350-1000',
  A388: 'A380-800',
  BCS1: 'A220-100',
  BCS3: 'A220-300',
  B734: 'B737-400',
  B735: 'B737-500',
  B736: 'B737-600',
  B737: 'B737-700',
  B738: 'B737-800',
  B739: 'B737-900',
  B38M: 'B737 MAX 8',
  B39M: 'B737 MAX 9',
  B3XM: 'B737 MAX 10',
  B744: 'B747-400',
  B748: 'B747-8',
  B752: 'B757-200',
  B753: 'B757-300',
  B762: 'B767-200',
  B763: 'B767-300',
  B764: 'B767-400',
  B772: 'B777-200',
  B77L: 'B777-200LR',
  B773: 'B777-300',
  B77W: 'B777-300ER',
  B778: 'B777-8',
  B779: 'B777-9',
  B788: 'B787-8',
  B789: 'B787-9',
  B78X: 'B787-10',
  CRJ7: 'CRJ700',
  CRJ9: 'CRJ900',
  CRJX: 'CRJ1000',
  E170: 'Embraer 170',
  E175: 'Embraer 175',
  E190: 'Embraer 190',
  E195: 'Embraer 195',
  E290: 'Embraer 190-E2',
  E295: 'Embraer 195-E2',
  AT45: 'ATR 42',
  AT72: 'ATR 72',
  AT76: 'ATR 72-600',
  DH8D: 'Dash 8 Q400'
}

/**
 * Construit un nom de modèle lisible à partir d'un code OACI (ex. "A20N" -> "A320neo").
 * Si le code n'est pas reconnu, retombe sur le texte brut fourni par la source (adsbdb),
 * puis sur le code OACI lui-même en dernier recours.
 */
export function describeAircraftType(icaoType: string | null, fallbackType: string | null): string {
  const normalized = icaoType?.trim().toUpperCase() ?? ''
  if (normalized && ICAO_TYPE_NAMES[normalized]) return ICAO_TYPE_NAMES[normalized]
  if (fallbackType?.trim()) return fallbackType.trim()
  return normalized
}
