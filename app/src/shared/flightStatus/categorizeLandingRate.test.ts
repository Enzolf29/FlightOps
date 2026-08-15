import { describe, expect, it } from 'vitest'
import { categorizeLandingRate } from './categorizeLandingRate'

describe('categorizeLandingRate', () => {
  it('classe très doux entre 0 et -100 ft/min', () => {
    expect(categorizeLandingRate(0)).toBe('very_smooth')
    expect(categorizeLandingRate(50)).toBe('very_smooth')
    expect(categorizeLandingRate(-50)).toBe('very_smooth')
    expect(categorizeLandingRate(-100)).toBe('very_smooth')
  })

  it('classe doux entre -101 et -180 ft/min', () => {
    expect(categorizeLandingRate(-101)).toBe('smooth')
    expect(categorizeLandingRate(-150)).toBe('smooth')
    expect(categorizeLandingRate(-180)).toBe('smooth')
  })

  it('classe normal entre -181 et -250 ft/min', () => {
    expect(categorizeLandingRate(-181)).toBe('normal')
    expect(categorizeLandingRate(-220)).toBe('normal')
    expect(categorizeLandingRate(-250)).toBe('normal')
  })

  it('classe ferme entre -251 et -350 ft/min', () => {
    expect(categorizeLandingRate(-251)).toBe('firm')
    expect(categorizeLandingRate(-300)).toBe('firm')
    expect(categorizeLandingRate(-350)).toBe('firm')
  })

  it('classe dur entre -351 et -500 ft/min', () => {
    expect(categorizeLandingRate(-351)).toBe('hard')
    expect(categorizeLandingRate(-450)).toBe('hard')
    expect(categorizeLandingRate(-500)).toBe('hard')
  })

  it('classe très dur au-delà de -500 ft/min', () => {
    expect(categorizeLandingRate(-501)).toBe('very_hard')
    expect(categorizeLandingRate(-800)).toBe('very_hard')
  })
})
