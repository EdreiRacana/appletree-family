'use client'

import { Trees, Network, ImageIcon, Calendar, Settings, Lock } from 'lucide-react'

interface SidebarProps {
  activeNav: string
  setActiveNav: (nav: string) => void
}

const navItems = [
  { id: 'tree',     label: 'My Tree',          icon: Trees },
  { id: 'network',  label: 'Extended Network', icon: Network },
  { id: 'albums',   label: 'Photo Albums',     icon: ImageIcon },
  { id: 'events',   label: 'Events',           icon: Calendar },
  { id: 'settings', label: 'Settings',         icon: Settings },
  { id: 'privacy',  label: 'Privacy',          icon: Lock },
]

const DEMO_ALBUMS = [
  {
    id: '1',
    title: "Grandpa's 80th",
    sub: 'Immediate Family Only',
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&q=80',
    locked: true,
  },
  {
    id: '2',
    title: 'Summer Vacation 2024',
    sub: 'Shared with Connections',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&q=80',
    locked: false,
  },
  {
    id: '3',
    title: 'Family Recipes',
    sub: 'Immediate Connections',
    image: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=200&q=80',
    locked: true,
  },
]

export default function Sidebar({ activeNav, setActiveNav }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Navigation */}
      <div className="sidebar-section">
        <div className="sidebar-label">Navigation</div>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)}
            >
              <Icon className="nav-icon" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Photo Albums Preview */}
      <div className="sidebar-section">
        <div className="sidebar-label">Photo Albums</div>
        {DEMO_ALBUMS.map((album) => (
          <div key={album.id} id={`album-${album.id}`} className="sidebar-album">
            <img src={album.image} alt={album.title} />
            <div className="sidebar-album-overlay">
              <div className="sidebar-album-title">
                {album.locked ? '🔒 ' : ''}{album.title}
              </div>
              <div className="sidebar-album-sub">{album.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
