import { describe, expect, it } from 'vitest'
import { isCabinAutomationEligible } from './isCabinAutomationEligible'

const ready = {
  armedFlightId: 12,
  activeFlightId: 12,
  simconnectConnected: true,
  simulationActive: true
}

describe('isCabinAutomationEligible', () => {
  it('accepts an explicitly armed flight in a loaded MSFS session', () => {
    expect(isCabinAutomationEligible(ready)).toBe(true)
  })

  it('rejects an old in-progress flight that is not armed', () => {
    expect(isCabinAutomationEligible({ ...ready, armedFlightId: null })).toBe(false)
  })

  it('rejects the MSFS menus even while SimConnect is connected', () => {
    expect(isCabinAutomationEligible({ ...ready, simulationActive: false })).toBe(false)
  })

  it('rejects telemetry belonging to another selected flight', () => {
    expect(isCabinAutomationEligible({ ...ready, activeFlightId: 99 })).toBe(false)
  })
})
