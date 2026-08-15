import { describe, expect, it } from 'vitest'
import { evaluateFlightEvents, INITIAL_FLIGHT_EVENT_FLAGS } from './evaluateFlightEvents'
import type { FlightEvent } from './evaluateFlightEvents'
import type { SimTelemetry } from '../types/simconnect'

function telemetry(overrides: Partial<SimTelemetry>): SimTelemetry {
  return {
    latitude: 0,
    longitude: 0,
    altitude: 0,
    headingTrue: 0,
    bankDegrees: 0,
    pitchDegrees: 0,
    gForce: 1,
    enginesRunning: false,
    engine1Running: false,
    engine2Running: false,
    engine3Running: false,
    engine4Running: false,
    landingLightsOn: false,
    taxiLightsOn: false,
    strobeLightsOn: false,
    beaconLightsOn: false,
    navLightsOn: false,
    wingLightsOn: false,
    logoLightsOn: false,
    airspeedIndicated: 0,
    groundVelocity: 0,
    verticalSpeed: 0,
    onGround: true,
    parkingBrakeSet: true,
    gearHandleDown: true,
    flapsPercent: 0,
    flapsHandleIndex: 0,
    flapsNumHandlePositions: 4,
    fuelTotalWeight: 0,
    title: 'A320neo',
    atcId: 'F-HZUK',
    simZuluIso: '2026-08-01T12:00:00.000Z',
    ...overrides
  }
}

describe('evaluateFlightEvents', () => {
  it('emits nothing on the very first tick (no previous telemetry)', () => {
    const { events } = evaluateFlightEvents(null, telemetry({}), INITIAL_FLIGHT_EVENT_FLAGS)
    expect(events).toEqual([])
  })

  it('detects takeoff (ground -> airborne)', () => {
    const previous = telemetry({ onGround: true })
    const current = telemetry({ onGround: false })
    const { events, nextFlags } = evaluateFlightEvents(previous, current, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(events).toContainEqual(expect.objectContaining({ type: 'takeoff' }))
    expect(nextFlags.wasAirborne).toBe(true)
  })

  it('does not treat a ground bounce right after takeoff as a landing (GSX pushback / rotation skip)', () => {
    const onGround = telemetry({ onGround: true, simZuluIso: '2026-08-01T12:00:00.000Z' })
    const airborne = telemetry({ onGround: false, simZuluIso: '2026-08-01T12:00:01.000Z' })
    const takeoff = evaluateFlightEvents(onGround, airborne, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(takeoff.events).toContainEqual(expect.objectContaining({ type: 'takeoff' }))

    // Retouche le sol 3 secondes plus tard, bien vertical (rebond) — bien en dessous du seuil.
    const bounceDown = telemetry({ onGround: true, verticalSpeed: -800, simZuluIso: '2026-08-01T12:00:04.000Z' })
    const bounce = evaluateFlightEvents(airborne, bounceDown, takeoff.nextFlags)
    expect(bounce.events.find((e) => e.type === 'landing')).toBeUndefined()
    expect(bounce.events.find((e) => e.type === 'hard_landing')).toBeUndefined()
  })

  it('restarts the clock on each new takeoff, so a real landing after a bounced departure still fires', () => {
    const onGround = telemetry({ onGround: true, simZuluIso: '2026-08-01T12:00:00.000Z' })
    const firstAirborne = telemetry({ onGround: false, simZuluIso: '2026-08-01T12:00:01.000Z' })
    const firstTakeoff = evaluateFlightEvents(onGround, firstAirborne, INITIAL_FLIGHT_EVENT_FLAGS)

    const bounceDown = telemetry({ onGround: true, simZuluIso: '2026-08-01T12:00:04.000Z' })
    const bounce = evaluateFlightEvents(firstAirborne, bounceDown, firstTakeoff.nextFlags)

    const secondAirborne = telemetry({ onGround: false, simZuluIso: '2026-08-01T12:00:06.000Z' })
    const secondTakeoff = evaluateFlightEvents(bounceDown, secondAirborne, bounce.nextFlags)
    expect(secondTakeoff.nextFlags.takeoffSimTimeIso).toBe('2026-08-01T12:00:06.000Z')

    // Un contact au sol 3s après ce second décollage doit lui aussi être ignoré (toujours un rebond).
    const secondBounceDown = telemetry({ onGround: true, simZuluIso: '2026-08-01T12:00:09.000Z' })
    const secondBounce = evaluateFlightEvents(secondAirborne, secondBounceDown, secondTakeoff.nextFlags)
    expect(secondBounce.events.find((e) => e.type === 'landing')).toBeUndefined()

    // Mais un atterrissage 30 minutes plus tard est bien le vrai atterrissage du vol.
    const stillAirborne = telemetry({ onGround: false, simZuluIso: '2026-08-01T12:30:00.000Z' })
    const realLanding = telemetry({ onGround: true, simZuluIso: '2026-08-01T12:30:05.000Z' })
    const landing = evaluateFlightEvents(stillAirborne, realLanding, secondBounce.nextFlags)
    expect(landing.events).toContainEqual(expect.objectContaining({ type: 'landing' }))
  })

  it('detects a normal landing without a hard-landing warning', () => {
    const flags = { ...INITIAL_FLIGHT_EVENT_FLAGS, wasAirborne: true }
    const previous = telemetry({ onGround: false, verticalSpeed: -200 })
    const current = telemetry({ onGround: true, verticalSpeed: -50 })
    const { events } = evaluateFlightEvents(previous, current, flags)
    expect(events).toContainEqual(expect.objectContaining({ type: 'landing' }))
    expect(events.find((e) => e.type === 'hard_landing')).toBeUndefined()
  })

  it('flags a hard landing when the pre-touchdown sink rate is steep', () => {
    const flags = { ...INITIAL_FLIGHT_EVENT_FLAGS, wasAirborne: true }
    const previous = telemetry({ onGround: false, verticalSpeed: -750 })
    const current = telemetry({ onGround: true, verticalSpeed: -100 })
    const { events } = evaluateFlightEvents(previous, current, flags)
    expect(events).toContainEqual(expect.objectContaining({ type: 'hard_landing', severity: 'warning' }))
  })

  it('does not report landing before ever having been airborne (still on the ramp)', () => {
    const previous = telemetry({ onGround: true })
    const current = telemetry({ onGround: true })
    const { events } = evaluateFlightEvents(previous, current, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(events.find((e) => e.type === 'landing')).toBeUndefined()
  })

  it('detects a flap detent change and labels it with the detent number', () => {
    const previous = telemetry({ flapsHandleIndex: 0, flapsNumHandlePositions: 4 })
    const current = telemetry({ flapsHandleIndex: 1, flapsNumHandlePositions: 4 })
    const { events } = evaluateFlightEvents(previous, current, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(events).toContainEqual(expect.objectContaining({ type: 'flaps', message: 'Volets rentrés → 1' }))
  })

  it('labels the last detent as FULL, adapting to how many detents this aircraft actually has', () => {
    // Avion à 3 crans (ex. certains jets d'affaires) : le dernier cran (index 2) doit être "FULL",
    // pas "3" — contrairement à un avion à 4 crans où l'index 2 est un cran intermédiaire.
    const threeDetentPrevious = telemetry({ flapsHandleIndex: 1, flapsNumHandlePositions: 3 })
    const threeDetentFull = telemetry({ flapsHandleIndex: 2, flapsNumHandlePositions: 3 })
    const { events: threeDetentEvents } = evaluateFlightEvents(threeDetentPrevious, threeDetentFull, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(threeDetentEvents).toContainEqual(expect.objectContaining({ type: 'flaps', message: 'Volets 1 → FULL' }))

    const fourDetentPrevious = telemetry({ flapsHandleIndex: 1, flapsNumHandlePositions: 4 })
    const fourDetentMiddle = telemetry({ flapsHandleIndex: 2, flapsNumHandlePositions: 4 })
    const { events: fourDetentEvents } = evaluateFlightEvents(fourDetentPrevious, fourDetentMiddle, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(fourDetentEvents).toContainEqual(expect.objectContaining({ type: 'flaps', message: 'Volets 1 → 2' }))
  })

  it('does not log anything while the flaps handle stays at the same detent (surface still animating)', () => {
    const previous = telemetry({ flapsHandleIndex: 2, flapsNumHandlePositions: 4, flapsPercent: 38 })
    const current = telemetry({ flapsHandleIndex: 2, flapsNumHandlePositions: 4, flapsPercent: 45 })
    const { events } = evaluateFlightEvents(previous, current, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(events.find((e) => e.type === 'flaps')).toBeUndefined()
  })

  it('falls back to the raw percentage once settled when FLAPS HANDLE INDEX never moves on this aircraft', () => {
    // Certains addons ne pilotent jamais FLAPS HANDLE INDEX même si les volets bougent réellement —
    // sans ce repli, ces avions n'auraient jamais aucun évènement volets dans le journal.
    const start = telemetry({ flapsHandleIndex: 0, flapsNumHandlePositions: 0, flapsPercent: 0 })
    const moving = telemetry({ flapsHandleIndex: 0, flapsNumHandlePositions: 0, flapsPercent: 40 })
    const first = evaluateFlightEvents(start, moving, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(first.events.find((e) => e.type === 'flaps')).toBeUndefined()

    const settled1 = evaluateFlightEvents(moving, moving, first.nextFlags)
    const settled2 = evaluateFlightEvents(moving, moving, settled1.nextFlags)
    expect(settled1.events.find((e) => e.type === 'flaps')).toBeUndefined()
    expect(settled2.events).toContainEqual(expect.objectContaining({ type: 'flaps', message: 'Volets 0% → 40%' }))
  })

  it('detects gear position changes and reports the altitude at which it happened', () => {
    const previous = telemetry({ gearHandleDown: true, altitude: 2450 })
    const current = telemetry({ gearHandleDown: false, altitude: 2500 })
    const { events } = evaluateFlightEvents(previous, current, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(events).toContainEqual(expect.objectContaining({ type: 'gear', message: 'Train rentré (2500 ft)' }))
  })

  it('warns on stable fast taxiing above 30kt', () => {
    const previous = telemetry({ onGround: true, groundVelocity: 35 })
    const current = telemetry({ onGround: true, groundVelocity: 36 })
    const { events } = evaluateFlightEvents(previous, current, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(events).toContainEqual(expect.objectContaining({ type: 'ground_overspeed' }))
  })

  it('does not warn during a sustained takeoff roll once the acceleration streak is established', () => {
    // Continuous acceleration for 5+ consecutive ticks — the signature of a real takeoff roll,
    // not a brief fast-taxi speed-up.
    let flags = INITIAL_FLIGHT_EVENT_FLAGS
    let previous = telemetry({ onGround: true, groundVelocity: 10 })
    const speeds = [16, 22, 28, 34, 40, 46] // crosses the 30kt threshold mid-roll
    let sawOverspeedAfterStreak = false
    for (const speed of speeds) {
      const current = telemetry({ onGround: true, groundVelocity: speed })
      const result = evaluateFlightEvents(previous, current, flags)
      flags = result.nextFlags
      if (flags.groundAccelStreak >= 5 && result.events.some((e) => e.type === 'ground_overspeed')) {
        sawOverspeedAfterStreak = true
      }
      previous = current
    }
    expect(sawOverspeedAfterStreak).toBe(false)
  })

  it('warns on a brief fast-taxi speed-up that never establishes a sustained acceleration streak', () => {
    // Accelerates for only 2 ticks then holds — not a takeoff roll.
    const flags1 = evaluateFlightEvents(
      telemetry({ onGround: true, groundVelocity: 20 }),
      telemetry({ onGround: true, groundVelocity: 28 }),
      INITIAL_FLIGHT_EVENT_FLAGS
    )
    const flags2 = evaluateFlightEvents(
      telemetry({ onGround: true, groundVelocity: 28 }),
      telemetry({ onGround: true, groundVelocity: 35 }),
      flags1.nextFlags
    )
    expect(flags2.nextFlags.groundAccelStreak).toBeLessThan(5)
    expect(flags2.events).toContainEqual(expect.objectContaining({ type: 'ground_overspeed' }))
  })

  it('does not warn during landing rollout deceleration, and re-arms once back to taxi speed', () => {
    let flags = { ...INITIAL_FLIGHT_EVENT_FLAGS, wasAirborne: true }
    const landing = evaluateFlightEvents(
      telemetry({ onGround: false, groundVelocity: 140 }),
      telemetry({ onGround: true, groundVelocity: 138 }),
      flags
    )
    expect(landing.events).toContainEqual(expect.objectContaining({ type: 'landing' }))
    flags = landing.nextFlags

    // Braking hard through 90kt, 60kt, 30kt — never flagged even though still above 30 for a while.
    for (const speed of [90, 60, 31]) {
      const previous = telemetry({ onGround: true, groundVelocity: speed + 20 })
      const current = telemetry({ onGround: true, groundVelocity: speed })
      const result = evaluateFlightEvents(previous, current, flags)
      expect(result.events.find((e) => e.type === 'ground_overspeed')).toBeUndefined()
      flags = result.nextFlags
    }

    // Now decelerated below 30 (rollout genuinely over) and taxis back up fast — should warn again.
    const settled = evaluateFlightEvents(telemetry({ onGround: true, groundVelocity: 31 }), telemetry({ onGround: true, groundVelocity: 25 }), flags)
    flags = settled.nextFlags
    const reaccelerate = evaluateFlightEvents(
      telemetry({ onGround: true, groundVelocity: 25 }),
      telemetry({ onGround: true, groundVelocity: 33 }),
      flags
    )
    expect(reaccelerate.events).toContainEqual(expect.objectContaining({ type: 'ground_overspeed' }))
  })

  it('warns once at the start of a ground overspeed episode, stays silent while it continues, then reports the max speed once at the end', () => {
    let flags = INITIAL_FLIGHT_EVENT_FLAGS

    const start = evaluateFlightEvents(
      telemetry({ onGround: true, groundVelocity: 35 }),
      telemetry({ onGround: true, groundVelocity: 36 }),
      flags
    )
    expect(start.events.filter((e) => e.type === 'ground_overspeed')).toHaveLength(1)
    flags = start.nextFlags

    // Speed fluctuates but stays above threshold for several ticks — must not re-fire.
    for (const speed of [38, 45, 42, 50, 47]) {
      const previous = telemetry({ onGround: true, groundVelocity: flags.groundOverspeedMaxKt })
      const current = telemetry({ onGround: true, groundVelocity: speed })
      const result = evaluateFlightEvents(previous, current, flags)
      expect(result.events.find((e) => e.type === 'ground_overspeed')).toBeUndefined()
      expect(result.events.find((e) => e.type === 'ground_overspeed_end')).toBeUndefined()
      flags = result.nextFlags
    }
    expect(flags.groundOverspeedMaxKt).toBe(50)

    // Decelerates back under the threshold — exactly one end event, reporting the peak speed.
    const end = evaluateFlightEvents(telemetry({ onGround: true, groundVelocity: 47 }), telemetry({ onGround: true, groundVelocity: 25 }), flags)
    const endEvents = end.events.filter((e) => e.type === 'ground_overspeed_end')
    expect(endEvents).toHaveLength(1)
    expect(endEvents[0].message).toContain('50')
    expect(end.nextFlags.groundOverspeedExceeded).toBe(false)
    expect(end.nextFlags.groundOverspeedMaxKt).toBe(0)
  })

  it('does not re-trigger start/end pairs when ground speed hovers right at the 30kt threshold', () => {
    // Un pilote qui roule pile à ~30kt oscille naturellement de part et d'autre du seuil —
    // sans hystérésis, chaque micro-écart redéclenchait un nouveau "début"/"fin" de survitesse.
    const speeds = [31, 29, 32, 28, 30, 29, 33]
    let flags = INITIAL_FLIGHT_EVENT_FLAGS
    let previous = telemetry({ onGround: true, groundVelocity: 29 })
    const allEvents: FlightEvent[] = []
    for (const speed of speeds) {
      const current = telemetry({ onGround: true, groundVelocity: speed })
      const result = evaluateFlightEvents(previous, current, flags)
      flags = result.nextFlags
      allEvents.push(...result.events)
      previous = current
    }
    expect(allEvents.filter((e) => e.type === 'ground_overspeed')).toHaveLength(1)
    expect(allEvents.filter((e) => e.type === 'ground_overspeed_end')).toHaveLength(0)
  })

  it('does not warn below the 30kt ground threshold', () => {
    const previous = telemetry({ onGround: true, groundVelocity: 20 })
    const current = telemetry({ onGround: true, groundVelocity: 21 })
    const { events } = evaluateFlightEvents(previous, current, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(events.find((e) => e.type === 'ground_overspeed')).toBeUndefined()
  })

  it('flags excessive bank angle once on crossing the threshold, not on every tick', () => {
    const previous = telemetry({ bankDegrees: 10 })
    const current = telemetry({ bankDegrees: 35 })
    const first = evaluateFlightEvents(previous, current, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(first.events).toContainEqual(expect.objectContaining({ type: 'bank_angle' }))

    const second = evaluateFlightEvents(current, telemetry({ bankDegrees: 36 }), first.nextFlags)
    expect(second.events.find((e) => e.type === 'bank_angle')).toBeUndefined()
  })

  it('re-arms the bank angle warning after returning under the threshold', () => {
    const steep = telemetry({ bankDegrees: 35 })
    const { nextFlags } = evaluateFlightEvents(telemetry({ bankDegrees: 10 }), steep, INITIAL_FLIGHT_EVENT_FLAGS)
    const level = telemetry({ bankDegrees: 5 })
    const { nextFlags: levelFlags } = evaluateFlightEvents(steep, level, nextFlags)
    const { events } = evaluateFlightEvents(level, telemetry({ bankDegrees: 33 }), levelFlags)
    expect(events).toContainEqual(expect.objectContaining({ type: 'bank_angle' }))
  })

  it('detects engine start and stop for a single engine', () => {
    const start = evaluateFlightEvents(
      telemetry({ engine1Running: false, enginesRunning: false }),
      telemetry({ engine1Running: true, enginesRunning: true }),
      INITIAL_FLIGHT_EVENT_FLAGS
    )
    expect(start.events).toContainEqual(expect.objectContaining({ type: 'engine_start', message: 'Moteur 1 démarré' }))

    const stop = evaluateFlightEvents(
      telemetry({ engine1Running: true, enginesRunning: true }),
      telemetry({ engine1Running: false, enginesRunning: false }),
      INITIAL_FLIGHT_EVENT_FLAGS
    )
    expect(stop.events).toContainEqual(expect.objectContaining({ type: 'engine_stop', message: 'Moteur 1 coupé' }))
  })

  it('reports each engine of a twin separately, in the order they actually start', () => {
    const bothOff = telemetry({ engine1Running: false, engine2Running: false, enginesRunning: false })
    const engine2First = telemetry({ engine1Running: false, engine2Running: true, enginesRunning: true })
    const bothRunning = telemetry({ engine1Running: true, engine2Running: true, enginesRunning: true })

    const startEngine2 = evaluateFlightEvents(bothOff, engine2First, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(startEngine2.events).toEqual([expect.objectContaining({ type: 'engine_start', message: 'Moteur 2 démarré' })])

    const startEngine1 = evaluateFlightEvents(engine2First, bothRunning, startEngine2.nextFlags)
    expect(startEngine1.events).toEqual([expect.objectContaining({ type: 'engine_start', message: 'Moteur 1 démarré' })])
  })

  it('does not emit engine events for engines that never toggle (single-engine aircraft)', () => {
    const { events } = evaluateFlightEvents(
      telemetry({ engine1Running: true, enginesRunning: true, altitude: 100 }),
      telemetry({ engine1Running: true, enginesRunning: true, altitude: 200 }),
      INITIAL_FLIGHT_EVENT_FLAGS
    )
    expect(events.filter((e) => e.type === 'engine_start' || e.type === 'engine_stop')).toHaveLength(0)
  })

  it('detects landing lights toggling (once sustained) and reports the altitude at which it happened', () => {
    const off = telemetry({ landingLightsOn: false, altitude: 1800 })
    const on = telemetry({ landingLightsOn: true, altitude: 1800 })
    const first = evaluateFlightEvents(off, on, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(first.events.find((e) => e.type === 'lights')).toBeUndefined()

    const second = evaluateFlightEvents(on, on, first.nextFlags)
    expect(second.events).toContainEqual(expect.objectContaining({ type: 'lights', message: 'Feux d’atterrissage allumés (1800 ft)' }))
  })

  it('never logs the other light circuits, even when toggled and settled (some addons cycle them automatically)', () => {
    const keys: Array<keyof SimTelemetry> = ['taxiLightsOn', 'strobeLightsOn', 'beaconLightsOn', 'navLightsOn', 'wingLightsOn', 'logoLightsOn']

    for (const key of keys) {
      const off = telemetry({ [key]: false })
      const on = telemetry({ [key]: true })
      const first = evaluateFlightEvents(off, on, INITIAL_FLIGHT_EVENT_FLAGS)
      const second = evaluateFlightEvents(on, on, first.nextFlags)
      const third = evaluateFlightEvents(on, on, second.nextFlags)
      expect([...first.events, ...second.events, ...third.events].filter((e) => e.type === 'lights')).toHaveLength(0)
    }
  })

  it('does not log a landing-lights change that only flickers for a single tick (addon glitch, animation transition)', () => {
    const off = telemetry({ landingLightsOn: false })
    const flickerOn = telemetry({ landingLightsOn: true })
    const backOff = telemetry({ landingLightsOn: false })

    const tick1 = evaluateFlightEvents(off, flickerOn, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(tick1.events.find((e) => e.type === 'lights')).toBeUndefined()

    const tick2 = evaluateFlightEvents(flickerOn, backOff, tick1.nextFlags)
    expect(tick2.events.find((e) => e.type === 'lights')).toBeUndefined()

    // Reste éteint ensuite — aucun évènement n'a jamais dû être loggé pour ce vacillement.
    const tick3 = evaluateFlightEvents(backOff, backOff, tick2.nextFlags)
    expect(tick3.events.find((e) => e.type === 'lights')).toBeUndefined()
  })

  it('logs a genuine landing-lights toggle even right after a filtered flicker', () => {
    const off = telemetry({ landingLightsOn: false })
    const flickerOn = telemetry({ landingLightsOn: true })
    const backOff = telemetry({ landingLightsOn: false })
    const onForReal = telemetry({ landingLightsOn: true })

    const tick1 = evaluateFlightEvents(off, flickerOn, INITIAL_FLIGHT_EVENT_FLAGS)
    const tick2 = evaluateFlightEvents(flickerOn, backOff, tick1.nextFlags)
    const tick3 = evaluateFlightEvents(backOff, onForReal, tick2.nextFlags)
    const tick4 = evaluateFlightEvents(onForReal, onForReal, tick3.nextFlags)

    expect(tick4.events).toContainEqual(expect.objectContaining({ type: 'lights', message: 'Feux d’atterrissage allumés (0 ft)' }))
  })

  function runTicks(
    startFlags: typeof INITIAL_FLIGHT_EVENT_FLAGS,
    telemetries: SimTelemetry[],
    plannedCruiseAltitudeFeet: number | null = null
  ) {
    let flags = startFlags
    let previous: SimTelemetry | null = null
    const allEvents: FlightEvent[] = []
    for (const current of telemetries) {
      const result = evaluateFlightEvents(previous, current, flags, plannedCruiseAltitudeFeet)
      flags = result.nextFlags
      allEvents.push(...result.events)
      previous = current
    }
    return { events: allEvents, nextFlags: flags }
  }

  it('detects reaching cruise only after leveling off is sustained for several ticks', () => {
    const climbing = telemetry({ onGround: false, altitude: 15000, verticalSpeed: 1500 })
    const levelTicks = Array.from({ length: 5 }, () => telemetry({ onGround: false, altitude: 15500, verticalSpeed: 100 }))
    const { events, nextFlags } = runTicks({ ...INITIAL_FLIGHT_EVENT_FLAGS, flightPhase: 'climb' }, [climbing, ...levelTicks])
    expect(events.filter((e) => e.type === 'cruise')).toHaveLength(1)
    expect(nextFlags.flightPhase).toBe('cruise')

    // Ne se redéclenche pas tant qu'on reste en croisière.
    const second = evaluateFlightEvents(
      levelTicks[levelTicks.length - 1],
      telemetry({ onGround: false, altitude: 15500, verticalSpeed: 50 }),
      nextFlags
    )
    expect(second.events.find((e) => e.type === 'cruise')).toBeUndefined()
  })

  it('detects the start of descent from cruise only once sustained', () => {
    const cruising = telemetry({ onGround: false, altitude: 35000, verticalSpeed: 0 })
    const descendingTicks = Array.from({ length: 5 }, () => telemetry({ onGround: false, altitude: 34500, verticalSpeed: -1200 }))
    const { events } = runTicks({ ...INITIAL_FLIGHT_EVENT_FLAGS, flightPhase: 'cruise' }, [cruising, ...descendingTicks])
    expect(events.filter((e) => e.type === 'descent')).toHaveLength(1)
  })

  it('does not repeat cruise/descent events when vertical speed oscillates briefly around the threshold', () => {
    // A single tick dipping into "descent" territory then bouncing straight back to level —
    // turbulence/autopilot noise, not a real descent. Must not flip the phase or fire anything.
    const cruising = telemetry({ onGround: false, altitude: 35000, verticalSpeed: 0 })
    const blip = telemetry({ onGround: false, altitude: 34950, verticalSpeed: -600 })
    const backToLevel = telemetry({ onGround: false, altitude: 35000, verticalSpeed: 50 })
    const { events } = runTicks({ ...INITIAL_FLIGHT_EVENT_FLAGS, flightPhase: 'cruise' }, [
      cruising,
      blip,
      backToLevel,
      backToLevel,
      backToLevel
    ])
    expect(events.filter((e) => e.type === 'descent')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'cruise')).toHaveLength(0)
  })

  it('does not report cruise/altitude_level at a temporary ATC step level below the planned cruise altitude', () => {
    // Vol vers FL310 (SimBrief) mais bridé à FL110 en attente d'une clairance — un palier ATC
    // classique en montée, pas la croisière.
    const climbing = telemetry({ onGround: false, altitude: 10800, verticalSpeed: 1500 })
    const levelTicks = Array.from({ length: 6 }, () => telemetry({ onGround: false, altitude: 11200, verticalSpeed: 50 }))
    const { events, nextFlags } = runTicks({ ...INITIAL_FLIGHT_EVENT_FLAGS, flightPhase: 'climb' }, [climbing, ...levelTicks], 31_000)
    expect(events.filter((e) => e.type === 'cruise')).toHaveLength(0)
    expect(events.filter((e) => e.type === 'altitude_level')).toHaveLength(0)
    expect(nextFlags.flightPhase).toBe('climb')
  })

  it('reports cruise once the level-off is near the planned cruise altitude', () => {
    const climbing = telemetry({ onGround: false, altitude: 30600, verticalSpeed: 1200 })
    const levelTicks = Array.from({ length: 6 }, () => telemetry({ onGround: false, altitude: 31000, verticalSpeed: 30 }))
    const { events, nextFlags } = runTicks({ ...INITIAL_FLIGHT_EVENT_FLAGS, flightPhase: 'climb' }, [climbing, ...levelTicks], 31_000)
    expect(events.filter((e) => e.type === 'cruise')).toHaveLength(1)
    expect(events).toContainEqual(expect.objectContaining({ type: 'altitude_level', message: 'Palier atteint : FL310' }))
    expect(nextFlags.flightPhase).toBe('cruise')
  })

  it('logs an altitude_level event on first leveling off, with the FL in the message', () => {
    const climbing = telemetry({ onGround: false, altitude: 33900, verticalSpeed: 1200 })
    const leveled = telemetry({ onGround: false, altitude: 34000, verticalSpeed: 50 })
    const { events, nextFlags } = evaluateFlightEvents(climbing, leveled, {
      ...INITIAL_FLIGHT_EVENT_FLAGS,
      flightPhase: 'climb'
    })
    expect(events).toContainEqual(expect.objectContaining({ type: 'altitude_level', message: 'Palier atteint : FL340' }))
    expect(nextFlags.levelAltitudeFeet).toBe(34000)
  })

  it('does not re-log the same level on minor altitude-hold fluctuations', () => {
    const flags = { ...INITIAL_FLIGHT_EVENT_FLAGS, flightPhase: 'cruise' as const, levelAltitudeFeet: 34000 }
    const { events } = evaluateFlightEvents(
      telemetry({ onGround: false, altitude: 34000, verticalSpeed: 0 }),
      telemetry({ onGround: false, altitude: 34150, verticalSpeed: 30 }),
      flags
    )
    expect(events.find((e) => e.type === 'altitude_level')).toBeUndefined()
  })

  it('logs a new altitude_level event on a genuine step climb during cruise', () => {
    const flags = { ...INITIAL_FLIGHT_EVENT_FLAGS, flightPhase: 'cruise' as const, levelAltitudeFeet: 34000 }
    const climbingStep = telemetry({ onGround: false, altitude: 35800, verticalSpeed: 800 })
    const newLevel = telemetry({ onGround: false, altitude: 36000, verticalSpeed: 20 })
    const { events, nextFlags } = evaluateFlightEvents(climbingStep, newLevel, flags)
    expect(events).toContainEqual(expect.objectContaining({ type: 'altitude_level', message: 'Palier atteint : FL360' }))
    expect(nextFlags.levelAltitudeFeet).toBe(36000)
  })

  it('flags air overspeed below 10 000ft and reports the max speed reached on recovery', () => {
    const previous = telemetry({ onGround: false, altitude: 5000, airspeedIndicated: 240 })
    const overspeed = telemetry({ onGround: false, altitude: 5000, airspeedIndicated: 260 })
    const first = evaluateFlightEvents(previous, overspeed, INITIAL_FLIGHT_EVENT_FLAGS)
    expect(first.events).toContainEqual(expect.objectContaining({ type: 'air_overspeed' }))

    const evenFaster = telemetry({ onGround: false, altitude: 5000, airspeedIndicated: 280 })
    const second = evaluateFlightEvents(overspeed, evenFaster, first.nextFlags)
    expect(second.events.find((e) => e.type === 'air_overspeed')).toBeUndefined()
    expect(second.nextFlags.airOverspeedMaxKt).toBe(280)

    const recovered = telemetry({ onGround: false, altitude: 5000, airspeedIndicated: 240 })
    const third = evaluateFlightEvents(evenFaster, recovered, second.nextFlags)
    expect(third.events).toContainEqual(
      expect.objectContaining({ type: 'air_overspeed_end', message: expect.stringContaining('280') })
    )
  })

  it('does not flag anything while a pilot holding ~250kt drifts a few knots either side (tolerance band)', () => {
    // Tenir "250" par imprécision normale de commande/instrument oscille de quelques nœuds — se
    // faire signaler une survitesse en étant pile à la limite n'a pas de sens opérationnel.
    const speeds = [251, 248, 252, 247, 250, 249, 253]
    let flags = INITIAL_FLIGHT_EVENT_FLAGS
    let previous = telemetry({ onGround: false, altitude: 5000, airspeedIndicated: 248 })
    const allEvents: FlightEvent[] = []
    for (const speed of speeds) {
      const current = telemetry({ onGround: false, altitude: 5000, airspeedIndicated: speed })
      const result = evaluateFlightEvents(previous, current, flags)
      flags = result.nextFlags
      allEvents.push(...result.events)
      previous = current
    }
    expect(allEvents.filter((e) => e.type === 'air_overspeed')).toHaveLength(0)
    expect(allEvents.filter((e) => e.type === 'air_overspeed_end')).toHaveLength(0)
  })

  it('does not re-trigger start/end pairs when a genuine excursion then hovers in the hysteresis band', () => {
    // Un vrai dépassement (258kt, au-delà de la marge de tolérance) puis une vitesse qui oscille
    // dans la bande d'hystérésis (248-255) ne doit produire qu'un seul début, pas de fin tant que
    // ça ne redescend pas vraiment sous 248.
    const speeds = [258, 250, 254, 249, 253]
    let flags = INITIAL_FLIGHT_EVENT_FLAGS
    let previous = telemetry({ onGround: false, altitude: 5000, airspeedIndicated: 248 })
    const allEvents: FlightEvent[] = []
    for (const speed of speeds) {
      const current = telemetry({ onGround: false, altitude: 5000, airspeedIndicated: speed })
      const result = evaluateFlightEvents(previous, current, flags)
      flags = result.nextFlags
      allEvents.push(...result.events)
      previous = current
    }
    expect(allEvents.filter((e) => e.type === 'air_overspeed')).toHaveLength(1)
    expect(allEvents.filter((e) => e.type === 'air_overspeed_end')).toHaveLength(0)
  })

  it('does not flag air overspeed above 10 000ft or on the ground', () => {
    const high = evaluateFlightEvents(
      telemetry({ onGround: false, altitude: 20000, airspeedIndicated: 300 }),
      telemetry({ onGround: false, altitude: 20000, airspeedIndicated: 300 }),
      INITIAL_FLIGHT_EVENT_FLAGS
    )
    expect(high.events.find((e) => e.type === 'air_overspeed')).toBeUndefined()

    const ground = evaluateFlightEvents(
      telemetry({ onGround: true, altitude: 0, airspeedIndicated: 300 }),
      telemetry({ onGround: true, altitude: 0, airspeedIndicated: 300 }),
      INITIAL_FLIGHT_EVENT_FLAGS
    )
    expect(ground.events.find((e) => e.type === 'air_overspeed')).toBeUndefined()
  })
})
