import type { ReactNode } from 'react'

export interface StatItem {
  key: string
  label: string
  value: ReactNode
  icon?: ReactNode
  muted?: boolean
  detail?: ReactNode
}

interface StatGridProps {
  items: StatItem[]
  compact?: boolean
}

export function StatGrid({ items, compact = false }: StatGridProps) {
  return (
    <div className={compact ? 'stat-grid stat-grid--compact' : 'stat-grid'}>
      {items.map((item) => (
        <div className="stat-card" key={item.key}>
          <span className="stat-card-label">
            {item.icon ? <span className="stat-card-icon">{item.icon}</span> : null}
            {item.label}
          </span>
          <span className={item.muted ? 'stat-card-value stat-card-value--muted' : 'stat-card-value'}>{item.value}</span>
          {item.detail ? <span className="stat-card-detail">{item.detail}</span> : null}
        </div>
      ))}
    </div>
  )
}
