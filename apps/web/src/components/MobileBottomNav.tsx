'use client'

import React from 'react'
import { Home, TreePine, Image as ImageIcon, BookOpen, User } from 'lucide-react'

interface MobileBottomNavProps {
  activeTab: string | null
  onTabChange: (tab: string) => void
}

const NAV_ITEMS = [
  { id: 'Home',         icon: Home,      label: 'Inicio'    },
  { id: 'My Tree',     icon: TreePine,  label: 'Árbol'     },
  { id: 'Photo Albums',icon: ImageIcon, label: 'Fotos'     },
  { id: 'Stories',     icon: BookOpen,  label: 'Historias' },
  { id: 'Profile',     icon: User,      label: 'Perfil'    },
]

export default function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegación móvil">
      {NAV_ITEMS.map(item => {
        const Icon = item.icon
        const isActive = activeTab === item.id

        return (
          <button
            key={item.id}
            className="mobile-nav-item"
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            style={{ position: 'relative' }}
          >
            {isActive && <span className="mobile-nav-dot" />}
            <Icon
              size={22}
              className={`mobile-nav-icon${isActive ? ' active' : ''}`}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className={`mobile-nav-label${isActive ? ' active' : ''}`}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
