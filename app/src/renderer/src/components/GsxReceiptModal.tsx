import { useEffect, useState } from 'react'
import type { GsxReceipt } from '@shared/types/gsxReceipt'
import { Modal } from './Modal'

interface GsxReceiptModalProps {
  receipt: GsxReceipt
  onClose: () => void
}

export function GsxReceiptModal({ receipt, onClose }: GsxReceiptModalProps) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setHtml(null)
    void window.flightops.gsx.readReceiptHtml(receipt.htmlPath).then((content) => {
      if (!cancelled) setHtml(content)
    })
    return () => {
      cancelled = true
    }
  }, [receipt.htmlPath])

  return (
    <Modal title={receipt.title || 'Facture GSX'} onClose={onClose} wide>
      <div className="gsx-receipt-frame-wrap">
        {html === null ? (
          <span className="gsx-receipt-frame-loading">Chargement de la facture…</span>
        ) : (
          <iframe className="gsx-receipt-frame" srcDoc={html} title={receipt.title || receipt.receiptId} sandbox="" />
        )}
      </div>
    </Modal>
  )
}
