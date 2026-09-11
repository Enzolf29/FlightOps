import { useEffect, useMemo, useState } from 'react'
import { useRoutePrice } from '@renderer/hooks/useEconomy'
import { resolveBookingEconomy, type BookingEconomyResolution } from '@renderer/economy/resolveBookingEconomy'
import type { PricingTier } from '@shared/types/economy'

interface EconomyBookingPanelProps {
  companyId: number | null
  pricingTier: PricingTier | null
  departureIcao: string
  arrivalIcao: string
  seatCapacity: number | null
  cargoCapacityKg: number | null
  /** Résolution actuellement applicable (null si mode économie désactivé pour ce vol, ou ligne sans prix). */
  onResolutionChange: (resolution: BookingEconomyResolution | null) => void
}

function formatEur(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export function EconomyBookingPanel({
  companyId,
  pricingTier,
  departureIcao,
  arrivalIcao,
  seatCapacity,
  cargoCapacityKg,
  onResolutionChange
}: EconomyBookingPanelProps) {
  const ready = companyId !== null && pricingTier !== null && seatCapacity !== null && cargoCapacityKg !== null
  const { data: routePrice } = useRoutePrice(companyId, departureIcao, arrivalIcao, ready)
  const [enabled, setEnabled] = useState(true)

  // Figé une fois calculé (dépendance sur l'id de la ligne, pas sur les valeurs à chaque rendu) :
  // le prix réellement tiré au sort ne doit pas changer à chaque re-rendu du formulaire.
  const resolution = useMemo<BookingEconomyResolution | null>(() => {
    if (!routePrice || !pricingTier || seatCapacity === null || cargoCapacityKg === null) return null
    return resolveBookingEconomy(routePrice, pricingTier, seatCapacity, cargoCapacityKg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePrice?.id])

  useEffect(() => {
    onResolutionChange(enabled ? resolution : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resolution])

  useEffect(() => {
    setEnabled(true)
  }, [routePrice?.id])

  if (!routePrice || !resolution) return null

  return (
    <div className="economy-booking-panel">
      <label className="economy-booking-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span>Mode économie pour ce vol</span>
      </label>
      {enabled ? (
        <div className="economy-booking-preview">
          <span>
            Billet {formatEur(resolution.economyInput.ticketPriceEur)}
            <small> (référence {formatEur(resolution.economyInput.referenceTicketPriceEur)})</small>
          </span>
          <span>≈ {resolution.expectedPassengers} passagers attendus</span>
          <span>
            Fret {formatEur(resolution.economyInput.cargoPriceEurPerKg)}/kg · ≈{' '}
            {Math.round(resolution.expectedCargoKg).toLocaleString('fr-FR')} kg attendus
          </span>
        </div>
      ) : null}
    </div>
  )
}
