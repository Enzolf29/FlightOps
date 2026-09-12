import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import type { RoutePrice, RoutePriceInput } from '@shared/types/economy'

interface RoutePriceFormProps {
  companyId: number
  initial?: RoutePrice | null
  onSubmit: (input: RoutePriceInput) => void
  onClose: () => void
  submitting: boolean
  errorMessage?: string | null
}

export function RoutePriceForm({ companyId, initial, onSubmit, onClose, submitting, errorMessage }: RoutePriceFormProps) {
  const [departureIcao, setDepartureIcao] = useState(initial?.departureIcao ?? '')
  const [arrivalIcao, setArrivalIcao] = useState(initial?.arrivalIcao ?? '')
  const [ticketMin, setTicketMin] = useState(initial?.ticketPriceMinEur ?? 50)
  const [ticketMax, setTicketMax] = useState(initial?.ticketPriceMaxEur ?? 150)
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!departureIcao.trim() || !arrivalIcao.trim()) {
      setValidationError('Renseignez les deux aéroports.')
      return
    }
    if (ticketMax < ticketMin) {
      setValidationError('Le prix maximum doit être supérieur ou égal au minimum.')
      return
    }
    setValidationError(null)
    onSubmit({
      companyId,
      departureIcao: departureIcao.trim().toUpperCase(),
      arrivalIcao: arrivalIcao.trim().toUpperCase(),
      ticketPriceMinEur: ticketMin,
      ticketPriceMaxEur: ticketMax
    })
  }

  return (
    <Modal title={initial ? `Ligne ${initial.departureIcao} → ${initial.arrivalIcao}` : 'Nouvelle ligne tarifée'} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Aéroport de départ</span>
          <input
            value={departureIcao}
            onChange={(event) => setDepartureIcao(event.target.value.toUpperCase())}
            placeholder="LFPG"
            maxLength={4}
            disabled={Boolean(initial)}
            required
          />
        </label>
        <label className="form-field">
          <span>Aéroport d'arrivée</span>
          <input
            value={arrivalIcao}
            onChange={(event) => setArrivalIcao(event.target.value.toUpperCase())}
            placeholder="LFRB"
            maxLength={4}
            disabled={Boolean(initial)}
            required
          />
        </label>
        <label className="form-field">
          <span>Prix billet minimum (€)</span>
          <input type="number" min={0} step="0.01" value={ticketMin} onChange={(event) => setTicketMin(Number(event.target.value))} required />
        </label>
        <label className="form-field">
          <span>Prix billet maximum (€)</span>
          <input type="number" min={0} step="0.01" value={ticketMax} onChange={(event) => setTicketMax(Number(event.target.value))} required />
        </label>

        {(validationError ?? errorMessage) ? <p className="form-error">{validationError ?? errorMessage}</p> : null}

        <div className="form-actions">
          <button type="button" onClick={onClose} disabled={submitting}>
            Annuler
          </button>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
