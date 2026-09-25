import { createHashRouter } from 'react-router-dom'
import { AppLayout } from '@renderer/AppLayout'
import { HomePage } from '@renderer/pages/Home/HomePage'
import { BookingPage } from '@renderer/pages/Booking/BookingPage'
import { CalendarPage } from '@renderer/pages/Calendar/CalendarPage'
import { LiveTrackingPage } from '@renderer/pages/LiveTracking/LiveTrackingPage'
import { PirepsPage } from '@renderer/pages/Pireps/PirepsPage'
import { FleetPage } from '@renderer/pages/Fleet/FleetPage'
import { StatisticsPage } from '@renderer/pages/Statistics/StatisticsPage'
import { SettingsPage } from '@renderer/pages/Settings/SettingsPage'

export const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/reservation', element: <BookingPage /> },
      { path: '/calendrier', element: <CalendarPage /> },
      { path: '/suivi', element: <LiveTrackingPage /> },
      { path: '/pireps', element: <PirepsPage /> },
      { path: '/flotte', element: <FleetPage /> },
      { path: '/statistiques', element: <StatisticsPage /> },
      { path: '/parametres', element: <SettingsPage /> }
    ]
  }
])
