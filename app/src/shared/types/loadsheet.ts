export interface CabinLoadsheetSnapshot {
  capturedAt: string
  captureSource: 'gsx' | 'aircraft_mass'
  passengersTarget: number | null
  passengersBoarded: number | null
  cargoBoardingPercent: number | null
  totalWeightKg: number | null
  emptyWeightKg: number | null
  fuelWeightKg: number | null
  maxGrossWeightKg: number | null
  maxZeroFuelWeightKg: number | null
  maxTakeoffWeightKg: number | null
  maxLandingWeightKg: number | null
}

export type LoadsheetValueSource =
  | 'simbrief'
  | 'simulator'
  | 'gsx'
  | 'calculated'
  | 'simbrief_fallback'
  | 'pending'

export interface LoadsheetComparisonRow {
  key: string
  label: string
  section: 'load' | 'fuel'
  planned: number | null
  final: number | null
  limit: number | null
  unit: 'kg' | 'pax'
  source: LoadsheetValueSource
}
