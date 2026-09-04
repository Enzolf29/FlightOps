import type { FlightRecorderStatus, SimConnectStatus, SimTelemetry } from '@shared/types/simconnect'

interface FlightRecorderPanelProps {
  recorder: FlightRecorderStatus | null
  connection: SimConnectStatus | null
  telemetry: SimTelemetry | null
}

function value(value: number | undefined, digits = 0): string {
  return value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

export function FlightRecorderPanel({ recorder, connection, telemetry }: FlightRecorderPanelProps) {
  const recordingOk = recorder?.state === 'recording' || recorder?.state === 'recovered'
  const savedLabel = recorder?.lastSavedAt
    ? new Date(recorder.lastSavedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <section className="flight-recorder-panel">
      <div className="flight-recorder-summary">
        <div className={`recorder-state recorder-state--${recorder?.state ?? 'idle'}`}>
          <span className="recorder-dot" />
          <div>
            <strong>{recorder?.message ?? 'Initialisation de l’enregistreur'}</strong>
            <span>{recordingOk ? `${recorder?.sampleCount ?? 0} points sécurisés` : 'Aucune donnée de vol en cours'}</span>
          </div>
        </div>
        <div className={`recorder-signal ${connection === 'connected' ? 'recorder-signal--ok' : 'recorder-signal--lost'}`}>
          <span className="recorder-dot" />
          <div>
            <strong>{connection === 'connected' ? 'Signal SimConnect reçu' : 'Signal SimConnect perdu'}</strong>
            <span>Dernière sauvegarde : {savedLabel}</span>
          </div>
        </div>
      </div>

      <details className="simconnect-diagnostic">
        <summary>Diagnostic SimConnect</summary>
        {telemetry ? (
          <div className="diagnostic-grid">
            <Diagnostic label="Avion détecté" value={telemetry.title || '—'} />
            <Diagnostic label="Immatriculation" value={telemetry.atcId || '—'} />
            <Diagnostic label="Altitude indiquée" value={`${value(telemetry.altitude)} ft`} />
            <Diagnostic label="Hauteur sol" value={`${value(telemetry.altitudeAboveGround)} ft AGL`} />
            <Diagnostic label="Sol / parking" value={`${telemetry.onGround ? 'Au sol' : 'En vol'} · ${telemetry.parkingBrakeSet ? 'Frein mis' : 'Frein retiré'}`} />
            <Diagnostic label="Moteurs confirmés" value={[telemetry.engine1Running, telemetry.engine2Running, telemetry.engine3Running, telemetry.engine4Running].map((on, i) => `M${i + 1} ${on ? 'ON' : 'OFF'}`).join(' · ')} />
            <Diagnostic label="Combustion brute" value={telemetry.diagnostics?.combustion.map((on, i) => `M${i + 1} ${on ? '1' : '0'}`).join(' · ') ?? '—'} />
            <Diagnostic label="N1 brut" value={telemetry.diagnostics?.n1Percent.map((n, i) => `M${i + 1} ${value(n, 1)}%`).join(' · ') ?? '—'} />
            <Diagnostic label="Volets retenus" value={`Cran ${telemetry.flapsHandleIndex}/${Math.max(0, telemetry.flapsNumHandlePositions - 1)} · ${value(telemetry.flapsPercent)}%`} />
            <Diagnostic label="Volets standards" value={telemetry.diagnostics ? `Index ${value(telemetry.diagnostics.standardFlapsHandleIndex, 1)} · ${value(telemetry.diagnostics.standardFlapsPercent, 1)}%` : '—'} />
            <Diagnostic label="Levier A220" value={value(telemetry.diagnostics?.a220FlapLever, 2)} />
            <Diagnostic label="Heure simulateur" value={telemetry.simZuluIso} />
          </div>
        ) : (
          <p className="empty-hint">Aucune télémétrie reçue. Lance MSFS 2024 pour voir les valeurs brutes.</p>
        )}
      </details>
    </section>
  )
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div className="diagnostic-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
