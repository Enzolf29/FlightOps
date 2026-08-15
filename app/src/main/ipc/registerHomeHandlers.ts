import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc/contract'
import type { HomeDashboard } from '@shared/types/home'
import { computeRank } from '@shared/rank/computeRank'
import { getAllRanks } from '../db/repositories/rankRepository'
import { getPilot } from '../db/repositories/pilotRepository'
import { getCurrentFlight, getNextFlight, getUpcomingFlights } from '../db/repositories/flightRepository'
import { getRecentPireps, getCumulativeStats } from '../db/repositories/pirepRepository'

const UPCOMING_FLIGHTS_LIMIT = 5
const RECENT_PIREPS_LIMIT = 5

function buildDashboard(): HomeDashboard {
  const pilot = getPilot()
  const ranks = getAllRanks()
  const { cumulativeHours, totalFlights } = getCumulativeStats()

  const currentFlight = getCurrentFlight()
  const nextFlight = getNextFlight()
  const upcomingFlights = getUpcomingFlights(nextFlight?.id ?? null, UPCOMING_FLIGHTS_LIMIT)
  const recentPireps = getRecentPireps(RECENT_PIREPS_LIMIT)

  return {
    pilot: {
      displayName: pilot.display_name,
      simbriefUserId: pilot.simbrief_user_id,
      cumulativeHours,
      totalFlights,
      rank: computeRank(ranks, cumulativeHours)
    },
    currentFlight,
    nextFlight,
    upcomingFlights,
    recentPireps
  }
}

export function registerHomeHandlers(): void {
  ipcMain.handle(IPC.home.getDashboard, () => buildDashboard())
}
