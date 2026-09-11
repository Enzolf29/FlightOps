import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AppUpdateStatus, ReleaseChangelog } from '@shared/types/appUpdate'

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

export function useReleaseChangelog(enabled: boolean) {
  return useQuery<ReleaseChangelog>({
    queryKey: ['updates', 'changelog'],
    queryFn: () => window.flightops.updates.getChangelog(),
    enabled
  })
}
