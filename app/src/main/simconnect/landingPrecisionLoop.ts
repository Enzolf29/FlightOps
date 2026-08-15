import { SimConnectConstants, SimConnectDataType, SimConnectPeriod } from 'node-simconnect'
import type { SimConnectConnection, RecvSimObjectData } from 'node-simconnect'

const DEFINITION_LANDING = 1
const REQUEST_LANDING = 1

export interface LandingPrecisionSample {
  onGround: boolean
  verticalSpeed: number
  gForce: number
  pitchDegrees: number
  bankDegrees: number
  airspeedKt: number
}

export type LandingPrecisionListener = (sample: LandingPrecisionSample) => void

/**
 * Flux SimConnect à la fréquence de simulation (bien plus rapide que la télémétrie 1Hz), utilisé
 * uniquement pour capter précisément les valeurs au moment exact du toucher des roues — un
 * échantillonnage à 1Hz peut manquer le pic de vitesse verticale/G de plusieurs dixièmes de seconde.
 */
export function startLandingPrecisionLoop(handle: SimConnectConnection, onTick: LandingPrecisionListener): () => void {
  handle.addToDataDefinition(DEFINITION_LANDING, 'SIM ON GROUND', 'bool', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_LANDING, 'VERTICAL SPEED', 'feet per minute', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_LANDING, 'G FORCE', 'GForce', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_LANDING, 'PLANE PITCH DEGREES', 'degrees', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_LANDING, 'PLANE BANK DEGREES', 'degrees', SimConnectDataType.FLOAT64)
  handle.addToDataDefinition(DEFINITION_LANDING, 'AIRSPEED INDICATED', 'knots', SimConnectDataType.FLOAT64)

  handle.requestDataOnSimObject(
    REQUEST_LANDING,
    DEFINITION_LANDING,
    SimConnectConstants.OBJECT_ID_USER,
    SimConnectPeriod.SIM_FRAME
  )

  function handleSimObjectData(recv: RecvSimObjectData): void {
    if (recv.requestID !== REQUEST_LANDING) return

    const data = recv.data
    const onGround = data.readFloat64() >= 0.5
    const verticalSpeed = data.readFloat64()
    const gForce = data.readFloat64()
    const pitchDegrees = data.readFloat64()
    const bankDegrees = data.readFloat64()
    const airspeedKt = data.readFloat64()

    onTick({ onGround, verticalSpeed, gForce, pitchDegrees, bankDegrees, airspeedKt })
  }

  handle.on('simObjectData', handleSimObjectData)

  return () => {
    handle.removeListener('simObjectData', handleSimObjectData)
  }
}
