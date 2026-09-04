export type LoadsheetCompletionSource = 'gsx' | 'aircraft_mass'

export interface LoadsheetCompletionState {
  baselineWeightKg: number | null
  previousWeightKg: number | null
  significantChangeDetected: boolean
  stableTicks: number
  gsxObserved: boolean
}

export const INITIAL_LOADSHEET_COMPLETION_STATE: LoadsheetCompletionState = {
  baselineWeightKg: null,
  previousWeightKg: null,
  significantChangeDetected: false,
  stableTicks: 0,
  gsxObserved: false
}

const SIGNIFICANT_MASS_CHANGE_KG = 300
const STABLE_MASS_TOLERANCE_KG = 2
const STABLE_TICKS_REQUIRED = 5

interface LoadsheetCompletionTick {
  totalWeightKg: number | null | undefined
  gsxBoardingState: number | undefined
  onGround: boolean
  enginesRunning: boolean
}

/**
 * Valide la fin du chargement soit explicitement via GSX (état 6), soit via une modification EFB
 * importante suivie de cinq lectures stables. Le secours EFB est désactivé dès qu'un véritable
 * service GSX a été observé afin de ne pas figer la feuille en plein embarquement GSX.
 */
export function evaluateLoadsheetCompletion(
  state: LoadsheetCompletionState,
  tick: LoadsheetCompletionTick
): { completedBy: LoadsheetCompletionSource | null; nextState: LoadsheetCompletionState } {
  const gsxState = tick.gsxBoardingState ?? 0
  const gsxObserved = state.gsxObserved || gsxState > 0
  if (gsxState === 6) return { completedBy: 'gsx', nextState: { ...state, gsxObserved: true } }

  const weight = tick.totalWeightKg
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    return { completedBy: null, nextState: { ...state, gsxObserved, stableTicks: 0 } }
  }

  if (state.baselineWeightKg === null) {
    return {
      completedBy: null,
      nextState: { ...state, baselineWeightKg: weight, previousWeightKg: weight, gsxObserved }
    }
  }

  // Le chargement EFB doit se produire avion immobilisé, avant la mise en route. Dès qu'un service
  // GSX est visible, seul son état "terminé" peut valider la feuille.
  if (gsxObserved || !tick.onGround || tick.enginesRunning) {
    return { completedBy: null, nextState: { ...state, previousWeightKg: weight, stableTicks: 0, gsxObserved } }
  }

  const significantChangeDetected = state.significantChangeDetected
    || Math.abs(weight - state.baselineWeightKg) >= SIGNIFICANT_MASS_CHANGE_KG
  const stable = state.previousWeightKg !== null
    && Math.abs(weight - state.previousWeightKg) <= STABLE_MASS_TOLERANCE_KG
  const stableTicks = significantChangeDetected && stable ? state.stableTicks + 1 : 0
  const nextState = {
    ...state,
    previousWeightKg: weight,
    significantChangeDetected,
    stableTicks,
    gsxObserved
  }

  return {
    completedBy: significantChangeDetected && stableTicks >= STABLE_TICKS_REQUIRED ? 'aircraft_mass' : null,
    nextState
  }
}
