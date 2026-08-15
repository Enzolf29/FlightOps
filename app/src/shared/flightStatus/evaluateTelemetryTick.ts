import type { SimTelemetry } from '../types/simconnect'

export type DetectorPhase = 'armed' | 'departed'

export interface DetectorTickState {
  phase: DetectorPhase
  /** Devient vrai dès qu'on observe l'avion en l'air au moins une fois depuis le décollage armé. */
  airborneObserved: boolean
  /** Ticks consécutifs déjà "parqué" (sol, frein mis, quasi à l'arrêt) — voir ON_BLOCKS_CONFIRM_TICKS. */
  onBlocksStreak: number
}

export type TelemetryTransition = 'off_blocks' | 'on_blocks' | 'none'

const GROUND_VELOCITY_THRESHOLD_KNOTS = 5
/**
 * Ticks consécutifs "parqué" (sol + frein + quasi à l'arrêt) avant de confirmer l'arrivée au
 * parking — un simple point d'arrêt en roulage vers la porte (attente de croisement de piste,
 * frein de parking mis brièvement par réflexe) satisfait ces trois conditions pendant un instant
 * sans que le vol soit terminé ; sans ce débounce, le vol se clôturait parfois avant même que le
 * pilote ait fini de rouler jusqu'au parking, avec une heure d'arrivée légèrement trop tôt.
 */
const ON_BLOCKS_CONFIRM_TICKS = 5

type TransitionTelemetry = Pick<SimTelemetry, 'onGround' | 'parkingBrakeSet' | 'groundVelocity'>

/**
 * Un pas de la machine à états de détection de vol, pure et testable indépendamment de SimConnect.
 * "armed" -> "off_blocks" dès que le frein de parking est relâché au sol.
 * "departed" -> "on_blocks" une fois qu'on a observé l'avion en vol, puis reposé au sol, freiné, et
 * resté quasi à l'arrêt pendant ON_BLOCKS_CONFIRM_TICKS ticks consécutifs.
 */
export function evaluateTelemetryTick(
  state: DetectorTickState,
  telemetry: TransitionTelemetry
): { transition: TelemetryTransition; nextState: DetectorTickState } {
  if (state.phase === 'armed') {
    if (telemetry.onGround && !telemetry.parkingBrakeSet) {
      return { transition: 'off_blocks', nextState: { phase: 'departed', airborneObserved: false, onBlocksStreak: 0 } }
    }
    return { transition: 'none', nextState: state }
  }

  if (!state.airborneObserved) {
    if (!telemetry.onGround) {
      return { transition: 'none', nextState: { ...state, airborneObserved: true } }
    }
    return { transition: 'none', nextState: state }
  }

  const isParkedNow =
    telemetry.onGround && telemetry.parkingBrakeSet && telemetry.groundVelocity < GROUND_VELOCITY_THRESHOLD_KNOTS
  if (!isParkedNow) {
    return { transition: 'none', nextState: state.onBlocksStreak === 0 ? state : { ...state, onBlocksStreak: 0 } }
  }

  const onBlocksStreak = state.onBlocksStreak + 1
  if (onBlocksStreak >= ON_BLOCKS_CONFIRM_TICKS) {
    return { transition: 'on_blocks', nextState: state }
  }
  return { transition: 'none', nextState: { ...state, onBlocksStreak } }
}
