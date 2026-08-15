import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from '@renderer/components/Sidebar'
import { useThemeStore } from '@renderer/stores/themeStore'
import { useSimConnectStatus } from '@renderer/hooks/useSimConnect'

export function AppLayout() {
  const ready = useThemeStore((state) => state.ready)
  const init = useThemeStore((state) => state.init)
  const status = useSimConnectStatus()
  const queryClient = useQueryClient()

  useEffect(() => {
    init()
  }, [init])

  // Pas de canal dédié "statut de vol modifié" : tant que SimConnect est connecté, on rafraîchit
  // périodiquement les vols/PIREPs pour refléter les transitions décollage/atterrissage détectées
  // côté main — quelle que soit la page affichée, pas seulement le Suivi de vol en direct.
  useEffect(() => {
    if (status !== 'connected') return
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['flights'] })
      queryClient.invalidateQueries({ queryKey: ['home', 'dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['simconnect', 'armedFlightId'] })
      queryClient.invalidateQueries({ queryKey: ['pireps'] })
    }, 5000)
    return () => clearInterval(interval)
  }, [status, queryClient])

  if (!ready) {
    return null
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
