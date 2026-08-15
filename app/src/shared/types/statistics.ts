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

export interface LandingRatePoint {
  arrivalTime: string
  verticalSpeedFpm: number
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
  history: LandingRatePoint[]
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
}
