'use client'

import React, { useState } from 'react'
import { Home, TreePine, MessageCircle, Megaphone, Image as ImageIcon, BookOpen, User, MoreHorizontal, Lightbulb, X } from 'lucide-react'

interface MobileBottomNavProps {
  activeTab: string | null
  onTabChange: (tab: string) => void
  onOpenSuggestions?: () => void
  suggestionsLabel?: string
}

// Máximo 5 botones (lo que cabe bien en un celular). El resto vive en "Más".
const MAIN_ITEMS = [
  { id: 'Home',    icon: Home,          label: 'Inicio' },
  { id: 'My Tree', icon: TreePine,      label: 'Árbol' },
  { id: 'Chats',   icon: MessageCircle, label: 'Chats' },
  { id: 'Buzón',   icon: Megaphone,     label: 'Buzón' },
]

const MORE_ITEMS = [
  { id: 'Photo Albums', icon: ImageIcon, label: 'Fotos' },
  { id: 'Events',       icon: BookOpen,  label: 'Eventos' },
  { id: 'Profile',      icon: User,      label: 'Mi perfil y ajustes' },
]

export default function MobileBottomNav({ activeTab, onTabChange, onOpenSuggestions, suggestionsLabel = 'Sugerencias' }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = MORE_ITEMS.some(i => i.id === activeTab)

  const pick = (id: string) => { setMoreOpen(false); onTabChange(id) }

  return (
    <>
      {moreOpen && (
        <>
          <div className="mobile-sheet-overlay" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="mobile-sheet-panel" role="dialog" aria-modal="true" aria-label="Más opciones">
            <div className="mobile-sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 8px' }}>
              <p className="mobile-sheet-name" style={{ margin: 0 }}>Más</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Cerrar"
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7 }}>
                <X size={20} />
              </button>
            </div>
            <div className="mobile-sheet-actions">
              {MORE_ITEMS.map(item => {
                const Icon = item.icon
                return (
                  <button key={item.id} className="mobile-sheet-action-btn" onClick={() => pick(item.id)}>
                    <Icon size={20} strokeWidth={1.8} />
                    {item.label}
                  </button>
                )
              })}
              {onOpenSuggestions && (
                <button className="mobile-sheet-action-btn" onClick={() => { setMoreOpen(false); onOpenSuggestions() }}>
                  <Lightbulb size={20} strokeWidth={1.8} />
                  {suggestionsLabel}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <nav className="mobile-bottom-nav" aria-label="Navegación móvil">
        {MAIN_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              className="mobile-nav-item"
              onClick={() => pick(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{ position: 'relative' }}
            >
              {isActive && <span className="mobile-nav-dot" />}
              <Icon size={22} className={`mobile-nav-icon${isActive ? ' active' : ''}`} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={`mobile-nav-label${isActive ? ' active' : ''}`}>{item.label}</span>
            </button>
          )
        })}
        <button
          className="mobile-nav-item"
          onClick={() => setMoreOpen(o => !o)}
          aria-label="Más"
          aria-expanded={moreOpen}
          style={{ position: 'relative' }}
        >
          {moreActive && <span className="mobile-nav-dot" />}
          <MoreHorizontal size={22} className={`mobile-nav-icon${moreActive ? ' active' : ''}`} strokeWidth={moreActive ? 2.5 : 1.8} />
          <span className={`mobile-nav-label${moreActive ? ' active' : ''}`}>Más</span>
        </button>
      </nav>
    </>
  )
}
