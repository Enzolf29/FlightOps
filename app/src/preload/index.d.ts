import type { FlightopsApi } from '@shared/ipc/api'

declare global {
  interface Window {
    flightops: FlightopsApi
  }
}
