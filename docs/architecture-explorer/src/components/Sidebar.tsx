import type { BuildState } from '../types'
import { StatusBadge } from './StatusBadge'

type NavItem = {
  id: string
  title: string
  state: BuildState
}

type Props = {
  items: NavItem[]
  activeId: string
  onSelect: (id: string) => void
}

export function Sidebar({ items, activeId, onSelect }: Props) {
  const implementedCount = items.filter((item) => item.state === 'implemented').length
  const partialCount = items.filter((item) => item.state === 'partial').length
  const plannedCount = items.filter((item) => item.state === 'planned').length

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Architecture Explorer</h1>
        <p>parcel-map internal system map</p>
      </div>

      <nav className="sidebar-nav" aria-label="Architecture sections">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={item.id === activeId ? 'nav-item active' : 'nav-item'}
          >
            <span>{item.title}</span>
            <StatusBadge state={item.state} />
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>Section Status</p>
        <div className="legend-row">
          <StatusBadge state="implemented" />
          <span>{implementedCount}</span>
        </div>
        <div className="legend-row">
          <StatusBadge state="partial" />
          <span>{partialCount}</span>
        </div>
        <div className="legend-row">
          <StatusBadge state="planned" />
          <span>{plannedCount}</span>
        </div>
      </div>
    </aside>
  )
}
