import type { RankStatus } from '@shared/types/rank'
import { formatHours } from '@renderer/lib/format'

interface RankProgressProps {
  rank: RankStatus
}

export function RankProgress({ rank }: RankProgressProps) {
  return (
    <div className="rank-progress">
      <div className="rank-progress-header">
        <span className="rank-progress-current">{rank.current.name}</span>
        {rank.next ? (
          <span className="rank-progress-next">
            {formatHours(rank.hoursRemaining)} avant {rank.next.name}
          </span>
        ) : (
          <span className="rank-progress-next">Rang maximum atteint</span>
        )}
      </div>
      <div className="rank-progress-bar">
        <div className="rank-progress-bar-fill" style={{ width: `${rank.progressToNextPct}%` }} />
      </div>
    </div>
  )
}
