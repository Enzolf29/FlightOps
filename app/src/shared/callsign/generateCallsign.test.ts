import { describe, expect, it } from 'vitest'
import { generateCallsign } from './generateCallsign'

function sequenceRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('generateCallsign', () => {
  it('builds a 4-digit suffix for XXX0000', () => {
    const result = generateCallsign({
      icaoCode: 'AFR',
      radioCallsign: 'AIRFRANS',
      pattern: 'XXX0000',
      rng: () => 0.5
    })
    expect(result.raw).toBe('AFR5555')
    expect(result.display).toBe('AIRFRANS 5555')
  })

  it('builds a 3-digit suffix for XXX000', () => {
    const result = generateCallsign({ icaoCode: 'RYR', radioCallsign: 'RYANAIR', pattern: 'XXX000', rng: () => 0.1 })
    expect(result.raw).toBe('RYR111')
  })

  it('builds 2 digits + 2 letters for XXX00AB', () => {
    const result = generateCallsign({
      icaoCode: 'AFR',
      radioCallsign: 'AIRFRANS',
      pattern: 'XXX00AB',
      rng: () => 0
    })
    expect(result.raw).toBe('AFR00AA')
  })

  it('builds 2 digits + 1 letter for XXX00A', () => {
    const result = generateCallsign({
      icaoCode: 'VLG',
      radioCallsign: 'VUELING',
      pattern: 'XXX00A',
      rng: () => 0
    })
    expect(result.raw).toBe('VLG00A')
  })

  it('picks among the 4 concrete patterns when RANDOM is used', () => {
    // rng sequence: first call picks the pattern index, following calls build the suffix
    const result = generateCallsign({
      icaoCode: 'SWR',
      radioCallsign: 'SWISS',
      pattern: 'RANDOM',
      rng: sequenceRng([0.99, 0, 0]) // picks last pattern (XXX00A), then digits/letters
    })
    expect(result.raw).toMatch(/^SWR\d{2}[A-Z]$/)
  })

  it('retries on collision and returns a callsign not in existingCallsigns', () => {
    // each 4-digit attempt consumes 4 rng() calls: first attempt all 0.5 -> "5555" (colliding),
    // second attempt all 0.9 -> "9999"
    const values = [0.5, 0.5, 0.5, 0.5, 0.9, 0.9, 0.9, 0.9]
    const result = generateCallsign({
      icaoCode: 'AFR',
      radioCallsign: 'AIRFRANS',
      pattern: 'XXX0000',
      existingCallsigns: ['AFR5555'],
      rng: sequenceRng(values)
    })
    expect(result.raw).toBe('AFR9999')
  })

  it('throws after exhausting maxAttempts on permanent collision', () => {
    expect(() =>
      generateCallsign({
        icaoCode: 'AFR',
        radioCallsign: 'AIRFRANS',
        pattern: 'XXX0000',
        existingCallsigns: ['AFR5555'],
        rng: () => 0.5,
        maxAttempts: 3
      })
    ).toThrow()
  })
})
