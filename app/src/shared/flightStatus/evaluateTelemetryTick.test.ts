import { describe, expect, it } from 'vitest'
import { evaluateTelemetryTick } from './evaluateTelemetryTick'
import type { DetectorTickState } from './evaluateTelemetryTick'

const ARMED: DetectorTickState = { phase: 'armed', airborneObserved: false, onBlocksStreak: 0 }

describe('evaluateTelemetryTick', () => {
  it('stays idle while parked on the ground with the brake set', () => {
    const { transition, nextState } = evaluateTelemetryTick(ARMED, {
      onGround: true,
      parkingBrakeSet: true,
      groundVelocity: 0
    })
    expect(transition).toBe('none')
    expect(nextState).toEqual(ARMED)
  })

  it('detects off-blocks when the brake is released on the ground', () => {
    const { transition, nextState } = evaluateTelemetryTick(ARMED, {
      onGround: true,
      parkingBrakeSet: false,
      groundVelocity: 2
    })
    expect(transition).toBe('off_blocks')
    expect(nextState).toEqual({ phase: 'departed', airborneObserved: false, onBlocksStreak: 0 })
  })

  it('does not detect landing before the aircraft has ever been airborne', () => {
    const departedNotYetAirborne: DetectorTickState = { phase: 'departed', airborneObserved: false, onBlocksStreak: 0 }
    const { transition, nextState } = evaluateTelemetryTick(departedNotYetAirborne, {
      onGround: true,
      parkingBrakeSet: true,
      groundVelocity: 0
    })
    // still taxiing before takeoff — must not be mistaken for landing
    expect(transition).toBe('none')
    expect(nextState.airborneObserved).toBe(false)
  })

  it('marks airborneObserved once the aircraft leaves the ground', () => {
    const departedNotYetAirborne: DetectorTickState = { phase: 'departed', airborneObserved: false, onBlocksStreak: 0 }
    const { transition, nextState } = evaluateTelemetryTick(departedNotYetAirborne, {
      onGround: false,
      parkingBrakeSet: false,
      groundVelocity: 140
    })
    expect(transition).toBe('none')
    expect(nextState.airborneObserved).toBe(true)
  })

  it('does not detect on-blocks while still rolling out on the runway', () => {
    const airborne: DetectorTickState = { phase: 'departed', airborneObserved: true, onBlocksStreak: 0 }
    const { transition } = evaluateTelemetryTick(airborne, {
      onGround: true,
      parkingBrakeSet: false,
      groundVelocity: 80
    })
    expect(transition).toBe('none')
  })

  it('does not confirm on-blocks on a single parked-looking tick', () => {
    const airborne: DetectorTickState = { phase: 'departed', airborneObserved: true, onBlocksStreak: 0 }
    const { transition, nextState } = evaluateTelemetryTick(airborne, {
      onGround: true,
      parkingBrakeSet: true,
      groundVelocity: 0
    })
    expect(transition).toBe('none')
    expect(nextState.onBlocksStreak).toBe(1)
  })

  it('confirms on-blocks only after several consecutive parked ticks', () => {
    let state: DetectorTickState = { phase: 'departed', airborneObserved: true, onBlocksStreak: 0 }
    let transition = 'none'
    for (let i = 0; i < 5; i++) {
      const result = evaluateTelemetryTick(state, { onGround: true, parkingBrakeSet: true, groundVelocity: 0 })
      transition = result.transition
      state = result.nextState
      if (transition === 'on_blocks') break
    }
    expect(transition).toBe('on_blocks')
  })

  it('does not mistake a brief brake tap during taxi-in for arriving at the gate', () => {
    // Roulage vers le parking : un arrêt bref (croisement de piste, frein tapé par réflexe) coche
    // les trois conditions pendant 2 ticks, puis le roulage reprend — le vol ne doit pas se
    // terminer là, seulement au véritable arrêt final.
    let state: DetectorTickState = { phase: 'departed', airborneObserved: true, onBlocksStreak: 0 }

    for (const tick of [
      { onGround: true, parkingBrakeSet: true, groundVelocity: 0 },
      { onGround: true, parkingBrakeSet: true, groundVelocity: 0 },
      { onGround: true, parkingBrakeSet: false, groundVelocity: 12 } // reprise du roulage
    ]) {
      const result = evaluateTelemetryTick(state, tick)
      expect(result.transition).toBe('none')
      state = result.nextState
    }
    expect(state.onBlocksStreak).toBe(0)
  })
})
