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
    </aside>
  )
}
