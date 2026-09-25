import { useState } from 'react'
import { GSX_CATEGORY_LABEL, type GsxReceipt } from '@shared/types/gsxReceipt'
import { DollarSignIcon } from '@renderer/components/icons'
import { GsxReceiptModal } from './GsxReceiptModal'

interface GsxReceiptsPanelProps {
  receipts: GsxReceipt[]
  isLoading: boolean
  /** Classe de la section englobante, pour s'accorder à l'espacement de la page appelante
   * (`home-section` sur le suivi de vol, `pirep-detail-section` dans le détail PIREP). */
  sectionClassName?: string
}

export function GsxReceiptsPanel({ receipts, isLoading, sectionClassName = 'home-section' }: GsxReceiptsPanelProps) {
  const [openReceipt, setOpenReceipt] = useState<GsxReceipt | null>(null)

  if (isLoading || receipts.length === 0) return null

  return (
    <section className={sectionClassName}>
      <div className="gsx-launch">
        <div className="gsx-launch-icon">
          <DollarSignIcon size={22} />
        </div>
        <div className="gsx-launch-copy">
          <strong>Frais d’escale (GSX)</strong>
          <span>{receipts.length} facture{receipts.length > 1 ? 's' : ''} détectée{receipts.length > 1 ? 's' : ''}</span>
        </div>
        <div className="gsx-launch-actions">
          {receipts.map((receipt) => (
            <button key={receipt.receiptId} type="button" className="secondary" onClick={() => setOpenReceipt(receipt)}>
              {GSX_CATEGORY_LABEL[receipt.category] ?? receipt.category}
            </button>
          ))}
        </div>
      </div>
      {openReceipt ? <GsxReceiptModal receipt={openReceipt} onClose={() => setOpenReceipt(null)} /> : null}
    </section>
  )
}
