import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CreateFlightFromOfpEconomyInput } from '@shared/types/booking'

interface PendingEconomyBooking {
  companyId: number
  departureIcao: string
  arrivalIcao: string
  economy: CreateFlightFromOfpEconomyInput
  /** Horodatage de résolution (Date.now()) — voir PENDING_EXPIRY_MS. */
  createdAtMs: number
}

interface EconomyBookingState {
  pending: PendingEconomyBooking | null
  setPending: (pending: Omit<PendingEconomyBooking, 'createdAtMs'>) => void
  /** Consomme (et efface) le contexte économie résolu à la réservation s'il correspond à la
   * compagnie + ligne du vol qu'on est en train d'importer et n'a pas expiré, sinon renvoie null —
   * évite d'attacher un prix à un OFP sans rapport si le pilote importe autre chose que ce qu'il
   * vient de générer, ou un contexte périmé depuis une précédente session. */
  consumeIfMatches: (companyId: number, departureIcao: string, arrivalIcao: string) => CreateFlightFromOfpEconomyInput | null
}

/** Le temps entre "Générer le plan sur SimBrief" et son import de retour peut prendre plusieurs
 * minutes (construction du plan sur le site SimBrief) — largement couvert par cette fenêtre, tout
 * en évitant qu'un contexte oublié des jours plus tôt ne s'applique par erreur à un import sans
 * rapport sur la même ligne. */
const PENDING_EXPIRY_MS = 2 * 60 * 60 * 1000

export const useEconomyBookingStore = create<EconomyBookingState>()(
  persist(
    (set, get) => ({
      pending: null,
      setPending: (pending) => set({ pending: { ...pending, createdAtMs: Date.now() } }),
      consumeIfMatches: (companyId, departureIcao, arrivalIcao) => {
        const { pending } = get()
        if (!pending) return null
        if (Date.now() - pending.createdAtMs > PENDING_EXPIRY_MS) {
          set({ pending: null })
          return null
        }
        if (
          pending.companyId === companyId &&
          pending.departureIcao === departureIcao.trim().toUpperCase() &&
          pending.arrivalIcao === arrivalIcao.trim().toUpperCase()
        ) {
          set({ pending: null })
          return pending.economy
        }
        return null
      }
    }),
    {
      // Persisté (et non un simple état mémoire) : le vol se génère sur le site SimBrief dans le
      // navigateur système, hors de l'app — un redémarrage de FlightOps entre-temps (ex. mise à
      // jour installée) ne doit pas faire perdre le prix déjà tiré au sort pour ce vol.
      name: 'flightops-economy-booking'
    }
  )
)
