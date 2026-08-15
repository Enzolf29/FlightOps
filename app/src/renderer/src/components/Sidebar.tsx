import { NavLink } from 'react-router-dom'
import { useThemeStore } from '@renderer/stores/themeStore'
import {
  MoonIcon,
  SunIcon,
  GearIcon,
  HomeIcon,
  TicketIcon,
  CalendarIcon,
  RadarIcon,
  ClipboardIcon,
  FleetIcon,
  BarChartIcon,
  PlaneRightIcon
} from '@renderer/components/icons'

const NAV_ITEMS = [
  { to: '/', label: 'Accueil', end: true, icon: HomeIcon },
  { to: '/reservation', label: 'Réservation', icon: TicketIcon },
  { to: '/calendrier', label: 'Calendrier', icon: CalendarIcon },
  { to: '/suivi', label: 'Suivi en direct', icon: RadarIcon },
  { to: '/pireps', label: 'PIREPs', icon: ClipboardIcon },
  { to: '/flotte', label: 'Flotte', icon: FleetIcon },
  { to: '/statistiques', label: 'Statistiques', icon: BarChartIcon }
]

export function Sidebar() {
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">
          <PlaneRightIcon size={16} />
        </span>
        FlightOps
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'sidebar-nav-link' + (isActive ? ' active' : '')}
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={'sidebar-icon-btn' + (theme === 'dark' ? ' active' : '')}
          aria-label="Thème sombre"
          title="Thème sombre"
          onClick={() => setTheme('dark')}
        >
          <MoonIcon />
        </button>
        <button
          type="button"
          className={'sidebar-icon-btn' + (theme === 'light' ? ' active' : '')}
          aria-label="Thème clair"
          title="Thème clair"
          onClick={() => setTheme('light')}
        >
          <SunIcon />
        </button>
        <NavLink
          to="/parametres"
          aria-label="Paramètres"
          title="Paramètres"
          className={({ isActive }) => 'sidebar-icon-btn' + (isActive ? ' active' : '')}
        >
          <GearIcon />
        </NavLink>
      </div>
    </aside>
  )
}
