import { useEffect, useState } from 'react'
import type { SimConnectStatus, SimTelemetry } from '@shared/types/simconnect'

export function useSimConnectStatus(): SimConnectStatus | null {
  const [status, setStatus] = useState<SimConnectStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    window.flightops.simconnect.getStatus().then((value) => {
      if (!cancelled) setStatus(value)
    })
    const unsubscribe = window.flightops.simconnect.onStatusChange((value) => setStatus(value))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return status
}

export function useSimTelemetry(): SimTelemetry | null {
  const [telemetry, setTelemetry] = useState<SimTelemetry | null>(null)

  useEffect(() => window.flightops.simconnect.onTelemetry((value) => setTelemetry(value)), [])

  return telemetry
}
