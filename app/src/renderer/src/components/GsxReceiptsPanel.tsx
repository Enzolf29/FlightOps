import { useState } from 'react'
import { GSX_CATEGORY_LABEL, type GsxReceipt } from '@shared/types/gsxReceipt'
import { DollarSignIcon } from '@renderer/components/icons'
import { GsxReceiptModal } from './GsxReceiptModal'

interface GsxReceiptsPanelProps {
  receipts: GsxReceipt[]
  isLoading: boolean
  /** Classe de la section englobante, pour s'accorder à l'espacement de la page appelante
   * (`home-section` sur le suivi de vol, `pirep-detail-section` dans le détail PIREP). Ignorée si
   * `bare` est vrai. */
  sectionClassName?: string
  /** Rend le contenu sans sa propre balise `<section>` englobante, pour nicher la liste des
   * factures dans une section plus large (ex. le bloc "Finance" du détail PIREP). */
  bare?: boolean
}

export function GsxReceiptsPanel({ receipts, isLoading, sectionClassName = 'home-section', bare = false }: GsxReceiptsPanelProps) {
  const [openReceipt, setOpenReceipt] = useState<GsxReceipt | null>(null)

  if (isLoading || receipts.length === 0) return null

  const content = (
    <>
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
    </>
  )

  return bare ? content : <section className={sectionClassName}>{content}</section>
}
