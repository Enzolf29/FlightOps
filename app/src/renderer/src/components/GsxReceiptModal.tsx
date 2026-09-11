import { useEffect, useState } from 'react'
import type { GsxReceipt } from '@shared/types/gsxReceipt'
import { useExcludeGsxReceipt } from '@renderer/hooks/useGsxReceipts'
import { Modal } from './Modal'

interface GsxReceiptModalProps {
  receipt: GsxReceipt
  onClose: () => void
}

export function GsxReceiptModal({ receipt, onClose }: GsxReceiptModalProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const excludeMutation = useExcludeGsxReceipt()

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

  function handleDelete() {
    excludeMutation.mutate(receipt.receiptId, { onSuccess: onClose })
  }

  return (
    <Modal title={receipt.title || 'Facture GSX'} onClose={onClose} wide>
      <div className="gsx-receipt-frame-wrap">
        {html === null ? (
          <span className="gsx-receipt-frame-loading">Chargement de la facture…</span>
        ) : (
          <iframe className="gsx-receipt-frame" srcDoc={html} title={receipt.title || receipt.receiptId} sandbox="" />
        )}
      </div>

      <div className="gsx-receipt-footer">
        {confirmingDelete ? (
          <>
            <span className="form-hint">Retirer cette facture de tous les vols ?</span>
            <button type="button" className="danger" onClick={handleDelete} disabled={excludeMutation.isPending}>
              {excludeMutation.isPending ? 'Suppression…' : 'Confirmer'}
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} disabled={excludeMutation.isPending}>
              Annuler
            </button>
          </>
        ) : (
          <button type="button" className="danger-ghost" onClick={() => setConfirmingDelete(true)}>
            Supprimer cette facture
          </button>
        )}
      </div>
    </Modal>
  )
}
