/**
 * Grille de calendrier calculée entièrement en UTC (jamais via les getters locaux de Date),
 * pour rester cohérent avec le reste de l'app où toutes les heures de vol sont en UTC — voir
 * le bug corrigé dans format.ts où le fuseau local avait fini par fuiter dans l'affichage.
 */

const MS_PER_DAY = 86_400_000

export function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function addMonthsUtc(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1))
}

export function addDaysUtc(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * MS_PER_DAY)
}

export function isSameMonthUtc(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
}

export function isSameDayUtc(a: Date, b: Date): boolean {
  return isSameMonthUtc(a, b) && a.getUTCDate() === b.getUTCDate()
}

export function isTodayUtc(date: Date): boolean {
  return isSameDayUtc(date, new Date())
}

export function dayKeyUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** Grille de 42 jours (6 semaines, lundi en premier) couvrant tout le mois de `monthStart`. */
export function getMonthGridUtc(monthStart: Date): Date[] {
  const weekday = monthStart.getUTCDay() // 0=dim..6=sam
  const offsetFromMonday = (weekday + 6) % 7
  const gridStart = addDaysUtc(monthStart, -offsetFromMonday)
  return Array.from({ length: 42 }, (_, i) => addDaysUtc(gridStart, i))
}

/** Lundi (UTC) de la semaine contenant `date`, heure remise à minuit. */
export function startOfWeekUtc(date: Date): Date {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = dayStart.getUTCDay() // 0=dim..6=sam
  const offsetFromMonday = (weekday + 6) % 7
  return addDaysUtc(dayStart, -offsetFromMonday)
}

export function addWeeksUtc(date: Date, amount: number): Date {
  return addDaysUtc(date, amount * 7)
}

/** Les 7 jours (lundi à dimanche) de la semaine commençant à `weekStart`. */
export function getWeekGridUtc(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDaysUtc(weekStart, i))
}
