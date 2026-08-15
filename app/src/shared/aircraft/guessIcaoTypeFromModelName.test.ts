import { describe, expect, it } from 'vitest'
import { guessIcaoTypeFromModelName } from './guessIcaoTypeFromModelName'

describe('guessIcaoTypeFromModelName', () => {
  it('reconnaît les modèles descriptifs Airbus courants', () => {
    expect(guessIcaoTypeFromModelName('Airbus A220-300')).toBe('BCS3')
    expect(guessIcaoTypeFromModelName('Airbus A220-100')).toBe('BCS1')
    expect(guessIcaoTypeFromModelName('Airbus A320neo')).toBe('A20N')
    expect(guessIcaoTypeFromModelName('Airbus A320')).toBe('A320')
    expect(guessIcaoTypeFromModelName('Airbus A321neo')).toBe('A21N')
    expect(guessIcaoTypeFromModelName('Airbus A321')).toBe('A321')
    expect(guessIcaoTypeFromModelName('Airbus A330-300')).toBe('A333')
    expect(guessIcaoTypeFromModelName('Airbus A350-900')).toBe('A359')
  })

  it('reconnaît les modèles descriptifs Boeing courants', () => {
    expect(guessIcaoTypeFromModelName('Boeing 737-800')).toBe('B738')
    expect(guessIcaoTypeFromModelName('Boeing 737 MAX 8')).toBe('B38M')
    expect(guessIcaoTypeFromModelName('Boeing 777-300ER')).toBe('B77W')
    expect(guessIcaoTypeFromModelName('Boeing 787-9')).toBe('B789')
  })

  it('distingue les variantes E2 des Embraer de base', () => {
    expect(guessIcaoTypeFromModelName('Embraer E190-E2')).toBe('E290')
    expect(guessIcaoTypeFromModelName('Embraer E190')).toBe('E190')
    expect(guessIcaoTypeFromModelName('Embraer E195-E2')).toBe('E295')
    expect(guessIcaoTypeFromModelName('Embraer E195')).toBe('E195')
  })

  it('distingue ATR 72-600 du ATR 72 générique', () => {
    expect(guessIcaoTypeFromModelName('ATR 72-600')).toBe('AT76')
    expect(guessIcaoTypeFromModelName('ATR 72')).toBe('AT72')
  })

  it('retourne null pour un modèle inconnu', () => {
    expect(guessIcaoTypeFromModelName('Concorde')).toBeNull()
  })

  it('reconnaît un tiret demi-cadratin (–) comme séparateur, pas seulement le tiret ASCII (-)', () => {
    expect(guessIcaoTypeFromModelName('Airbus A220–300')).toBe('BCS3')
    expect(guessIcaoTypeFromModelName('Boeing 777–300ER')).toBe('B77W')
  })
})
