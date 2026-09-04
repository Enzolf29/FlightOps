import { Modal } from './Modal'
import { CompanyLogo } from './CompanyLogo'
import { useCabinAnnouncementStore } from '@renderer/stores/cabinAnnouncementStore'
import { formatDateTime } from '@renderer/lib/format'
import { buildLoadsheetComparison } from '@shared/simbrief/buildLoadsheetComparison'
import type { OfpDetail } from '@shared/simbrief/parseOfpDetail'
import type { FlightWithRelations } from '@shared/types/flight'
import type { LoadsheetComparisonRow, LoadsheetValueSource } from '@shared/types/loadsheet'

interface LoadsheetDocumentModalProps {
  ofp: OfpDetail
  flight: FlightWithRelations
  onClose: () => void
}

const SOURCE_LABEL: Record<LoadsheetValueSource, string> = {
  simbrief: 'SIMBRIEF',
  simulator: 'MSFS',
  gsx: 'GSX',
  calculated: 'CALCULÉ',
  simbrief_fallback: 'SIMBRIEF *',
  pending: 'EN ATTENTE'
}

function formatValue(value: number | null, unit: LoadsheetComparisonRow['unit']): string {
  if (value === null) return '—'
  const rounded = Math.round(value).toLocaleString('fr-FR')
  return unit === 'pax' ? rounded : `${rounded} KG`
}

function formatDelta(row: LoadsheetComparisonRow): string | null {
  if (row.planned === null || row.final === null || row.source === 'simbrief_fallback') return null
  const delta = Math.round(row.final - row.planned)
  if (delta === 0) return 'Δ 0'
  return `Δ ${delta > 0 ? '+' : ''}${delta.toLocaleString('fr-FR')}`
}

function LoadsheetRows({ rows }: { rows: LoadsheetComparisonRow[] }) {
  return (
    <div className="loadsheet-paper-table" role="table">
      <div className="loadsheet-paper-row loadsheet-paper-row--head" role="row">
        <span>ITEM</span><span>PLAN SB</span><span>FINAL</span><span>LIMITE</span><span>SOURCE</span>
      </div>
      {rows.map((row) => {
        const delta = formatDelta(row)
        return (
          <div key={row.key} className="loadsheet-paper-row" role="row">
            <strong>{row.label}</strong>
            <span>{formatValue(row.planned, row.unit)}</span>
            <span className={row.final !== null ? 'loadsheet-paper-final' : 'loadsheet-paper-pending'}>
              {formatValue(row.final, row.unit)}
              {delta ? <small>{delta}</small> : null}
            </span>
            <span>{formatValue(row.limit, row.unit)}</span>
            <span className={`loadsheet-paper-source loadsheet-paper-source--${row.source}`}>
              {SOURCE_LABEL[row.source]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function LoadsheetDocumentModal({ ofp, flight, onClose }: LoadsheetDocumentModalProps) {
  const finalLoadsheet = useCabinAnnouncementStore((state) => state.finalLoadsheet)
  const rows = ofp.loadsheet ? buildLoadsheetComparison(ofp.loadsheet, finalLoadsheet) : []
  const loadRows = rows.filter((row) => row.section === 'load')
  const fuelRows = rows.filter((row) => row.section === 'fuel')
  const isFinal = finalLoadsheet !== null

  return (
    <Modal title="LoadSheet" onClose={onClose} wide>
      <article className="loadsheet-paper">
        <header className="loadsheet-paper-header">
          <CompanyLogo
            logoFilename={flight.company.logoFilename}
            icaoCode={flight.company.icaoCode}
            width={112}
            height={54}
          />
          <div className="loadsheet-paper-title">
            <span>FLIGHT OPERATIONS</span>
            <strong>LOAD AND TRIM SHEET</strong>
            <small>DOCUMENT DE CHARGEMENT · MASSES EN KILOGRAMMES</small>
          </div>
          <div className={`loadsheet-paper-stamp ${isFinal ? 'loadsheet-paper-stamp--final' : ''}`}>
            {isFinal ? 'FINAL' : 'PRELIMINARY'}
          </div>
        </header>

        <div className="loadsheet-paper-meta">
          <div><span>VOL</span><strong>{flight.flightNumber}</strong></div>
          <div><span>CALLSIGN</span><strong>{flight.callsignDisplay}</strong></div>
          <div><span>ROUTE</span><strong>{flight.departureIcao} / {flight.arrivalIcao}</strong></div>
          <div><span>TYPE</span><strong>{flight.aircraft?.type ?? '—'}</strong></div>
          <div><span>IMMATRICULATION</span><strong>{flight.aircraft?.registration ?? ofp.aircraftRegistration ?? '—'}</strong></div>
          <div><span>ÉMISSION</span><strong>{formatDateTime(finalLoadsheet?.capturedAt ?? new Date().toISOString())}</strong></div>
        </div>

        {!isFinal ? (
          <div className="loadsheet-paper-notice">
            FEUILLE PRÉVISIONNELLE — La colonne finale sera figée à la fin de l’embarquement GSX ou après stabilisation d’un chargement effectué depuis l’EFB.
          </div>
        ) : (
          <div className="loadsheet-paper-notice loadsheet-paper-notice--final">
            FEUILLE FINALE — Chargement capturé à {formatDateTime(finalLoadsheet.capturedAt)} · {finalLoadsheet.captureSource === 'gsx'
              ? `GSX ${Math.round(finalLoadsheet.cargoBoardingPercent ?? 100)} %`
              : 'MASSE AVION STABILISÉE APRÈS CHARGEMENT EFB'}
          </div>
        )}

        <section className="loadsheet-paper-section">
          <h3>LOAD DISTRIBUTION / WEIGHTS</h3>
          <LoadsheetRows rows={loadRows} />
        </section>

        <section className="loadsheet-paper-section">
          <h3>FUEL DISTRIBUTION</h3>
          <LoadsheetRows rows={fuelRows} />
        </section>

        <footer className="loadsheet-paper-footer">
          <span>* Valeur réelle indisponible : estimation SimBrief conservée.</span>
          <span>CALCULÉ : valeur déduite des masses et du carburant publiés par MSFS.</span>
          <strong>LOADSHEET ACCEPTED · FLIGHTOPS</strong>
        </footer>
      </article>
    </Modal>
  )
}
