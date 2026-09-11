import { create } from 'zustand'
import type { CreateFlightFromOfpEconomyInput } from '@shared/types/booking'

interface PendingEconomyBooking {
  companyId: number
  departureIcao: string
  arrivalIcao: string
  economy: CreateFlightFromOfpEconomyInput
}

interface EconomyBookingState {
  pending: PendingEconomyBooking | null
  setPending: (pending: PendingEconomyBooking) => void
  /** Consomme (et efface) le contexte économie résolu à la réservation s'il correspond à la
   * compagnie + ligne du vol qu'on est en train d'importer, sinon renvoie null — évite d'attacher
   * un prix à un OFP sans rapport si le pilote importe autre chose que ce qu'il vient de générer. */
  consumeIfMatches: (companyId: number, departureIcao: string, arrivalIcao: string) => CreateFlightFromOfpEconomyInput | null
}

export const useEconomyBookingStore = create<EconomyBookingState>((set, get) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  consumeIfMatches: (companyId, departureIcao, arrivalIcao) => {
    const { pending } = get()
    if (
      pending &&
      pending.companyId === companyId &&
      pending.departureIcao === departureIcao.trim().toUpperCase() &&
      pending.arrivalIcao === arrivalIcao.trim().toUpperCase()
    ) {
      set({ pending: null })
      return pending.economy
    }
    return null
  }
}))
