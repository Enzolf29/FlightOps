import { useEffect, useMemo, useState } from 'react'
import { useCompanies } from '@renderer/hooks/useCompanies'
import {
  useAirportSurcharge,
  useCompanyEconomySummary,
  useDeleteRoutePrice,
  useRouteGsxCostHint,
  useRoutePricesForCompany,
  useUpsertRoutePrice
} from '@renderer/hooks/useEconomy'
import { CompanyPicker } from '@renderer/components/CompanyPicker'
import { StatGrid } from '@renderer/components/StatGrid'
import { RoutePriceForm } from '@renderer/components/RoutePriceForm'
import { EconomyRouteMap, economyRoutePairKey } from '@renderer/components/EconomyRouteMap'
import { formatEur } from '@renderer/lib/format'
import { getAirportLabel } from '@shared/airports/airportNames'
import { getAirportCoordinates } from '@shared/airports/airportCoordinates'
import { greatCircleDistanceNm } from '@shared/flightStatus/computeFlightDistanceProgress'
import { computeReferenceTicketPriceEur } from '@shared/economy/resolveFlightEconomy'
import { PRICING_TIER_LABEL, PRICING_TIER_FARE_MODEL } from '@shared/types/economy'
import type { RoutePrice } from '@shared/types/economy'

function referenceTicketPriceEur(
  company: { pricingTier: keyof typeof PRICING_TIER_FARE_MODEL },
  routePrice: RoutePrice,
  airportSurchargeFraction: number
): number | null {
  const origin = getAirportCoordinates(routePrice.departureIcao)
  const dest = getAirportCoordinates(routePrice.arrivalIcao)
  if (!origin || !dest) return null
  const distanceNm = greatCircleDistanceNm(origin.lat, origin.lon, dest.lat, dest.lon)
  return computeReferenceTicketPriceEur(PRICING_TIER_FARE_MODEL[company.pricingTier], distanceNm) * (1 + airportSurchargeFraction)
}

export function EconomyPage() {
  const { data: companies } = useCompanies()
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RoutePrice | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [selectedPairKey, setSelectedPairKey] = useState<string | null>(null)

  const selectedCompany = companies?.find((company) => company.id === companyId) ?? null
  const { data: routePrices } = useRoutePricesForCompany(companyId)
  const { data: summary } = useCompanyEconomySummary(companyId)
  const upsertMutation = useUpsertRoutePrice()
  const deleteMutation = useDeleteRoutePrice()

  useEffect(() => {
    setSelectedPairKey(null)
  }, [companyId])

  const displayedRoutePrices = useMemo(() => {
    if (!routePrices) return []
    if (!selectedPairKey) return routePrices
    return routePrices.filter(
      (routePrice) => economyRoutePairKey(routePrice.departureIcao, routePrice.arrivalIcao) === selectedPairKey
    )
  }, [routePrices, selectedPairKey])

  function openCreate() {
    setEditing(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(routePrice: RoutePrice) {
    setEditing(routePrice)
    setFormError(null)
    setFormOpen(true)
  }

  function handleSubmit(input: Parameters<typeof upsertMutation.mutateAsync>[0]) {
    setFormError(null)
    upsertMutation
      .mutateAsync(input)
      .then(() => setFormOpen(false))
      .catch((error: Error) => setFormError(error.message))
  }

  function handleDelete(id: number) {
    deleteMutation.mutateAsync(id).then(() => setDeletingId(null))
  }

  return (
    <div className="fleet-page">
      <h1>Économie</h1>
      <p className="fleet-companies-hint">
        Fixe un prix (fourchette) par ligne pour les vols réservés depuis « Créer un plan » ou « Vols réels ».
        Au-dessus du prix de référence — fixe, basé sur le positionnement de la compagnie — la demande baisse.
      </p>

      {companies ? (
        <div className="form-field economy-company-field">
          <span>Compagnie</span>
          <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />
        </div>
      ) : null}

      {selectedCompany ? (
        <>
          <div className="economy-summary-field">
            <StatGrid
              compact
              items={[
                { key: 'tier', label: 'Positionnement', value: PRICING_TIER_LABEL[selectedCompany.pricingTier] },
                { key: 'revenue', label: 'Revenu total', value: summary ? formatEur(summary.totalRevenueEur) : '—' },
                { key: 'cost', label: 'Coût GSX total', value: summary ? formatEur(summary.totalCostEur) : '—' },
                {
                  key: 'profit',
                  label: 'Bénéfice',
                  value: summary && summary.flightsWithData > 0 ? formatEur(summary.profitEur) : '—',
                  detail: summary && summary.flightsWithData > 0 ? `Sur ${summary.flightsWithData} vol${summary.flightsWithData > 1 ? 's' : ''}` : undefined
                }
              ]}
            />
          </div>

          <div className="fleet-toolbar">
            <button type="button" className="primary" onClick={openCreate}>
              + Ajouter une ligne
            </button>
          </div>

          {routePrices && routePrices.length > 0 ? (
            <div className="economy-map-field">
              <EconomyRouteMap
                routePrices={routePrices}
                selectedPairKey={selectedPairKey}
                onSelectPair={setSelectedPairKey}
              />
            </div>
          ) : null}

          {!routePrices || routePrices.length === 0 ? (
            <p className="empty-hint">Aucune ligne tarifée pour cette compagnie — le mode économie reste désactivé sur tous ses vols.</p>
          ) : (
            <div className="fleet-table economy-route-table">
              {selectedPairKey ? (
                <p className="form-hint economy-filter-hint">
                  Aller-retour {selectedPairKey.replace('-', ' ↔ ')} uniquement.{' '}
                  <button type="button" className="settings-link" onClick={() => setSelectedPairKey(null)}>
                    Voir toutes les lignes
                  </button>
                </p>
              ) : null}
              <div className="fleet-table-header economy-route-row">
                <span>Ligne</span>
                <span>Prix billet</span>
                <span>Réf. billet</span>
                <span>Prix fret</span>
                <span>Coût GSX moyen</span>
                <span></span>
              </div>
              {displayedRoutePrices.map((routePrice) => (
                <RoutePriceRow
                  key={routePrice.id}
                  company={selectedCompany}
                  routePrice={routePrice}
                  onEdit={() => openEdit(routePrice)}
                  onDelete={() => setDeletingId(routePrice.id)}
                  confirmingDelete={deletingId === routePrice.id}
                  onConfirmDelete={() => handleDelete(routePrice.id)}
                  onCancelDelete={() => setDeletingId(null)}
                  deleting={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="empty-hint">Choisissez une compagnie pour voir ou fixer ses tarifs.</p>
      )}

      {formOpen && selectedCompany ? (
        <RoutePriceForm
          companyId={selectedCompany.id}
          initial={editing}
          onSubmit={handleSubmit}
          onClose={() => setFormOpen(false)}
          submitting={upsertMutation.isPending}
          errorMessage={formError}
        />
      ) : null}
    </div>
  )
}

interface RoutePriceRowProps {
  company: { pricingTier: keyof typeof PRICING_TIER_FARE_MODEL; id: number }
  routePrice: RoutePrice
  onEdit: () => void
  onDelete: () => void
  confirmingDelete: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
  deleting: boolean
}

function RoutePriceRow({
  company,
  routePrice,
  onEdit,
  onDelete,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  deleting
}: RoutePriceRowProps) {
  const { data: gsxHint } = useRouteGsxCostHint(company.id, routePrice.departureIcao, routePrice.arrivalIcao, true)
  const { data: airportSurcharge } = useAirportSurcharge(company.id, routePrice.departureIcao, true)
  const referencePrice =
    airportSurcharge !== undefined ? referenceTicketPriceEur(company, routePrice, airportSurcharge) : null

  return (
    <div className="fleet-table-row economy-route-row">
      <span>
        {getAirportLabel(routePrice.departureIcao)} → {getAirportLabel(routePrice.arrivalIcao)}
      </span>
      <span>
        {formatEur(routePrice.ticketPriceMinEur)} – {formatEur(routePrice.ticketPriceMaxEur)}
      </span>
      <span className="text-muted">{referencePrice !== null ? formatEur(referencePrice) : '—'}</span>
      <span>
        {formatEur(routePrice.cargoPriceMinEurPerKg)} – {formatEur(routePrice.cargoPriceMaxEurPerKg)}/kg
      </span>
      <span className="text-muted">
        {gsxHint && gsxHint.averageGsxCostEur !== null
          ? `${formatEur(gsxHint.averageGsxCostEur)} (${gsxHint.flightsFlown} vol${gsxHint.flightsFlown > 1 ? 's' : ''})`
          : 'Jamais volée'}
      </span>
      <span className="fleet-table-actions">
        {confirmingDelete ? (
          <>
            <button type="button" className="danger" onClick={onConfirmDelete} disabled={deleting}>
              Confirmer
            </button>
            <button type="button" onClick={onCancelDelete}>
              Annuler
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit}>
              Modifier
            </button>
            <button type="button" onClick={onDelete}>
              Supprimer
            </button>
          </>
        )}
      </span>
    </div>
  )
}
