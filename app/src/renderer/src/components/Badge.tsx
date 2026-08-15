interface BadgeProps {
  label: string
  variant: string
}

export function Badge({ label, variant }: BadgeProps) {
  return <span className={`badge ${variant}`}>{label}</span>
}
