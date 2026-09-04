import { useEffect, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { LiveMap } from './LiveMap'
import type { PirepTelemetrySample } from '@shared/types/pirep'
import type { OfpDetail } from '@shared/simbrief/parseOfpDetail'
import { parseUtc } from '@shared/lib/datetime'

interface PirepReplayProps {
  pirepId: number
  callsign: string
  samples: PirepTelemetrySample[]
  ofp: OfpDetail | null | undefined
}

export function PirepReplay({ pirepId, callsign, samples, ofp }: PirepReplayProps) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const sample = samples[Math.min(index, samples.length - 1)]

  useEffect(() => {
    if (!playing || samples.length < 2) return
    const timer = setInterval(() => {
      setIndex((current) => {
        if (current >= samples.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 250)
    return () => clearInterval(timer)
  }, [playing, samples.length])

  if (!sample) return <p className="empty-hint">Relecture indisponible pour ce vol ancien.</p>

  return (
    <div className="pirep-replay">
      <LiveMap
        resetKey={`replay-${pirepId}`}
        origin={ofp?.origin ?? null}
        destination={ofp?.destination ?? null}
        alternate={ofp?.alternate ?? null}
        navlog={ofp?.navlog ?? []}
        telemetry={null}
        staticTrail={samples.slice(0, index + 1).map((point) => [point.latitude, point.longitude])}
        replayPosition={{ lat: sample.latitude, lon: sample.longitude, headingTrue: sample.headingTrue, label: callsign }}
      />
      <div className="replay-controls">
        <button type="button" className="primary" onClick={() => {
          if (index >= samples.length - 1) setIndex(0)
          setPlaying((value) => !value)
        }}>
          {playing ? 'Pause' : index >= samples.length - 1 ? 'Recommencer' : 'Lire le vol'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, samples.length - 1)}
          value={index}
          onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)) }}
          aria-label="Position dans la relecture"
        />
        <strong>{formatInTimeZone(parseUtc(sample.timeIso), 'UTC', 'HH:mm:ss')} UTC</strong>
      </div>
      <div className="replay-values">
        <span>Altitude <strong>{Math.round(sample.altitudeFeet)} ft</strong></span>
        <span>AGL <strong>{Math.round(sample.altitudeAglFeet)} ft</strong></span>
        <span>Vitesse <strong>{Math.round(sample.groundSpeedKt)} kt</strong></span>
        <span>V/S <strong>{Math.round(sample.verticalSpeedFpm)} ft/min</strong></span>
        <span>Carburant <strong>{Math.round(sample.fuelKg)} kg</strong></span>
      </div>
    </div>
  )
}
