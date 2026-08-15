import { describe, expect, it } from 'vitest'
import { describeAircraftType } from './describeAircraftType'

describe('describeAircraftType', () => {
  it('mappe un code OACI connu vers son nom lisible', () => {
    expect(describeAircraftType('A20N', 'A320 271NSL')).toBe('A320neo')
    expect(describeAircraftType('BCS3', 'A220-300')).toBe('A220-300')
  })

  it("ignore la casse et les espaces du code OACI", () => {
    expect(describeAircraftType(' a20n ', null)).toBe('A320neo')
  })

  it('retombe sur le texte brut de la source si le code est inconnu', () => {
    expect(describeAircraftType('ZZZZ', 'Some Rare Type')).toBe('Some Rare Type')
  })

  it('retombe sur le code OACI si rien d’autre n’est disponible', () => {
    expect(describeAircraftType('ZZZZ', null)).toBe('ZZZZ')
    expect(describeAircraftType(null, null)).toBe('')
  })
})
