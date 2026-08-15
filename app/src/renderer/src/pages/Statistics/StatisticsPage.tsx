import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { fr } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'
import { useStatistics } from '@renderer/hooks/useStatistics'
import { StatGrid } from '@renderer/components/StatGrid'
import { ArrowUpDownIcon } from '@renderer/components/icons'
import { formatHours, parseUtc } from '@renderer/lib/format'
import { HARD_LANDING_VS_FPM } from '@shared/flightStatus/evaluateFlightEvents'
import { formatDelayDuration } from '@shared/flightStatus/formatDelayDuration'

const PUNCTUALITY_COLORS = {
  onTime: 'var(--status-on-time)',
  delayed10to60: 'var(--status-delayed-mid)',
  delayed60Plus: 'var(--status-delayed-high)',
  cancelled: 'var(--status-cancelled)'
}

const LANDING_CATEGORY_COLORS: Record<string, string> = {
  very_smooth: 'var(--status-on-time)',
  smooth: '#2fb170',
  normal: 'var(--accent)',
  firm: '#e0a72c',
  hard: 'var(--status-delayed-mid)',
  very_hard: 'var(--status-delayed-high)'
}

function delaySignLabel(delayMinutes: number): string {
  const sign = delayMinutes < 0 ? 'avance' : 'retard'
  return `${sign} de ${formatDelayDuration(delayMinutes)}`
}

export function StatisticsPage() {
  const { data, isLoading } = useStatistics()

  if (isLoading || !data) {
    return <p className="page-loading">Chargement…</p>
  }

  const hasFlights = data.totalFlights > 0

  const monthlyHoursData = data.monthlyHours.map((point) => ({
    month: formatInTimeZone(new Date(`${point.month}-01T00:00:00Z`), 'UTC', 'MMM yyyy', { locale: fr }),
    hours: Math.round(point.hours * 10) / 10
  }))

  const routesData = data.topRoutes.map((route) => ({
    route: `${route.departureIcao} → ${route.arrivalIcao}`,
    count: route.count
  }))

  const punctualityData = [
    { key: 'onTime', label: 'À l’heure', value: data.punctuality.onTime },
    { key: 'delayed10to60', label: 'Retardé', value: data.punctuality.delayed10to60 },
    { key: 'delayed60Plus', label: 'En retard', value: data.punctuality.delayed60Plus },
    { key: 'cancelled', label: 'Annulé', value: data.punctuality.cancelled }
  ].filter((entry) => entry.value > 0)

  const landingRateData = data.landingRate.history.map((point, index) => ({
    label: formatInTimeZone(parseUtc(point.arrivalTime), 'UTC', 'dd/MM', { locale: fr }),
    index: index + 1,
    fpm: Math.round(point.verticalSpeedFpm)
  }))

  const landingCategoryData = data.landingRate.categoryBreakdown
    .map((entry) => ({ key: entry.category, label: entry.label, value: entry.count }))
    .filter((entry) => entry.value > 0)

  return (
    <div className="fleet-page">
      <h1>Statistiques</h1>

      {!hasFlights ? (
        <p className="empty-hint">Terminez des vols pour voir vos statistiques apparaître ici.</p>
      ) : (
        <>
          <StatGrid
            items={[
              { key: 'flights', label: 'Vols terminés', value: data.totalFlights },
              { key: 'hours', label: 'Heures cumulées', value: formatHours(data.cumulativeHours) }
            ]}
          />

          <section className="home-section">
            <h2>Heures dans le temps</h2>
            {monthlyHoursData.length > 0 ? (
              <div className="pirep-chart-wrapper">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyHoursData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={40} />
                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                    <Bar dataKey="hours" name="Heures" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="empty-hint">Aucune donnée pour l’instant.</p>
            )}
          </section>

          <section className="home-section">
            <h2>Vols par compagnie</h2>
            <div className="pirep-chart-wrapper">
              <ResponsiveContainer width="100%" height={Math.max(180, data.byCompany.length * 36)}>
                <BarChart data={data.byCompany} layout="vertical" margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                  <YAxis dataKey="companyIcao" type="category" tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={60} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                  <Bar dataKey="count" name="Vols" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="home-section">
            <h2>Vols par avion</h2>
            {data.byAircraftType.length > 0 ? (
              <div className="pirep-chart-wrapper">
                <ResponsiveContainer width="100%" height={Math.max(180, data.byAircraftType.length * 36)}>
                  <BarChart data={data.byAircraftType} layout="vertical" margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                    <YAxis dataKey="type" type="category" tick={{ fontSize: 12 }} stroke="var(--text-muted)" width={90} />
                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                    <Bar dataKey="count" name="Vols" fill="#2fb170" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="empty-hint">Aucune donnée pour l’instant.</p>
            )}
          </section>

          <section className="home-section">
            <h2>Routes les plus fréquentes</h2>
            <div className="pirep-chart-wrapper">
              <ResponsiveContainer width="100%" height={Math.max(180, routesData.length * 32)}>
                <BarChart data={routesData} layout="vertical" margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                  <YAxis dataKey="route" type="category" tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={110} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                  <Bar dataKey="count" name="Vols" fill="#e0a72c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="home-section">
            <h2>Ponctualité</h2>
            <div className="stats-with-chart">
              <StatGrid
                compact
                items={[
                  {
                    key: 'avgDelay',
                    label: 'Retard / avance moyen',
                    value:
                      data.punctualityExtremes.averageDelayMinutes !== null
                        ? delaySignLabel(data.punctualityExtremes.averageDelayMinutes)
                        : '—'
                  },
                  {
                    key: 'mostDelayed',
                    label: 'Vol le plus en retard',
                    value: data.punctualityExtremes.mostDelayed
                      ? `${data.punctualityExtremes.mostDelayed.flightNumber} — ${delaySignLabel(data.punctualityExtremes.mostDelayed.delayMinutes)}`
                      : 'Aucun vol en retard',
                    muted: !data.punctualityExtremes.mostDelayed
                  },
                  {
                    key: 'mostEarly',
                    label: 'Vol le plus en avance',
                    value: data.punctualityExtremes.mostEarly
                      ? `${data.punctualityExtremes.mostEarly.flightNumber} — ${delaySignLabel(data.punctualityExtremes.mostEarly.delayMinutes)}`
                      : 'Aucun vol en avance',
                    muted: !data.punctualityExtremes.mostEarly
                  }
                ]}
              />
              <div className="pirep-chart-wrapper">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={punctualityData} dataKey="value" nameKey="label" innerRadius={60} outerRadius={100} paddingAngle={2}>
                      {punctualityData.map((entry) => (
                        <Cell key={entry.key} fill={PUNCTUALITY_COLORS[entry.key as keyof typeof PUNCTUALITY_COLORS]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="home-section">
            <h2>Taux d’atterrissage</h2>
            {data.landingRate.recordedCount > 0 ? (
              <>
                <div className="stats-with-chart">
                  <StatGrid
                    compact
                    items={[
                      {
                        key: 'average',
                        label: 'Atterrissage moyen',
                        value: data.landingRate.averageFpm !== null ? `${Math.round(data.landingRate.averageFpm)} ft/min` : '—',
                        icon: <ArrowUpDownIcon />
                      },
                      {
                        key: 'smoothest',
                        label: 'Atterrissage le plus doux',
                        value: data.landingRate.smoothestFpm !== null ? `${Math.round(data.landingRate.smoothestFpm)} ft/min` : '—',
                        icon: <ArrowUpDownIcon />
                      },
                      {
                        key: 'hardest',
                        label: 'Atterrissage le plus dur',
                        value: data.landingRate.hardestFpm !== null ? `${Math.round(data.landingRate.hardestFpm)} ft/min` : '—',
                        icon: <ArrowUpDownIcon />
                      }
                    ]}
                  />

                  {landingCategoryData.length > 0 ? (
                    <div className="pirep-chart-wrapper">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={landingCategoryData}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                          >
                            {landingCategoryData.map((entry) => (
                              <Cell key={entry.key} fill={LANDING_CATEGORY_COLORS[entry.key]} />
                            ))}
                          </Pie>
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                </div>

                {landingRateData.length > 1 ? (
                  <div className="pirep-chart-wrapper">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={landingRateData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="var(--text-muted)" width={50} />
                        <ReferenceLine y={HARD_LANDING_VS_FPM} stroke="var(--status-delayed-high)" strokeDasharray="4 4" />
                        <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
                        <Line type="monotone" dataKey="fpm" name="Vitesse verticale (ft/min)" stroke="var(--accent)" dot />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="empty-hint">Aucune donnée d’atterrissage enregistrée pour l’instant.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
