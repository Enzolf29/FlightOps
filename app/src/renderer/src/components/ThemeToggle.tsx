import { useThemeStore } from '@renderer/stores/themeStore'

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Thème">
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        className={theme === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
      >
        Clair
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
      >
        Sombre
      </button>
    </div>
  )
}
