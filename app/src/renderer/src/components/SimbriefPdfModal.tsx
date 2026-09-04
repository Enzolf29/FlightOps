import { useState } from 'react'
import { Modal } from './Modal'

interface SimbriefPdfModalProps {
  pdfUrl: string
  flightLabel: string
  onClose: () => void
}

function internalPdfUrl(source: string): string {
  return `flightops-pdf://briefing/view?source=${encodeURIComponent(source)}`
}

export function SimbriefPdfModal({ pdfUrl, flightLabel, onClose }: SimbriefPdfModalProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <Modal title={`Briefing SimBrief · ${flightLabel}`} onClose={onClose} wide>
      <div className="simbrief-pdf-viewer">
        <div className="simbrief-pdf-toolbar">
          <span>Operational Flight Plan complet</span>
          <button type="button" className="secondary" onClick={() => void window.flightops.app.openExternal(pdfUrl)}>
            Ouvrir dans le navigateur
          </button>
        </div>
        <div className="simbrief-pdf-frame-wrap">
          {!loaded ? <span className="simbrief-pdf-loading">Chargement du briefing…</span> : null}
          <iframe
            className="simbrief-pdf-frame"
            src={internalPdfUrl(pdfUrl)}
            title={`Briefing SimBrief ${flightLabel}`}
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </Modal>
  )
}
