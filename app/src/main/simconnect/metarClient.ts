import type { SimConnectConnection, RecvWeatherObservation } from 'node-simconnect'

const REQUEST_TIMEOUT_MS = 8000

interface PendingRequest {
  resolve: (metar: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

let nextRequestId = 1000
const pending = new Map<number, PendingRequest>()
let activeHandle: SimConnectConnection | null = null

/**
 * METAR récupéré directement via le moteur météo de SimConnect (pas d'API externe, pas de clé) —
 * ne fonctionne donc que pendant que le simulateur est connecté.
 */
export function attachMetarClient(handle: SimConnectConnection): () => void {
  activeHandle = handle

  function handleObservation(recv: RecvWeatherObservation): void {
    const entry = pending.get(recv.requestID)
    if (!entry) return
    clearTimeout(entry.timeout)
    pending.delete(recv.requestID)
    entry.resolve(recv.metar)
  }

  handle.on('weatherObservation', handleObservation)

  return () => {
    handle.removeListener('weatherObservation', handleObservation)
    activeHandle = null
    for (const entry of pending.values()) {
      clearTimeout(entry.timeout)
      entry.reject(new Error('Connexion SimConnect perdue avant la réponse météo.'))
    }
    pending.clear()
  }
}

function requestMetarFromSimConnect(handle: SimConnectConnection, icaoCode: string): Promise<string> {
  const requestId = nextRequestId++

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(requestId)
      reject(new Error(`Aucune réponse météo SimConnect pour ${icaoCode}.`))
    }, REQUEST_TIMEOUT_MS)

    pending.set(requestId, { resolve, reject, timeout })
    handle.weatherRequestObservationAtStation(requestId, icaoCode.toUpperCase())
  })
}

/**
 * Secours si SimConnect ne répond pas — l'API météo historique de SimConnect (héritée de FSX) est
 * connue pour ne rien renvoyer dans MSFS en dehors du mode "Live Weather". Source publique, sans
 * clé API, hébergée par le NWS américain (aviationweather.gov) — pas de logiciel météo à ouvrir,
 * juste une source de données différente en coulisses.
 */
async function requestMetarFallback(icaoCode: string): Promise<string> {
  const response = await fetch(
    `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icaoCode)}&format=raw`
  )
  if (!response.ok) {
    throw new Error(`Service météo de secours indisponible (HTTP ${response.status}).`)
  }
  const text = (await response.text()).trim()
  if (!text) {
    throw new Error(`Aucun METAR trouvé pour ${icaoCode}.`)
  }
  return text
}

export async function requestMetar(icaoCode: string): Promise<string> {
  const handle = activeHandle
  const code = icaoCode.toUpperCase()

  if (handle) {
    try {
      return await requestMetarFromSimConnect(handle, code)
    } catch {
      // On retente via la source de secours plutôt que d'échouer directement.
    }
  }

  return requestMetarFallback(code)
}
