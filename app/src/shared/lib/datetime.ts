/** Convertit un ISO 8601 ("2026-08-01T12:00:00.000Z") vers le format datetime() de SQLite ("2026-08-01 12:00:00"). */
export function isoToSqliteUtc(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ')
}

/**
 * Accepte deux formats : les valeurs `datetime('now')` de SQLite ("2026-08-01 12:00:00", UTC mais
 * sans marqueur de fuseau) et les ISO 8601 complets déjà zonés ("2026-08-01T12:00:00.000Z", ex.
 * heure Zulu du simulateur ou OFP SimBrief) — sans quoi on ajoute un second "Z" et on obtient une
 * date invalide (bug déjà rencontré une fois, cf. historique de format.ts).
 */
export function parseUtc(datetime: string): Date {
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(datetime)) {
    return new Date(datetime)
  }
  return new Date(datetime.replace(' ', 'T') + 'Z')
}
