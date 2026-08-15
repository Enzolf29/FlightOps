import { useNavigate } from 'react-router-dom'
import { useHomeDashboard } from '@renderer/hooks/useHomeDashboard'
import { RankProgress } from '@renderer/components/RankProgress'
import { FlightCard } from '@renderer/components/FlightCard'
import { FlightListRow } from '@renderer/components/FlightListRow'
import { PirepListRow } from '@renderer/components/PirepListRow'
import { formatHours } from '@renderer/lib/format'

export function HomePage() {
  const { data, isLoading, isError } = useHomeDashboard()
  const navigate = useNavigate()

  if (isLoading) {
    return <p className="page-loading">Chargement…</p>
  }

  if (isError || !data) {
    return <p className="page-loading">Impossible de charger le tableau de bord.</p>
  }

  const { pilot, currentFlight, nextFlight, upcomingFlights, recentPireps } = data

  return (
    <div className="home-page">
      <h1>Accueil</h1>

      <section className="profile-card">
        <div className="profile-card-identity">
          <span className="profile-card-name">{pilot.displayName}</span>
          <RankProgress rank={pilot.rank} />
        </div>
        <div className="profile-card-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">{formatHours(pilot.cumulativeHours)}</span>
            <span className="profile-stat-label">Heures de vol</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">{pilot.totalFlights}</span>
            <span className="profile-stat-label">Vols effectués</span>
          </div>
        </div>
      </section>

      <div className="home-flight-cards">
        {currentFlight ? (
          <FlightCard title="Vol en cours" flight={currentFlight} onClick={() => navigate('/suivi')} />
        ) : (
          <div className="flight-card flight-card-empty">
            <span className="flight-card-title">Vol en cours</span>
            <p>Aucun vol en cours actuellement.</p>
          </div>
        )}

        {nextFlight ? (
          <FlightCard title="Vol suivant" flight={nextFlight} />
        ) : (
          <div className="flight-card flight-card-empty">
            <span className="flight-card-title">Vol suivant</span>
            <p>Aucun vol réservé pour le moment.</p>
          </div>
        )}
      </div>

      <section className="home-section">
        <h2>Autres vols à venir</h2>
        {upcomingFlights.length > 0 ? (
          <div className="list">
            {upcomingFlights.map((flight) => (
              <FlightListRow key={flight.id} flight={flight} />
            ))}
          </div>
        ) : (
          <p className="empty-hint">Aucun autre vol à venir.</p>
        )}
      </section>

      <section className="home-section">
        <h2>Derniers PIREPs</h2>
        {recentPireps.length > 0 ? (
          <div className="list">
            {recentPireps.map((pirep) => (
              <PirepListRow key={pirep.id} pirep={pirep} />
            ))}
          </div>
        ) : (
          <p className="empty-hint">Aucun PIREP pour le moment.</p>
        )}
      </section>
    </div>
  )
}
