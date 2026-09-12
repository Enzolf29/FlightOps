import { useEffect, useState } from 'react'
import type { AppUpdateStatus } from '@shared/types/appUpdate'

/** État courant de la mise à jour, poussé par le processus main (voir appUpdater.ts) — partagé
 * entre les paramètres et la barre latérale pour éviter deux abonnements indépendants. */
export function useAppUpdateStatus(): AppUpdateStatus | null {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)

  useEffect(() => {
    void window.flightops.updates.getStatus().then(setStatus)
    return window.flightops.updates.onStatusChange(setStatus)
  }, [])

  return status
}
