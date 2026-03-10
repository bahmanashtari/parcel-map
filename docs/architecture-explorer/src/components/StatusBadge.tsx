import type { BuildState } from '../types'

type Props = {
  state: BuildState
}

const LABELS: Record<BuildState, string> = {
  implemented: 'Implemented',
  partial: 'Partial',
  planned: 'Planned',
}

export function StatusBadge({ state }: Props) {
  return <span className={`status-badge status-${state}`}>{LABELS[state]}</span>
}
