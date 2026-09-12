import { useEffect, useMemo, useState } from 'react'
import type { SimbriefOfp } from '@shared/types/simbrief'
import type { Company } from '@shared/types/company'
import type { AircraftWithStats } from '@shared/types/aircraft'
import type { FlightWithRelations, FlightSource } from '@shared/types/flight'
import { useAircraft } from '@renderer/hooks/useAircraft'
import { useCreateBookingFromOfp } from '@renderer/hooks/useBooking'
import { useRoutePrice } from '@renderer/hooks/useEconomy'
import { useEconomyBookingStore } from '@renderer/stores/economyBookingStore'
import { CompanyLogo } from '@renderer/components/CompanyLogo'
import { getAirportLabel } from '@shared/airports/airportNames'
import { formatDateTime } from '@renderer/lib/format'

interface OfpImportPreviewProps {
  ofp: SimbriefOfp
  companies: Company[]
  source: FlightSource
  onCreated: (flight: FlightWithRelations) => void
}

interface Resolution {
  company: Company
  aircraft: AircraftWithStats
  flightNumberDigits: string
  callsign: string
}

function resolveImport(
  ofp: SimbriefOfp,
  companies: Company[],
  allAircraft: AircraftWithStats[]
): { ok: true; data: Resolution } | { ok: false; reason: string } {
  const company = companies.find((item) => item.icaoCode === ofp.icaoAirline)
  if (!company) {
    return {
      ok: false,
      reason: `Compagnie SimBrief "${ofp.icaoAirline ?? 'non renseignée'}" introuvable parmi vos compagnies.`
    }
  }

  if (!ofp.aircraftIcaoType) {
    return { ok: false, reason: "Aucun type d'avion renseigné dans le plan SimBrief." }
  }

  const aircraft = allAircraft.find(
    (item) => item.companyId === company.id && item.simbriefIcaoCode === ofp.aircraftIcaoType
  )
  if (!aircraft) {
    return {
      ok: false,
      reason: `Aucun avion de type ${ofp.aircraftIcaoType} dans la flotte ${company.displayName}. Ajoutez-le dans Flotte (avec le bon code OACI SimBrief) avant d'importer.`
    }
  }

  if (!ofp.flightNumberDigits) {
    return { ok: false, reason: "Aucun numéro de vol renseigné dans le plan SimBrief." }
  }

  if (!ofp.callsign) {
    return { ok: false, reason: "Aucun callsign ATC renseigné dans le plan SimBrief." }
  }

  return { ok: true, data: { company, aircraft, flightNumberDigits: ofp.flightNumberDigits, callsign: ofp.callsign } }
}

export function OfpImportPreview({ ofp, companies, source, onCreated }: OfpImportPreviewProps) {
  const { data: allAircraft, isLoading } = useAircraft()
  const createMutation = useCreateBookingFromOfp()
  const [alternateIcao, setAlternateIcao] = useState(ofp.alternateIcao ?? '')

  useEffect(() => {
    setAlternateIcao(ofp.alternateIcao ?? '')
  }, [ofp])

  const resolution = useMemo(() => {
    if (!allAircraft) return null
    return resolveImport(ofp, companies, allAircraft)
  }, [ofp, companies, allAircraft])

  // Avertit si cette ligne est tarifiée (mode économie) mais qu'aucune résolution en attente n'y
  // correspond — sans ça, l'import se fait silencieusement sans mode économie et l'oubli ne se
  // découvre qu'au PIREP, une fois le vol déjà terminé.
  const resolvedCompanyId = resolution?.ok ? resolution.data.company.id : null
  const { data: routePriceForImport } = useRoutePrice(
    resolvedCompanyId,
    ofp.departureIcao,
    ofp.arrivalIcao,
    resolvedCompanyId !== null
  )
  const pendingEconomy = useEconomyBookingStore((state) => state.pending)
  const pendingEconomyMatches = Boolean(
    pendingEconomy &&
      resolvedCompanyId !== null &&
      pendingEconomy.companyId === resolvedCompanyId &&
      pendingEconomy.departureIcao === ofp.departureIcao.trim().toUpperCase() &&
      pendingEconomy.arrivalIcao === ofp.arrivalIcao.trim().toUpperCase()
  )
  const showEconomyMismatchWarning = Boolean(routePriceForImport) && !pendingEconomyMatches

  function handleImport() {
    if (!resolution?.ok) return
    const trimmedAlternate = alternateIcao.trim().toUpperCase()
    const economy = useEconomyBookingStore
      .getState()
      .consumeIfMatches(resolution.data.company.id, ofp.departureIcao, ofp.arrivalIcao)
    createMutation
      .mutateAsync({
        companyId: resolution.data.company.id,
        aircraftId: resolution.data.aircraft.id,
        flightNumberDigits: resolution.data.flightNumberDigits,
        callsign: resolution.data.callsign,
        departureIcao: ofp.departureIcao,
        arrivalIcao: ofp.arrivalIcao,
        alternateIcao: trimmedAlternate ? trimmedAlternate : null,
        scheduledDepartureUtc: ofp.scheduledDepartureUtc,
        scheduledArrivalUtc: ofp.scheduledArrivalUtc,
        route: ofp.route,
        simbriefOfpJson: ofp.rawJson,
        source,
        economy
      })
      .then((flight) => onCreated(flight))
  }

  return (
    <div className="ofp-confirm">
      <div className="ofp-summary">
        <div className="ofp-summary-row">
          <span className="ofp-summary-label">Trajet</span>
          <span>
            {getAirportLabel(ofp.departureIcao)} → {getAirportLabel(ofp.arrivalIcao)}
          </span>
        </div>
        <div className="ofp-summary-row">
          <span className="ofp-summary-label">Horaires prévus</span>
          <span>
            {formatDateTime(ofp.scheduledDepartureUtc)} → {formatDateTime(ofp.scheduledArrivalUtc)}
          </span>
        </div>
        {ofp.aircraftIcaoType ? (
          <div className="ofp-summary-row">
            <span className="ofp-summary-label">Avion (SimBrief)</span>
            <span>{ofp.aircraftIcaoType}</span>
          </div>
        ) : null}
        {ofp.callsign ? (
          <div className="ofp-summary-row">
            <span className="ofp-summary-label">Callsign ATC (SimBrief)</span>
            <strong>{ofp.callsign}</strong>
          </div>
        ) : null}
        {ofp.route ? (
          <div className="ofp-summary-row">
            <span className="ofp-summary-label">Route</span>
            <span className="ofp-summary-route">{ofp.route}</span>
          </div>
        ) : null}
        <div className="ofp-summary-row">
          <span className="ofp-summary-label">Aéroport alternatif</span>
          <input
            className="ofp-alternate-input"
            value={alternateIcao}
            onChange={(event) => setAlternateIcao(event.target.value.toUpperCase())}
            placeholder="OACI (optionnel)"
            maxLength={4}
          />
        </div>
      </div>

      {isLoading || !resolution ? (
        <p className="page-loading">Vérification de la flotte…</p>
      ) : resolution.ok ? (
        <>
          <div className="ofp-summary">
            <div className="pirep-detail-header">
              <CompanyLogo
                logoFilename={resolution.data.company.logoFilename}
                icaoCode={resolution.data.company.icaoCode}
                width={96}
                height={54}
              />
              <div>
                <div className="flight-card-callsign">{resolution.data.company.displayName}</div>
                <div className="flight-card-number">
                  Vol {resolution.data.company.icaoCode}
                  {resolution.data.flightNumberDigits} · {resolution.data.aircraft.type}
                  {resolution.data.aircraft.registration ? ` (${resolution.data.aircraft.registration})` : ''}
                </div>
              </div>
            </div>
          </div>

          {showEconomyMismatchWarning ? (
            <p className="form-warning">
              Cette ligne est tarifiée (mode économie) mais aucune résolution en attente ne lui correspond — ce vol sera
              importé sans mode économie. Repassez par « Créer un plan » ou « Vols réels » pour ce trajet si vous
              vouliez l'appliquer.
            </p>
          ) : null}

          <div className="form-actions">
            <button type="button" className="primary" onClick={handleImport} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Import…' : 'Importer ce vol'}
            </button>
          </div>
        </>
      ) : (
        <p className="form-error">Impossible d'importer : {resolution.reason}</p>
      )}

      {createMutation.isError ? <p className="form-error">{(createMutation.error as Error).message}</p> : null}
    </div>
  )
}
