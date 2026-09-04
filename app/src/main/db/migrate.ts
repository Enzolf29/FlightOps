import type Database from 'better-sqlite3'
import migration001 from './migrations/001_init.sql?raw'
import migration002 from './migrations/002_schema.sql?raw'
import migration003 from './migrations/003_seed_ranks.sql?raw'
import migration004 from './migrations/004_seed_companies.sql?raw'
import migration005 from './migrations/005_seed_demo_data.sql?raw'
import migration006 from './migrations/006_companies_random_pattern.sql?raw'
import migration007 from './migrations/007_aircraft_simbrief_fin.sql?raw'
import migration008 from './migrations/008_flights_alternate.sql?raw'
import migration009 from './migrations/009_pirep_enriched.sql?raw'
import migration010 from './migrations/010_pirep_fuel_kg.sql?raw'
import migration011 from './migrations/011_aircraft_mode_s.sql?raw'
import migration012 from './migrations/012_real_routes.sql?raw'
import migration013 from './migrations/013_airport_coordinates.sql?raw'
import migration014 from './migrations/014_drop_airport_coordinates.sql?raw'
import migration015 from './migrations/015_pirep_touchdown_airspeed.sql?raw'
import migration016 from './migrations/016_flight_recorder.sql?raw'
import migration017 from './migrations/017_telemetry_replay_details.sql?raw'
import migration018 from './migrations/018_cabin_announcements.sql?raw'
import migration019 from './migrations/019_cabin_announcement_volume.sql?raw'
import migration020 from './migrations/020_real_route_observations.sql?raw'

interface Migration {
  version: number
  sql: string
}

const MIGRATIONS: Migration[] = [
  { version: 1, sql: migration001 },
  { version: 2, sql: migration002 },
  { version: 3, sql: migration003 },
  { version: 4, sql: migration004 },
  { version: 5, sql: migration005 },
  { version: 6, sql: migration006 },
  { version: 7, sql: migration007 },
  { version: 8, sql: migration008 },
  { version: 9, sql: migration009 },
  { version: 10, sql: migration010 },
  { version: 11, sql: migration011 },
  { version: 12, sql: migration012 },
  { version: 13, sql: migration013 },
  { version: 14, sql: migration014 },
  { version: 15, sql: migration015 },
  { version: 16, sql: migration016 },
  { version: 17, sql: migration017 },
  { version: 18, sql: migration018 },
  { version: 19, sql: migration019 },
  { version: 20, sql: migration020 }
]

export function runMigrations(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  )

  const appliedVersions = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => (row as { version: number }).version)
  )

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue

    // Off during the migration: some migrations recreate tables (SQLite can't ALTER a CHECK
    // constraint in place), which would otherwise trip FK checks on referencing tables.
    db.pragma('foreign_keys = OFF')
    const applyMigration = db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version)
    })
    applyMigration()
    db.pragma('foreign_keys = ON')
  }
}
