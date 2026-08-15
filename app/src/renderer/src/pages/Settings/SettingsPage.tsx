import { useEffect, useState } from 'react'
import { ThemeToggle } from '@renderer/components/ThemeToggle'
import { useSimbriefUserId, useSetSimbriefUserId } from '@renderer/hooks/useSimbriefUserId'
import { useAerodataboxApiKey, useSetAerodataboxApiKey } from '@renderer/hooks/useAerodataboxApiKey'

export function SettingsPage() {
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

      <section className="settings-section">
        <h2>Apparence</h2>
        <p>Choisissez le thème de l'application.</p>
        <ThemeToggle />
      </section>

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
    </div>
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
