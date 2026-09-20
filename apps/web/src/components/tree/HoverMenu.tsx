'use client'

import { MessageCircle, Heart, Trophy, User, Edit2, UserPlus, Trash2, Minimize2, Maximize2, Link2 } from 'lucide-react'
import type { Member } from '@/lib/types'

interface HoverMenuProps {
  member: Member
  onClose: () => void
  onEdit: (member: Member) => void
  onAdd: (member: Member) => void
  onConnect?: (member: Member) => void
  onDelete: (member: Member) => void
  onViewProfile: (member: Member) => void
  onAddStory: (member: Member) => void
  onMouseEnter?: () => void
  // Collapse/expand controls (only shown when the member has descendants)
  hasDescendants?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: (member: Member) => void
  // Positioning override — cuando se define, el menu escapa del container
  // (position:fixed en screen coords) para no ser clip'eado por el pan/zoom
  // ni por el topbar. Se usa desde TreeCanvas para manzanas cerca del top.
  fixedStyle?: React.CSSProperties
}

const menuItems = [
  { id: 'chat',        icon: MessageCircle, label: (name: string) => `Chatear con ${name}`, isContact: true },
  { id: 'greeting',    icon: Heart,         label: () => 'Enviar Saludo', isContact: true },
  { id: 'add',         icon: UserPlus,      label: () => 'Añadir Familiar', isContact: false },
  { id: 'connect',     icon: Link2,         label: () => 'Conectar con otro familiar', isContact: false },
  { id: 'edit',        icon: Edit2,         label: () => 'Editar Detalles', isContact: false },
  { id: 'delete',      icon: Trash2,        label: () => 'Eliminar Integrante', isContact: false, isCritical: true },
  { id: 'achievement', icon: Trophy,        label: () => 'Publicar Logro', isContact: false },
  { id: 'profile',     icon: User,          label: () => 'Ver Perfil', isContact: false },
]

export default function HoverMenu({ member, onClose, onEdit, onAdd, onConnect, onDelete, onViewProfile, onAddStory, onMouseEnter, hasDescendants, isCollapsed, onToggleCollapse, fixedStyle }: HoverMenuProps) {
  
  // LOGIC: Check if member is a minor (< 18 years old or is marked as baby)
  const isMinor = () => {
    // 1. Explicit marker
    if (member.isBaby || member.generation === 3) return true
    
    // 2. Date calculation (Base Context: 2026)
    if (!member.dateOfBirth) return false
    const birthDate = new Date(member.dateOfBirth)
    const today = new Date('2026-04-21') // Hardcoded context date for demo consistency
    
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age < 18
  }

  const handleAction = (actionId: string) => {
    if (actionId === 'edit') {
      onEdit(member)
    } else if (actionId === 'add') {
      onAdd(member)
    } else if (actionId === 'connect' && onConnect) {
      onConnect(member)
    } else if (actionId === 'delete') {
      onDelete(member)
    } else if (actionId === 'profile') {
      onViewProfile(member)
    } else if (actionId === 'achievement') {
      onAddStory(member)
    } else {
      console.log('Action:', actionId, 'for member:', member.id)
    }
    onClose()
  }

  const isProtected = isMinor()
  const isDeceased = !!member.dateOfDeath

  // FILTERED MENU: Remove contact options for protected members (minors/babies)
  // and for deceased members (no se puede chatear ni saludar a quien ya falleció).
  const filteredItems = menuItems.filter(item => {
    if ((isProtected || isDeceased) && item.isContact) return false
    return true
  })

  return (
    <>
      {/* Overlay tapeable: cierra el menú al tocar fuera (móvil y desktop).
          Debe estar debajo del menú en z-index para que los clicks internos
          hagan su acción antes de cerrar. */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'transparent',
        }}
      />
    <div
      className="hover-menu"
      onMouseEnter={onMouseEnter}
      onClick={(e) => e.stopPropagation()}
      id={`hover-menu-${member.id}`}
      style={fixedStyle}
    >
      {hasDescendants && onToggleCollapse && (
        <button
          className="hover-menu-item"
          onClick={() => { onToggleCollapse(member); onClose() }}
        >
          {isCollapsed
            ? <Maximize2 className="hover-menu-icon" />
            : <Minimize2 className="hover-menu-icon" />}
          {isCollapsed ? 'Expandir rama' : 'Colapsar rama'}
        </button>
      )}
      {filteredItems.map((item, idx) => {
        const Icon = item.icon
        const showDivider = idx > 0 && (item.id === 'privacy' || item.id === 'share')
        
        return (
          <div key={item.id}>
            {showDivider && <div className="hover-menu-divider" />}
            <button
              id={`action-${item.id}-${member.id}`}
              className={`hover-menu-item ${item.isCritical ? 'critical' : ''}`}
              onClick={() => handleAction(item.id)}
              style={item.isCritical ? { color: '#FF4444' } : {}}
            >
              <Icon className="hover-menu-icon" />
              {item.label(member.firstName)}
            </button>
          </div>
        )
      })}
    </div>
    </>
  )
}
