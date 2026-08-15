import { useState, type FormEvent } from 'react'
import type { Company } from '@shared/types/company'
import type { AircraftInput, AircraftWithStats } from '@shared/types/aircraft'

interface AircraftFormProps {
  companies: Company[]
  initial?: AircraftWithStats | null
  onSubmit: (input: AircraftInput) => void
  onCancel: () => void
  submitting: boolean
  errorMessage?: string | null
}

export function AircraftForm({ companies, initial, onSubmit, onCancel, submitting, errorMessage }: AircraftFormProps) {
  const [companyId, setCompanyId] = useState(initial?.companyId ?? companies[0]?.id ?? 0)
  const [type, setType] = useState(initial?.type ?? '')
  const [registration, setRegistration] = useState(initial?.registration ?? '')
  const [simbriefIcaoCode, setSimbriefIcaoCode] = useState(initial?.simbriefIcaoCode ?? '')
  const [simbriefFin, setSimbriefFin] = useState(initial?.simbriefFin ?? '')
  const [modeS, setModeS] = useState(initial?.modeS ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupHint, setLookupHint] = useState<string | null>(null)

  async function handleLookup() {
    if (!registration.trim()) return
    setLookupLoading(true)
    setLookupError(null)
    setLookupHint(null)
    try {
      const result = await window.flightops.adsbdb.lookupByRegistration(registration.trim())
      setRegistration(result.registration)
      setType(result.typeDescription)
      if (result.icaoType) setSimbriefIcaoCode(result.icaoType)
      setModeS(result.modeS ?? '')

      const matchedCompany = result.registeredOwnerIcaoCode
        ? companies.find((company) => company.icaoCode === result.registeredOwnerIcaoCode)
        : undefined
      if (matchedCompany) {
        setCompanyId(matchedCompany.id)
        setLookupHint(`Détecté : ${result.typeDescription} — ${matchedCompany.displayName}`)
      } else {
        setLookupHint(
          `Détecté : ${result.typeDescription}${result.registeredOwner ? ` — ${result.registeredOwner}` : ''} (compagnie non reconnue, sélectionnez-la manuellement)`
        )
      }
    } catch (error) {
      setLookupError((error as Error).message)
    } finally {
      setLookupLoading(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      companyId,
      type: type.trim(),
      registration: registration.trim() || null,
      simbriefIcaoCode: simbriefIcaoCode.trim() || null,
      simbriefFin: simbriefFin.trim() || null,
      modeS: modeS.trim() || null,
      notes: notes.trim() || null
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Immatriculation</span>
        <div className="form-inline-group">
          <input
            value={registration}
            onChange={(event) => setRegistration(event.target.value)}
            placeholder="F-HZUK"
          />
          <button type="button" onClick={handleLookup} disabled={lookupLoading || !registration.trim()}>
            {lookupLoading ? 'Recherche…' : 'Rechercher'}
          </button>
        </div>
      </label>

      {lookupError ? <p className="form-error">{lookupError}</p> : null}
      {lookupHint ? <p className="form-hint">{lookupHint}</p> : null}

      <label className="form-field">
        <span>Compagnie</span>
        <select value={companyId} onChange={(event) => setCompanyId(Number(event.target.value))} required>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.displayName}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Type d'avion</span>
        <input value={type} onChange={(event) => setType(event.target.value)} placeholder="A320neo" required />
      </label>

      <label className="form-field">
        <span>Code OACI SimBrief</span>
        <input
          value={simbriefIcaoCode}
          onChange={(event) => setSimbriefIcaoCode(event.target.value)}
          placeholder="A20N"
        />
      </label>

      <label className="form-field">
        <span>Internal ID de l'airframe SimBrief</span>
        <input
          value={simbriefFin}
          onChange={(event) => setSimbriefFin(event.target.value)}
          placeholder="ex. 123456_1582090020 (visible en haut de la fiche avion sur SimBrief)"
        />
      </label>

      <label className="form-field">
        <span>Notes</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>

      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className="primary" disabled={submitting || !type.trim()}>
          {submitting ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </form>
  )
}
