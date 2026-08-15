import { create } from 'zustand'
import type { Theme } from '@shared/types/settings'

interface ThemeState {
  theme: Theme
  ready: boolean
  init: () => Promise<void>
  setTheme: (theme: Theme) => Promise<void>
}

function applyThemeToDocument(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',
  ready: false,
  init: async () => {
    const settings = await window.flightops.settings.get()
    applyThemeToDocument(settings.theme)
    set({ theme: settings.theme, ready: true })
  },
  setTheme: async (theme) => {
    applyThemeToDocument(theme)
    set({ theme })
    await window.flightops.settings.set('theme', theme)
  }
}))
