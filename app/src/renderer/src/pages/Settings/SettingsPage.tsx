import { useEffect, useState } from 'react'
import { ThemeToggle } from '@renderer/components/ThemeToggle'
import { useSimbriefUserId, useSetSimbriefUserId } from '@renderer/hooks/useSimbriefUserId'
import { useAerodataboxApiKey, useSetAerodataboxApiKey } from '@renderer/hooks/useAerodataboxApiKey'
import { CabinAnnouncementsSettings } from '@renderer/components/CabinAnnouncementsSettings'
import type { TabletServerInfo } from '@shared/types/tablet'
import type { AppUpdateStatus } from '@shared/types/appUpdate'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'cabin'>('general')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDeleteAllData() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await window.flightops.app.deleteAllData()
      window.location.reload()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Échec de la suppression.')
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <div className="settings-page">
      <h1>Paramètres</h1>

      <div className="tabs settings-tabs" role="tablist" aria-label="Sections des paramètres">
        <button type="button" className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>
          Général
        </button>
        <button type="button" className={activeTab === 'cabin' ? 'active' : ''} onClick={() => setActiveTab('cabin')}>
          Annonces cabine
        </button>
      </div>

      {activeTab === 'cabin' ? <CabinAnnouncementsSettings /> : <>

      <section className="settings-section">
        <h2>Apparence</h2>
        <p>Choisissez le thème de l'application.</p>
        <ThemeToggle />
      </section>

      <TabletCompanionSection />

      <AppUpdateSection />

      <SimbriefSection />

      <AerodataboxSection />

      <section className="settings-section settings-section--danger">
        <h2>Réinitialisation</h2>
        <p>Supprime définitivement toutes les données locales (profil, vols, flotte, PIREPs, paramètres).</p>
        {deleteError ? <p className="form-error">{deleteError}</p> : null}
        {confirmingDelete ? (
          <div className="settings-danger-confirm">
            <span>Cette action est irréversible. Confirmer ?</span>
            <button type="button" disabled={deleting} onClick={handleDeleteAllData}>
              {deleting ? 'Suppression…' : 'Oui, tout supprimer'}
            </button>
            <button type="button" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>
            Supprimer toutes les données
          </button>
        )}
      </section>
      </>}
    </div>
  )
}

function AppUpdateSection() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)

  useEffect(() => {
    void window.flightops.updates.getStatus().then(setStatus)
    return window.flightops.updates.onStatusChange(setStatus)
  }, [])

  const busy = status?.phase === 'checking' || status?.phase === 'downloading' || status?.phase === 'available'
  const progress = status?.downloadPercent ?? 0

  return (
    <section className="settings-section update-settings">
      <div className="update-settings-heading">
        <div>
          <h2>Mises à jour</h2>
          <p>FlightOps vérifie automatiquement les nouvelles versions publiées sur GitHub.</p>
        </div>
        <span className={'update-status-badge update-status-badge--' + (status?.phase ?? 'idle')}>
          Version {status?.currentVersion ?? '—'}
        </span>
      </div>

      <div className="update-status-row">
        <div>
          <strong>{status?.message ?? 'Chargement de l’état…'}</strong>
          {status?.availableVersion ? <small>Nouvelle version : {status.availableVersion}</small> : null}
        </div>
        {status?.phase === 'downloaded' ? (
          <button type="button" className="primary" onClick={() => window.flightops.updates.install()}>
            Redémarrer et installer
          </button>
        ) : (
          <button type="button" disabled={busy || status?.phase === 'disabled'} onClick={() => window.flightops.updates.check()}>
            {busy ? 'Vérification…' : 'Vérifier maintenant'}
          </button>
        )}
      </div>
      {status?.phase === 'downloading' || status?.phase === 'available' ? (
        <div className="update-progress" aria-label={`Téléchargement ${Math.round(progress)} %`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <p className="update-preserve-note">Une mise à jour conserve la flotte, les vols, les PIREPs, les réglages et les annonces cabine stockés sur ce PC.</p>
    </section>
  )
}

function TabletCompanionSection() {
  const [info, setInfo] = useState<TabletServerInfo | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const refresh = () => {
      window.flightops.tablet.getServerInfo().then((next) => {
        if (active) setInfo(next)
      })
    }
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  async function copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value)
    setCopied(value)
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <section className="settings-section tablet-settings">
      <div className="tablet-settings-heading">
        <div>
          <h2>Interface tablette</h2>
          <p>Ouvrez FlightOps depuis le navigateur d’une tablette connectée au même Wi-Fi que ce PC.</p>
        </div>
        <span className={'tablet-server-badge' + (info?.running ? ' tablet-server-badge--online' : '')}>
          {info?.running ? 'Disponible' : 'Démarrage…'}
        </span>
      </div>

      <div className="tablet-pairing-grid">
        <div className="tablet-pin-card">
          <span>Code d’appairage</span>
          <strong>{info?.pin ?? '••••••'}</strong>
          <small>Nouveau code à chaque lancement de FlightOps</small>
        </div>
        <div className="tablet-addresses">
          <span>Adresse à saisir sur la tablette</span>
          {info?.urls.length ? info.urls.map((url) => (
            <button key={url} type="button" onClick={() => copy(url)}>
              <code>{url}</code>
              <small>{copied === url ? 'Copié ✓' : 'Copier'}</small>
            </button>
          )) : <p className="empty-hint">Aucune adresse réseau détectée.</p>}
        </div>
      </div>
      <div className="tablet-help">
        <span>① Gardez FlightOps ouvert</span>
        <span>② Ouvrez l’adresse sur la tablette</span>
        <span>③ Entrez le code à 6 chiffres</span>
      </div>
      <p className="tablet-network-note">
        L’interface est locale uniquement. Au premier lancement, Windows peut demander d’autoriser FlightOps sur les réseaux privés : acceptez pour permettre la connexion de la tablette.
        {info?.connectedClients ? ` ${info.connectedClients} tablette${info.connectedClients > 1 ? 's' : ''} connectée${info.connectedClients > 1 ? 's' : ''}.` : ''}
      </p>
    </section>
  )
}

function SimbriefSection() {
  const { data: simbriefUserId, isLoading } = useSimbriefUserId()
  const setSimbriefUserId = useSetSimbriefUserId()
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (simbriefUserId !== undefined && simbriefUserId !== null) {
      setValue(simbriefUserId)
    }
  }, [simbriefUserId])

  function handleSave() {
    setSaved(false)
    setSimbriefUserId
      .mutateAsync(value.trim() || null)
      .then(() => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      })
  }

  return (
    <section className="settings-section">
      <h2>SimBrief</h2>
      <p>
        Renseignez votre ID (ou pseudo) SimBrief pour importer vos plans de vol. Vous le trouvez sur{' '}
        <button
          type="button"
          className="settings-link"
          onClick={() => window.flightops.app.openExternal('https://www.simbrief.com/system/profile.php')}
        >
          votre profil SimBrief
        </button>
        .
      </p>
      {isLoading ? (
        <p className="empty-hint">Chargement…</p>
      ) : (
        <div className="settings-inline-field">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="ID ou pseudo SimBrief"
          />
          <button type="button" className="primary" onClick={handleSave} disabled={setSimbriefUserId.isPending}>
            {setSimbriefUserId.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saved ? <span className="settings-saved-hint">Enregistré ✓</span> : null}
        </div>
      )}
    </section>
  )
}

function AerodataboxSection() {
  const { data: apiKey, isLoading } = useAerodataboxApiKey()
  const setApiKey = useSetAerodataboxApiKey()
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (apiKey !== undefined && apiKey !== null) {
      setValue(apiKey)
    }
  }, [apiKey])

  function handleSave() {
    setSaved(false)
    setApiKey.mutateAsync(value.trim() || null).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <section className="settings-section">
      <h2>API vols réels (AeroDataBox)</h2>
      <p>
        Renseignez votre clé API AeroDataBox (RapidAPI) pour rechercher les vols réels par compagnie et aéroport
        dans l'onglet Réservation. Vous pouvez en obtenir une sur{' '}
        <button
          type="button"
          className="settings-link"
          onClick={() => window.flightops.app.openExternal('https://rapidapi.com/aedbx-aedbx/api/aerodatabox')}
        >
          le marketplace RapidAPI
        </button>
        .
      </p>
      {isLoading ? (
        <p className="empty-hint">Chargement…</p>
      ) : (
        <div className="settings-inline-field">
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Clé API AeroDataBox"
          />
          <button type="button" className="primary" onClick={handleSave} disabled={setApiKey.isPending}>
            {setApiKey.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {saved ? <span className="settings-saved-hint">Enregistré ✓</span> : null}
        </div>
      )}
    </section>
  )
}
