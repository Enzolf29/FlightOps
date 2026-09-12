import type { GsxCostStats } from './gsxReceipt'

export interface MonthlyHoursPoint {
  month: string
  hours: number
}

export interface CompanyFlightCount {
  companyIcao: string
  companyName: string
  count: number
}

export interface AircraftTypeFlightCount {
  type: string
  count: number
}

export interface RouteFlightCount {
  departureIcao: string
  arrivalIcao: string
  count: number
}

export interface PunctualityBreakdown {
  onTime: number
  delayed10to60: number
  delayed60Plus: number
  cancelled: number
}

export interface MonthlyLandingRatePoint {
  month: string
  averageFpm: number
  count: number
}

export interface LandingRateCategoryCount {
  category: string
  label: string
  count: number
}

export interface LandingRateStats {
  averageFpm: number | null
  smoothestFpm: number | null
  hardestFpm: number | null
  hardLandingCount: number
  recordedCount: number
  monthlyAverages: MonthlyLandingRatePoint[]
  categoryBreakdown: LandingRateCategoryCount[]
}

export interface PunctualityExtremeFlight {
  flightId: number
  flightNumber: string
  departureIcao: string
  arrivalIcao: string
  delayMinutes: number
  arrivalTime: string | null
}

export interface PunctualityExtremes {
  averageDelayMinutes: number | null
  mostDelayed: PunctualityExtremeFlight | null
  mostEarly: PunctualityExtremeFlight | null
}

export interface CompanyProfitBreakdown {
  companyIcao: string
  companyName: string
  revenueEur: number
  costEur: number
  profitEur: number
}

export interface ProfitStats {
  totalRevenueEur: number
  totalCostEur: number
  totalProfitEur: number
  /** Nombre de vols avec un revenu connu (mode économie), tous compagnies confondues. */
  flightsWithRevenue: number
  byCompany: CompanyProfitBreakdown[]
}

export interface StatisticsOverview {
  totalFlights: number
  cumulativeHours: number
  monthlyHours: MonthlyHoursPoint[]
  byCompany: CompanyFlightCount[]
  byAircraftType: AircraftTypeFlightCount[]
  topRoutes: RouteFlightCount[]
  punctuality: PunctualityBreakdown
  punctualityExtremes: PunctualityExtremes
  landingRate: LandingRateStats
  gsxCosts: GsxCostStats
  profit: ProfitStats
}
