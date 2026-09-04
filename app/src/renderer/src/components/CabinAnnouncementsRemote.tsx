import { useQuery } from '@tanstack/react-query'
import { CABIN_ANNOUNCEMENT_DEFINITIONS } from '@shared/types/cabinAnnouncements'
import { useCabinAnnouncementStore } from '@renderer/stores/cabinAnnouncementStore'
import { CompanyLogo } from './CompanyLogo'
import { Modal } from './Modal'

export function CabinAnnouncementsRemote({ onClose }: { onClose: () => void }) {
  const company = useCabinAnnouncementStore((state) => state.company)
  const automationReady = useCabinAnnouncementStore((state) => state.automationReady)
  const simconnectConnected = useCabinAnnouncementStore((state) => state.simconnectConnected)
  const gsxDetected = useCabinAnnouncementStore((state) => state.gsxDetected)
  const activeVoice = useCabinAnnouncementStore((state) => state.activeVoice)
  const activeMusic = useCabinAnnouncementStore((state) => state.activeMusic)
  const queuedTypes = useCabinAnnouncementStore((state) => state.queuedTypes)
  const play = useCabinAnnouncementStore((state) => state.play)
  const stop = useCabinAnnouncementStore((state) => state.stop)
  const stopAll = useCabinAnnouncementStore((state) => state.stopAll)
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['cabin-announcements', company?.id],
    queryFn: () => window.flightops.cabinAnnouncements.list(company!.id),
    enabled: Boolean(company)
  })
  const filesByType = new Map(files.map((file) => [file.type, file]))
  const hasPlayback = Boolean(activeVoice || activeMusic || queuedTypes.length > 0)

  return (
    <Modal title="Annonces cabine" onClose={onClose} wide>
      <div className="cabin-remote">
        <div className="cabin-remote-status">
          {company ? (
            <>
              <CompanyLogo logoFilename={company.logoFilename} icaoCode={company.icaoCode} width={100} height={54} />
              <div>
                <strong>{company.displayName}</strong>
                <span>Détectée via le code OACI {company.icaoCode} du plan de vol</span>
              </div>
            </>
          ) : (
            <div><strong>Aucune compagnie détectée</strong><span>Démarrez ou reprenez un vol dans le suivi.</span></div>
          )}
          <div className="cabin-remote-connection">
            <span className={'cabin-connection-dot' + (automationReady ? ' cabin-connection-dot--connected' : '')} />
            <strong>{automationReady ? 'Automatisation active' : 'Automatisation en attente'}</strong>
            <small>{!simconnectConnected ? 'SimConnect non connecté' : gsxDetected ? 'GSX détecté' : 'SimConnect connecté · GSX en attente'}</small>
          </div>
        </div>

        {hasPlayback ? (
          <div className="cabin-now-playing">
            <div>
              <span className="cabin-now-playing-pulse" />
              <div>
                <small>Lecture en cours</small>
                <strong>{CABIN_ANNOUNCEMENT_DEFINITIONS.find((item) => item.type === (activeVoice?.type ?? activeMusic?.type))?.label}</strong>
                <span>{(activeVoice?.origin ?? activeMusic?.origin) === 'automatic' ? 'Déclenchée automatiquement' : 'Lecture manuelle'}</span>
              </div>
            </div>
            <button type="button" className="danger" onClick={stopAll}>Tout arrêter</button>
          </div>
        ) : null}

        {isLoading ? <p className="empty-hint">Chargement de la bibliothèque…</p> : (
          <div className="cabin-remote-grid">
            {CABIN_ANNOUNCEMENT_DEFINITIONS.map((definition) => {
              const file = filesByType.get(definition.type)
              const active = activeVoice?.type === definition.type || activeMusic?.type === definition.type
              const queued = queuedTypes.includes(definition.type)
              const origin = activeVoice?.type === definition.type ? activeVoice.origin
                : activeMusic?.type === definition.type ? activeMusic.origin : null
              return (
                <div key={definition.type} className={'cabin-remote-item' + (active ? ' cabin-remote-item--active' : '')}>
                  <span className="cabin-announcement-icon" aria-hidden="true">{definition.icon}</span>
                  <div className="cabin-remote-copy">
                    <strong>{definition.label}</strong>
                    <span>{definition.trigger}</span>
                    {!file ? <small>Non configurée pour cette compagnie</small>
                      : active ? <small className="cabin-playing-label">● En cours · {origin === 'automatic' ? 'automatique' : 'manuel'}</small>
                        : queued ? <small>Dans la file d’attente</small>
                          : <small>Prête · volume {Math.round(file.volume * 100)}%</small>}
                  </div>
                  {active || queued ? (
                    <button type="button" className="danger-ghost" onClick={() => stop(definition.type)}>Arrêter</button>
                  ) : (
                    <button type="button" disabled={!file} onClick={() => play(definition.type)}>Lire</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
