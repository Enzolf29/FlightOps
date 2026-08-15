import { useState } from 'react'
import { usePireps } from '@renderer/hooks/usePireps'
import { PirepListRow } from '@renderer/components/PirepListRow'
import { PirepDetail } from '@renderer/components/PirepDetail'
import { Modal } from '@renderer/components/Modal'

export function PirepsPage() {
  const { data: pireps, isLoading } = usePireps()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (isLoading) {
    return <p className="page-loading">Chargement…</p>
  }

  const selected = pireps?.find((pirep) => pirep.id === selectedId) ?? null

  return (
    <div className="fleet-page">
      <h1>PIREPs</h1>

      {!pireps || pireps.length === 0 ? (
        <p className="empty-hint">Aucun PIREP pour le moment. Terminez un vol pour qu'il apparaisse ici.</p>
      ) : (
        <div className="list">
          {pireps.map((pirep) => (
            <PirepListRow key={pirep.id} pirep={pirep} onClick={() => setSelectedId(pirep.id)} />
          ))}
        </div>
      )}

      {selected ? (
        <Modal title={`PIREP · ${selected.flight.callsignDisplay}`} onClose={() => setSelectedId(null)} wide>
          <PirepDetail pirep={selected} />
        </Modal>
      ) : null}
    </div>
  )
}
