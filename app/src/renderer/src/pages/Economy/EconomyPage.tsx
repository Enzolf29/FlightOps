import { useEffect, useMemo, useState } from 'react'
import { useCompanies, useUpdateCompany } from '@renderer/hooks/useCompanies'
import {
  useAirportSurcharge,
  useCompanyEconomySummary,
  useDeleteRoutePrice,
  useRouteGsxCostHint,
  useRoutePricesForCompany,
  useRouteSurcharge,
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
import type { Company } from '@shared/types/company'

function referenceTicketPriceEur(
  company: { pricingTier: keyof typeof PRICING_TIER_FARE_MODEL },
  routePrice: RoutePrice,
  airportSurchargeFraction: number,
  routeSurchargeFraction: number
): number | null {
  const origin = getAirportCoordinates(routePrice.departureIcao)
  const dest = getAirportCoordinates(routePrice.arrivalIcao)
  if (!origin || !dest) return null
  const distanceNm = greatCircleDistanceNm(origin.lat, origin.lon, dest.lat, dest.lon)
  return (
    computeReferenceTicketPriceEur(PRICING_TIER_FARE_MODEL[company.pricingTier], distanceNm) *
    (1 + airportSurchargeFraction + routeSurchargeFraction)
  )
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

          <BaggagePriceField company={selectedCompany} />

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
                <span>Surtaxes</span>
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

function BaggagePriceField({ company }: { company: Company }) {
  const updateMutation = useUpdateCompany()
  const [value, setValue] = useState(company.baggagePriceEur)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(company.baggagePriceEur)
  }, [company.id, company.baggagePriceEur])

  function handleSave() {
    setSaved(false)
    updateMutation.mutateAsync({ id: company.id, patch: { baggagePriceEur: value } }).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="economy-baggage-field">
      <p>Prix d'un bagage en soute pour {company.displayName} — appliqué à tous ses vols.</p>
      <div className="settings-inline-field">
        <input
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
        />
        <button type="button" className="primary" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved ? <span className="settings-saved-hint">Enregistré ✓</span> : null}
      </div>
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
  const { data: routeSurcharge } = useRouteSurcharge(company.id, routePrice.departureIcao, routePrice.arrivalIcao, true)
  const referencePrice =
    airportSurcharge !== undefined && routeSurcharge !== undefined
      ? referenceTicketPriceEur(company, routePrice, airportSurcharge, routeSurcharge)
      : null

  return (
    <div className="fleet-table-row economy-route-row">
      <span>
        {getAirportLabel(routePrice.departureIcao)} → {getAirportLabel(routePrice.arrivalIcao)}
      </span>
      <span>
        {formatEur(routePrice.ticketPriceMinEur)} – {formatEur(routePrice.ticketPriceMaxEur)}
      </span>
      <span className="text-muted">{referencePrice !== null ? formatEur(referencePrice) : '—'}</span>
      <span className="economy-surcharge-detail text-muted">
        {airportSurcharge ? <span>Aéroport +{Math.round(airportSurcharge * 100)}%</span> : null}
        {routeSurcharge ? <span>Ligne +{Math.round(routeSurcharge * 100)}%</span> : null}
        {!airportSurcharge && !routeSurcharge ? '—' : null}
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
