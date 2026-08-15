import type { FlightStatus } from '@shared/types/flight'
import type { DelayBucket } from '@shared/types/pirep'
import type { SimConnectStatus } from '@shared/types/simconnect'

export const FLIGHT_STATUS_LABEL: Record<FlightStatus, string> = {
  upcoming: 'À venir',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé'
}

export const FLIGHT_STATUS_VARIANT: Record<FlightStatus, string> = {
  upcoming: 'badge-neutral',
  in_progress: 'badge-live',
  completed: 'badge-muted',
  cancelled: 'badge-cancelled'
}

export const DELAY_BUCKET_LABEL: Record<DelayBucket, string> = {
  on_time: 'À l’heure',
  delayed_10_60: 'Retardé',
  delayed_60_plus: 'En retard'
}

export const DELAY_BUCKET_VARIANT: Record<DelayBucket, string> = {
  on_time: 'badge-on-time',
  delayed_10_60: 'badge-delayed-mid',
  delayed_60_plus: 'badge-delayed-high'
}

export const SIMCONNECT_STATUS_LABEL: Record<SimConnectStatus, string> = {
  disconnected: 'Non connecté',
  connecting: 'Connexion à MSFS 2024…',
  connected: 'Connecté à MSFS 2024',
  error: 'Erreur — nouvelle tentative…'
}

export const SIMCONNECT_STATUS_VARIANT: Record<SimConnectStatus, string> = {
  disconnected: 'badge-muted',
  connecting: 'badge-delayed-mid',
  connected: 'badge-on-time',
  error: 'badge-delayed-high'
}
