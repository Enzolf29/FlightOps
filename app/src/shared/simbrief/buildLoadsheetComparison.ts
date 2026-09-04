import type { OfpLoadsheet } from './parseOfpDetail'
import type { CabinLoadsheetSnapshot, LoadsheetComparisonRow, LoadsheetValueSource } from '../types/loadsheet'

const POUNDS_PER_KILOGRAM = 2.2046226218

export function toKilograms(value: number | null, units: OfpLoadsheet['units']): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return units === 'lbs' ? value / POUNDS_PER_KILOGRAM : value
}

function usable(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Certains avions complexes conservent le chargement dans leur propre système sans l'injecter
 * dans les stations de charge MSFS. Dans ce cas TOTAL WEIGHT et FUEL TOTAL QUANTITY WEIGHT restent
 * numériquement valides, mais leur différence avec EMPTY WEIGHT donne une charge utile presque
 * nulle (cas observé sur le Synaptic A220). On ne doit surtout pas présenter ce résultat comme une
 * masse réelle.
 */
function areSimulatorMassesCoherent(
  total: number | null,
  empty: number | null,
  fuel: number | null,
  plannedPayload: number | null
): boolean {
  if (total === null || empty === null || fuel === null || total <= empty + fuel) return false
  if (plannedPayload === null || plannedPayload < 500) return true

  const simulatorPayload = total - empty - fuel
  return simulatorPayload >= plannedPayload * 0.4 && simulatorPayload <= plannedPayload * 1.8
}

function finalValue(
  actual: number | null,
  fallback: number | null,
  actualSource: LoadsheetValueSource,
  isFinal: boolean
): Pick<LoadsheetComparisonRow, 'final' | 'source'> {
  if (!isFinal) return { final: null, source: 'pending' }
  if (actual !== null) return { final: actual, source: actualSource }
  return { final: fallback, source: 'simbrief_fallback' }
}

/**
 * Produit la comparaison affichée sur la feuille de chargement. Les valeurs MSFS/GSX sont
 * prioritaires après la fin de l'embarquement ; les informations que le simulateur ne publie pas
 * de façon fiable restent celles de SimBrief et sont explicitement marquées comme telles.
 */
export function buildLoadsheetComparison(
  loadsheet: OfpLoadsheet,
  snapshot: CabinLoadsheetSnapshot | null
): LoadsheetComparisonRow[] {
  const kg = (value: number | null) => toKilograms(value, loadsheet.units)
  const isFinal = snapshot !== null
  const rawTotal = usable(snapshot?.totalWeightKg)
  const empty = usable(snapshot?.emptyWeightKg)
  const rawFuel = usable(snapshot?.fuelWeightKg)
  const plannedPayload = kg(loadsheet.payload)
  const simulatorMassesCoherent = areSimulatorMassesCoherent(rawTotal, empty, rawFuel, plannedPayload)
  // Si le modèle de vol ne publie pas son chargement interne à MSFS, toutes les masses qui en
  // dépendent retombent explicitement sur SimBrief (source "SIMBRIEF *") plutôt que d'afficher un
  // faux résultat calculé à partir de valeurs pourtant positives.
  const total = simulatorMassesCoherent ? rawTotal : null
  const fuel = simulatorMassesCoherent ? rawFuel : null
  const payload = total !== null && empty !== null && fuel !== null ? Math.max(0, total - empty - fuel) : null
  const zeroFuel = total !== null && fuel !== null ? Math.max(0, total - fuel) : null
  const taxiFuel = kg(loadsheet.fuelTaxi)
  const takeoffWeight = total !== null && taxiFuel !== null ? Math.max(0, total - taxiFuel) : null
  const takeoffFuel = fuel !== null && taxiFuel !== null ? Math.max(0, fuel - taxiFuel) : null
  const gsxPassengers = usable(snapshot?.passengersBoarded) ?? usable(snapshot?.passengersTarget)

  const row = (
    key: string,
    label: string,
    section: LoadsheetComparisonRow['section'],
    planned: number | null,
    actual: number | null,
    limit: number | null,
    unit: LoadsheetComparisonRow['unit'],
    actualSource: LoadsheetValueSource
  ): LoadsheetComparisonRow => ({
    key,
    label,
    section,
    planned,
    limit,
    unit,
    ...finalValue(actual, planned, actualSource, isFinal)
  })

  return [
    row('pax', 'PASSENGERS', 'load', loadsheet.paxCount, gsxPassengers, null, 'pax', 'gsx'),
    row('cargo', 'FRET', 'load', kg(loadsheet.cargo), null, null, 'kg', 'simulator'),
    row('payload', 'CHARGE UTILE', 'load', plannedPayload, payload, null, 'kg', 'calculated'),
    row('zfw', 'ZERO FUEL WEIGHT', 'load', kg(loadsheet.estZfw), zeroFuel, usable(snapshot?.maxZeroFuelWeightKg) ?? kg(loadsheet.maxZfw), 'kg', 'calculated'),
    row('ramp', 'RAMP WEIGHT', 'load', kg(loadsheet.estRamp), total, usable(snapshot?.maxGrossWeightKg), 'kg', 'simulator'),
    row('tow', 'TAKEOFF WEIGHT', 'load', kg(loadsheet.estTow), takeoffWeight, usable(snapshot?.maxTakeoffWeightKg) ?? kg(loadsheet.maxTow), 'kg', 'calculated'),
    row('ldw', 'LANDING WEIGHT', 'load', kg(loadsheet.estLdw), null, usable(snapshot?.maxLandingWeightKg) ?? kg(loadsheet.maxLdw), 'kg', 'simulator'),
    row('blockFuel', 'BLOCK FUEL', 'fuel', kg(loadsheet.fuelRamp), fuel, null, 'kg', 'simulator'),
    row('takeoffFuel', 'TAKEOFF FUEL', 'fuel', kg(loadsheet.fuelTakeoff), takeoffFuel, null, 'kg', 'calculated'),
    row('landingFuel', 'LANDING FUEL', 'fuel', kg(loadsheet.fuelLanding), null, null, 'kg', 'simulator'),
    row('reserve', 'RESERVE', 'fuel', kg(loadsheet.fuelReserve), null, null, 'kg', 'simulator'),
    row('extra', 'EXTRA', 'fuel', kg(loadsheet.fuelExtra), null, null, 'kg', 'simulator')
  ]
}
