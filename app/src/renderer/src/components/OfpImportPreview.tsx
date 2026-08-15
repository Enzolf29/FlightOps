import { useEffect, useMemo, useState } from 'react'
import type { SimbriefOfp } from '@shared/types/simbrief'
import type { Company } from '@shared/types/company'
import type { AircraftWithStats } from '@shared/types/aircraft'
import type { FlightWithRelations, FlightSource } from '@shared/types/flight'
import { useAircraft } from '@renderer/hooks/useAircraft'
import { useCreateBookingFromOfp } from '@renderer/hooks/useBooking'
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

  return { ok: true, data: { company, aircraft, flightNumberDigits: ofp.flightNumberDigits } }
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

  function handleImport() {
    if (!resolution?.ok) return
    const trimmedAlternate = alternateIcao.trim().toUpperCase()
    createMutation
      .mutateAsync({
        companyId: resolution.data.company.id,
        aircraftId: resolution.data.aircraft.id,
        flightNumberDigits: resolution.data.flightNumberDigits,
        departureIcao: ofp.departureIcao,
        arrivalIcao: ofp.arrivalIcao,
        alternateIcao: trimmedAlternate ? trimmedAlternate : null,
        scheduledDepartureUtc: ofp.scheduledDepartureUtc,
        scheduledArrivalUtc: ofp.scheduledArrivalUtc,
        route: ofp.route,
        simbriefOfpJson: ofp.rawJson,
        source
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
                  Vol {resolution.data.company.iataCode}
                  {resolution.data.flightNumberDigits} · {resolution.data.aircraft.type}
                  {resolution.data.aircraft.registration ? ` (${resolution.data.aircraft.registration})` : ''}
                </div>
              </div>
            </div>
          </div>

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
