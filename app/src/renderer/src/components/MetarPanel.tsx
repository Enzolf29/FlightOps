import { useState } from 'react'
import { MetarDisplay } from '@renderer/components/MetarDisplay'

interface MetarAirport {
  icao: string
  label: string
}

interface MetarResult {
  icao: string
  loading: boolean
  text: string | null
  error: string | null
}

interface MetarPanelProps {
  airports: MetarAirport[]
}

export function MetarPanel({ airports }: MetarPanelProps) {
  const [customIcao, setCustomIcao] = useState('')
  const [result, setResult] = useState<MetarResult | null>(null)

  async function fetchMetar(rawIcao: string): Promise<void> {
    const icao = rawIcao.trim().toUpperCase()
    if (!icao) return
    setResult({ icao, loading: true, text: null, error: null })
    try {
      const text = await window.flightops.simconnect.getMetar(icao)
      setResult({ icao, loading: false, text, error: null })
    } catch (error) {
      setResult({ icao, loading: false, text: null, error: error instanceof Error ? error.message : 'METAR indisponible' })
    }
  }

  return (
    <div className="metar-panel">
      <div className="metar-buttons">
        {airports.map((airport) => (
          <button key={airport.icao} type="button" onClick={() => fetchMetar(airport.icao)}>
            {airport.label}
          </button>
        ))}
        <form
          className="metar-custom-form"
          onSubmit={(event) => {
            event.preventDefault()
            void fetchMetar(customIcao)
            setCustomIcao('')
          }}
        >
          <input
            value={customIcao}
            onChange={(event) => setCustomIcao(event.target.value)}
            placeholder="Autre aéroport (code OACI)"
            maxLength={4}
          />
          <button type="submit" className="primary">
            Rechercher
          </button>
        </form>
      </div>

      <div className="metar-results">
        {!result ? (
          <p className="empty-hint">Aucun METAR recherché pour l’instant.</p>
        ) : (
          <div className="metar-result-card">
            <span className="ofp-summary-label">{result.icao}</span>
            {result.loading ? (
              <span className="text-muted">Recherche…</span>
            ) : result.error ? (
              <span className="metar-error">{result.error}</span>
            ) : result.text ? (
              <>
                <MetarDisplay raw={result.text} />
                <code className="metar-text">{result.text}</code>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
