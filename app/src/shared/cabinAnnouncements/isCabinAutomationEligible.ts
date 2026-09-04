interface CabinAutomationEligibilityInput {
  armedFlightId: number | null
  activeFlightId: number | null
  simconnectConnected: boolean
  simulationActive: boolean
}

/** Les annonces automatiques exigent à la fois un vol explicitement armé dans FlightOps et une
 * session de vol réellement active dans MSFS. Une simple connexion SimConnect depuis les menus ne
 * suffit volontairement pas. */
export function isCabinAutomationEligible(input: CabinAutomationEligibilityInput): boolean {
  return input.armedFlightId !== null
    && input.activeFlightId === input.armedFlightId
    && input.simconnectConnected
    && input.simulationActive
}
