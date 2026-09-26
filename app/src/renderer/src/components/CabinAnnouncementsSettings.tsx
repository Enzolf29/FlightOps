import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CompanyPicker } from './CompanyPicker'
import { CompanyLogo } from './CompanyLogo'
import {
  CABIN_ANNOUNCEMENT_DEFINITIONS,
  CABIN_ANNOUNCEMENT_VARIANTS,
  CABIN_ANNOUNCEMENT_VARIANT_LABEL,
  type CabinAnnouncementFile,
  type CabinAnnouncementType,
  type CabinAnnouncementVariant
} from '@shared/types/cabinAnnouncements'

export function CabinAnnouncementsSettings() {
  const queryClient = useQueryClient()
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['fleet', 'companies'],
    queryFn: () => window.flightops.fleet.companies.list()
  })
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [previewFileId, setPreviewFileId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftVolumes, setDraftVolumes] = useState<Record<number, number>>({})
  const [newVariants, setNewVariants] = useState<Partial<Record<CabinAnnouncementType, CabinAnnouncementVariant>>>({})
  const previewRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (companyId === null && companies.length > 0) setCompanyId(companies[0].id)
  }, [companies, companyId])

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['cabin-announcements', companyId],
    queryFn: () => window.flightops.cabinAnnouncements.list(companyId!),
    enabled: companyId !== null
  })
  const filesByType = new Map<CabinAnnouncementType, CabinAnnouncementFile[]>()
  for (const file of files) filesByType.set(file.type, [...(filesByType.get(file.type) ?? []), file])
  const configuredTypeCount = filesByType.size

  useEffect(() => {
    setDraftVolumes(Object.fromEntries(files.map((file) => [file.id, Math.round(file.volume * 100)])))
  }, [files])

  const importMutation = useMutation({
    mutationFn: ({ selectedCompanyId, type, variant }: { selectedCompanyId: number; type: CabinAnnouncementType; variant: CabinAnnouncementVariant }) =>
      window.flightops.cabinAnnouncements.import(selectedCompanyId, type, variant),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['cabin-announcements', companyId] })
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Import impossible.')
  })
  const removeMutation = useMutation({
    mutationFn: (fileId: number) => window.flightops.cabinAnnouncements.remove(fileId),
    onSuccess: () => {
      stopPreview()
      queryClient.invalidateQueries({ queryKey: ['cabin-announcements', companyId] })
    }
  })
  const resetMutation = useMutation({
    mutationFn: (selectedCompanyId: number) => window.flightops.cabinAnnouncements.resetToDefaults(selectedCompanyId),
    onSuccess: () => {
      stopPreview()
      setError(null)
      setNewVariants({})
      queryClient.invalidateQueries({ queryKey: ['cabin-announcements'] })
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Réinitialisation impossible.')
  })
  const volumeMutation = useMutation({
    mutationFn: ({ fileId, volume }: { fileId: number; volume: number }) =>
      window.flightops.cabinAnnouncements.setVolume(fileId, volume / 100),
    onSuccess: (updated) => {
      queryClient.setQueryData<CabinAnnouncementFile[]>(['cabin-announcements', updated.companyId], (current = []) =>
        current.map((file) => file.id === updated.id ? updated : file)
      )
      setError(null)
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Volume non enregistré.')
  })

  function stopPreview() {
    previewRef.current?.pause()
    previewRef.current = null
    setPreviewFileId(null)
  }

  function togglePreview(file: CabinAnnouncementFile) {
    if (previewFileId === file.id) {
      stopPreview()
      return
    }
    stopPreview()
    const audio = new Audio(file.audioUrl)
    audio.volume = (draftVolumes[file.id] ?? Math.round(file.volume * 100)) / 100
    previewRef.current = audio
    setPreviewFileId(file.id)
    audio.onended = stopPreview
    audio.onerror = stopPreview
    audio.play().catch(() => {
      setError('Ce fichier audio ne peut pas être lu.')
      stopPreview()
    })
  }

  function commitVolume(fileId: number) {
    const stored = files.find((file) => file.id === fileId)
    const draft = draftVolumes[fileId]
    if (!stored || draft === undefined || draft === Math.round(stored.volume * 100)) return
    volumeMutation.mutate({ fileId, volume: draft })
  }

  function resetCompany() {
    if (companyId === null || !selectedCompany) return
    const confirmed = window.confirm(
      `Réinitialiser les annonces de ${selectedCompany.displayName} ?

Les fichiers ajoutés, les suppressions et les volumes seront perdus : les annonces et réglages par défaut sont remis.`
    )
    if (confirmed) resetMutation.mutate(companyId)
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
            Une annonce peut avoir plusieurs fichiers : l’un d’eux est tiré au hasard à chaque lecture, en tenant
            compte du jour ou de la nuit dans le simulateur. Les annonces de base de chaque compagnie sont modifiables
            comme les vôtres. Le vol doit être démarré dans le suivi pour que FlightOps choisisse automatiquement sa compagnie.
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
              <p>
                {configuredTypeCount} annonce{configuredTypeCount === 1 ? '' : 's'} configurée{configuredTypeCount === 1 ? '' : 's'} sur{' '}
                {CABIN_ANNOUNCEMENT_DEFINITIONS.length} · {files.length} fichier{files.length === 1 ? '' : 's'}
              </p>
            </div>
            <button type="button" className="danger-ghost cabin-reset-button" disabled={resetMutation.isPending} onClick={resetCompany}>
              {resetMutation.isPending ? 'Réinitialisation…' : 'Réinitialiser les annonces'}
            </button>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {filesLoading ? <p className="empty-hint">Chargement…</p> : (
            <div className="cabin-announcement-list">
              {CABIN_ANNOUNCEMENT_DEFINITIONS.map((definition) => {
                const typeFiles = filesByType.get(definition.type) ?? []
                const variant = newVariants[definition.type] ?? 'any'
                const importing = importMutation.isPending && importMutation.variables?.type === definition.type
                return (
                  <div className={'cabin-announcement-row' + (typeFiles.length > 0 ? ' cabin-announcement-row--ready' : '')} key={definition.type}>
                    <span className="cabin-announcement-icon" aria-hidden="true">{definition.icon}</span>
                    <div className="cabin-announcement-copy">
                      <strong>{definition.label}</strong>
                      <span>{definition.trigger}</span>
                      {typeFiles.length === 0 ? <small>Aucun fichier</small> : null}
                    </div>

                    {typeFiles.length > 0 ? (
                      <div className="cabin-file-list">
                        {typeFiles.map((file) => (
                          <div className="cabin-file" key={file.id}>
                            <span className={`cabin-variant-badge cabin-variant-badge--${file.variant}`}>
                              {CABIN_ANNOUNCEMENT_VARIANT_LABEL[file.variant]}
                            </span>
                            <span className="cabin-file-name" title={file.originalFilename}>{file.originalFilename}</span>
                            <label className="cabin-volume cabin-volume--inline">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={draftVolumes[file.id] ?? Math.round(file.volume * 100)}
                                aria-label={`Volume de ${definition.label} (${file.originalFilename})`}
                                onChange={(event) => setDraftVolumes((current) => ({ ...current, [file.id]: Number(event.target.value) }))}
                                onPointerUp={() => commitVolume(file.id)}
                                onKeyUp={() => commitVolume(file.id)}
                                onBlur={() => commitVolume(file.id)}
                              />
                              <strong>{draftVolumes[file.id] ?? Math.round(file.volume * 100)}%</strong>
                            </label>
                            <button type="button" onClick={() => togglePreview(file)}>
                              {previewFileId === file.id ? 'Arrêter' : 'Écouter'}
                            </button>
                            <button
                              type="button"
                              className="danger-ghost"
                              disabled={removeMutation.isPending}
                              onClick={() => removeMutation.mutate(file.id)}
                            >
                              Supprimer
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="cabin-announcement-actions">
                      <select
                        value={variant}
                        aria-label={`Période du nouveau fichier pour ${definition.label}`}
                        onChange={(event) => setNewVariants((current) => ({
                          ...current,
                          [definition.type]: event.target.value as CabinAnnouncementVariant
                        }))}
                      >
                        {CABIN_ANNOUNCEMENT_VARIANTS.map((option) => (
                          <option key={option} value={option}>{CABIN_ANNOUNCEMENT_VARIANT_LABEL[option]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={typeFiles.length === 0 ? 'primary' : ''}
                        disabled={importMutation.isPending}
                        onClick={() => companyId !== null && importMutation.mutate({ selectedCompanyId: companyId, type: definition.type, variant })}
                      >
                        {importing ? 'Import…' : 'Ajouter un fichier'}
                      </button>
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
