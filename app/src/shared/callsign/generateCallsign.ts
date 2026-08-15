import type { CallsignPattern } from '../types/company'

export interface GenerateCallsignOptions {
  icaoCode: string
  radioCallsign: string
  pattern: CallsignPattern
  existingCallsigns?: Iterable<string>
  rng?: () => number
  maxAttempts?: number
}

export interface GeneratedCallsign {
  raw: string
  display: string
}

const CONCRETE_PATTERNS = ['XXX0000', 'XXX000', 'XXX00AB', 'XXX00A'] as const
type ConcretePattern = (typeof CONCRETE_PATTERNS)[number]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function randomDigits(count: number, rng: () => number): string {
  let result = ''
  for (let i = 0; i < count; i++) {
    result += Math.floor(rng() * 10)
  }
  return result
}

function randomLetters(count: number, rng: () => number): string {
  let result = ''
  for (let i = 0; i < count; i++) {
    result += LETTERS[Math.floor(rng() * LETTERS.length)]
  }
  return result
}

function pickRandomPattern(rng: () => number): ConcretePattern {
  return CONCRETE_PATTERNS[Math.floor(rng() * CONCRETE_PATTERNS.length)]
}

function generateSuffix(pattern: ConcretePattern, rng: () => number): string {
  switch (pattern) {
    case 'XXX0000':
      return randomDigits(4, rng)
    case 'XXX000':
      return randomDigits(3, rng)
    case 'XXX00AB':
      return randomDigits(2, rng) + randomLetters(2, rng)
    case 'XXX00A':
      return randomDigits(2, rng) + randomLetters(1, rng)
  }
}

/**
 * Génère un callsign unique pour un vol. Si `pattern` vaut 'RANDOM', un format concret
 * est tiré au hasard parmi les 4 disponibles à chaque appel (donc potentiellement différent
 * d'un vol à l'autre pour une même compagnie).
 */
export function generateCallsign(options: GenerateCallsignOptions): GeneratedCallsign {
  const rng = options.rng ?? Math.random
  const maxAttempts = options.maxAttempts ?? 20
  const existing = new Set(options.existingCallsigns ?? [])

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pattern = options.pattern === 'RANDOM' ? pickRandomPattern(rng) : options.pattern
    const suffix = generateSuffix(pattern, rng)
    const raw = options.icaoCode + suffix

    if (!existing.has(raw)) {
      return { raw, display: `${options.radioCallsign} ${suffix}` }
    }
  }

  throw new Error(`Impossible de générer un callsign unique pour ${options.icaoCode} après ${maxAttempts} tentatives`)
}
