import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CompanyPicker } from './CompanyPicker'
import { CompanyLogo } from './CompanyLogo'
import {
  CABIN_ANNOUNCEMENT_DEFINITIONS,
  type CabinAnnouncementFile,
  type CabinAnnouncementType
} from '@shared/types/cabinAnnouncements'

export function CabinAnnouncementsSettings() {
  const queryClient = useQueryClient()
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['fleet', 'companies'],
    queryFn: () => window.flightops.fleet.companies.list()
  })
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [previewType, setPreviewType] = useState<CabinAnnouncementType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftVolumes, setDraftVolumes] = useState<Partial<Record<CabinAnnouncementType, number>>>({})
  const previewRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (companyId === null && companies.length > 0) setCompanyId(companies[0].id)
  }, [companies, companyId])

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['cabin-announcements', companyId],
    queryFn: () => window.flightops.cabinAnnouncements.list(companyId!),
    enabled: companyId !== null
  })
  const filesByType = new Map(files.map((file) => [file.type, file]))

  useEffect(() => {
    setDraftVolumes(Object.fromEntries(files.map((file) => [file.type, Math.round(file.volume * 100)])))
  }, [files])

  const importMutation = useMutation({
    mutationFn: ({ selectedCompanyId, type }: { selectedCompanyId: number; type: CabinAnnouncementType }) =>
      window.flightops.cabinAnnouncements.import(selectedCompanyId, type),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['cabin-announcements', companyId] })
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Import impossible.')
  })
  const removeMutation = useMutation({
    mutationFn: ({ selectedCompanyId, type }: { selectedCompanyId: number; type: CabinAnnouncementType }) =>
      window.flightops.cabinAnnouncements.remove(selectedCompanyId, type),
    onSuccess: () => {
      stopPreview()
      queryClient.invalidateQueries({ queryKey: ['cabin-announcements', companyId] })
    }
  })
  const volumeMutation = useMutation({
    mutationFn: ({ selectedCompanyId, type, volume }: { selectedCompanyId: number; type: CabinAnnouncementType; volume: number }) =>
      window.flightops.cabinAnnouncements.setVolume(selectedCompanyId, type, volume / 100),
    onSuccess: (updated) => {
      queryClient.setQueryData<CabinAnnouncementFile[]>(['cabin-announcements', updated.companyId], (current = []) =>
        current.map((file) => file.type === updated.type ? updated : file)
      )
      setError(null)
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Volume non enregistré.')
  })

  function stopPreview() {
    previewRef.current?.pause()
    previewRef.current = null
    setPreviewType(null)
  }

  function togglePreview(file: CabinAnnouncementFile) {
    if (previewType === file.type) {
      stopPreview()
      return
    }
    stopPreview()
    const audio = new Audio(file.audioUrl)
    audio.volume = (draftVolumes[file.type] ?? Math.round(file.volume * 100)) / 100
    previewRef.current = audio
    setPreviewType(file.type)
    audio.onended = stopPreview
    audio.onerror = stopPreview
    audio.play().catch(() => {
      setError('Ce fichier audio ne peut pas être lu.')
      stopPreview()
    })
  }

  function commitVolume(type: CabinAnnouncementType) {
    if (companyId === null || !filesByType.has(type)) return
    volumeMutation.mutate({ selectedCompanyId: companyId, type, volume: draftVolumes[type] ?? 100 })
  }

  const selectedCompany = companies.find((company) => company.id === companyId) ?? null

  if (companiesLoading) return <p className="empty-hint">Chargement des compagnies…</p>

  return (
    <div className="cabin-settings">
      <section className="settings-section cabin-settings-intro">
        <div>
          <h2>Annonces cabine personnalisées</h2>
          <p>
            Chaque fichier est copié dans les données locales de FlightOps. MP3, WAV, OGG, M4A et AAC sont acceptés.
            Le vol doit être démarré dans le suivi pour que FlightOps choisisse automatiquement sa compagnie.
          </p>
        </div>
        <span className="cabin-local-badge">Stockage local uniquement</span>
      </section>

      <section className="settings-section">
        <h2>Compagnie</h2>
        <p>Sélectionnez la bibliothèque sonore à configurer.</p>
        <CompanyPicker companies={companies} value={companyId} onChange={(id) => { stopPreview(); setCompanyId(id) }} />
      </section>

      {selectedCompany ? (
        <section className="settings-section cabin-library">
          <div className="cabin-library-header">
            <CompanyLogo
              logoFilename={selectedCompany.logoFilename}
              icaoCode={selectedCompany.icaoCode}
              width={112}
              height={62}
            />
            <div>
              <h2>{selectedCompany.displayName}</h2>
              <p>{files.length} annonce{files.length === 1 ? '' : 's'} configurée{files.length === 1 ? '' : 's'} sur {CABIN_ANNOUNCEMENT_DEFINITIONS.length}</p>
            </div>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {filesLoading ? <p className="empty-hint">Chargement…</p> : (
            <div className="cabin-announcement-list">
              {CABIN_ANNOUNCEMENT_DEFINITIONS.map((definition) => {
                const file = filesByType.get(definition.type)
                const importing = importMutation.isPending && importMutation.variables?.type === definition.type
                return (
                  <div className={'cabin-announcement-row' + (file ? ' cabin-announcement-row--ready' : '')} key={definition.type}>
                    <span className="cabin-announcement-icon" aria-hidden="true">{definition.icon}</span>
                    <div className="cabin-announcement-copy">
                      <strong>{definition.label}</strong>
                      <span>{definition.trigger}</span>
                      <small>{file?.originalFilename ?? 'Aucun fichier importé'}</small>
                    </div>
                    <label className={'cabin-volume' + (file ? '' : ' cabin-volume--disabled')}>
                      <span>Volume</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={draftVolumes[definition.type] ?? 100}
                        disabled={!file}
                        aria-label={`Volume de ${definition.label}`}
                        onChange={(event) => setDraftVolumes((current) => ({
                          ...current,
                          [definition.type]: Number(event.target.value)
                        }))}
                        onPointerUp={() => commitVolume(definition.type)}
                        onKeyUp={() => commitVolume(definition.type)}
                        onBlur={() => commitVolume(definition.type)}
                      />
                      <strong>{draftVolumes[definition.type] ?? 100}%</strong>
                    </label>
                    <div className="cabin-announcement-actions">
                      {file ? (
                        <button type="button" onClick={() => togglePreview(file)}>
                          {previewType === definition.type ? 'Arrêter' : 'Écouter'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={file ? '' : 'primary'}
                        disabled={importMutation.isPending}
                        onClick={() => companyId !== null && importMutation.mutate({ selectedCompanyId: companyId, type: definition.type })}
                      >
                        {importing ? 'Import…' : file ? 'Remplacer' : 'Importer'}
                      </button>
                      {file ? (
                        <button
                          type="button"
                          className="danger-ghost"
                          disabled={removeMutation.isPending}
                          onClick={() => companyId !== null && removeMutation.mutate({ selectedCompanyId: companyId, type: definition.type })}
                        >
                          Supprimer
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
