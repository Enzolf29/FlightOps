import { describe, expect, it } from 'vitest'
import {
  evaluateLoadsheetCompletion,
  INITIAL_LOADSHEET_COMPLETION_STATE,
  type LoadsheetCompletionState
} from './evaluateLoadsheetCompletion'

function tick(state: LoadsheetCompletionState, totalWeightKg: number, overrides: Partial<{
  gsxBoardingState: number
  onGround: boolean
  enginesRunning: boolean
}> = {}) {
  return evaluateLoadsheetCompletion(state, {
    totalWeightKg,
    gsxBoardingState: overrides.gsxBoardingState ?? 0,
    onGround: overrides.onGround ?? true,
    enginesRunning: overrides.enginesRunning ?? false
  })
}

describe('evaluateLoadsheetCompletion', () => {
  it('completes immediately when GSX reports boarding complete', () => {
    expect(tick(INITIAL_LOADSHEET_COMPLETION_STATE, 35_000, { gsxBoardingState: 6 }).completedBy).toBe('gsx')
  })

  it('completes after a significant EFB mass change has remained stable for five seconds', () => {
    let state = tick(INITIAL_LOADSHEET_COMPLETION_STATE, 30_000).nextState
    state = tick(state, 35_000).nextState
    for (let index = 0; index < 4; index += 1) {
      const result = tick(state, 35_000 + (index % 2))
      expect(result.completedBy).toBeNull()
      state = result.nextState
    }
    expect(tick(state, 35_000).completedBy).toBe('aircraft_mass')
  })

  it('does not complete for ordinary small weight fluctuations', () => {
    let state = tick(INITIAL_LOADSHEET_COMPLETION_STATE, 30_000).nextState
    for (let index = 0; index < 10; index += 1) state = tick(state, 30_100 + (index % 2)).nextState
    expect(state.significantChangeDetected).toBe(false)
  })

  it('waits while EFB loading is still changing', () => {
    let state = tick(INITIAL_LOADSHEET_COMPLETION_STATE, 30_000).nextState
    for (const weight of [31_000, 32_000, 33_000, 34_000, 35_000]) state = tick(state, weight).nextState
    expect(state.significantChangeDetected).toBe(true)
    expect(state.stableTicks).toBe(0)
  })

  it('never uses the EFB fallback after a GSX service has been observed', () => {
    let state = tick(INITIAL_LOADSHEET_COMPLETION_STATE, 30_000, { gsxBoardingState: 5 }).nextState
    state = tick(state, 35_000).nextState
    for (let index = 0; index < 8; index += 1) state = tick(state, 35_000).nextState
    expect(state.gsxObserved).toBe(true)
    expect(tick(state, 35_000).completedBy).toBeNull()
  })

  it('does not validate EFB loading after engine start or away from the ground', () => {
    let state = tick(INITIAL_LOADSHEET_COMPLETION_STATE, 30_000).nextState
    state = tick(state, 35_000).nextState
    for (let index = 0; index < 8; index += 1) {
      state = tick(state, 35_000, { enginesRunning: true }).nextState
    }
    expect(state.stableTicks).toBe(0)
  })
})
