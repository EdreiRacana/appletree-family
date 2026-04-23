'use client'

import { MessageCircle, Heart, Trophy, User, Shield, Share2, Edit2, UserPlus, Trash2 } from 'lucide-react'
import type { Member } from '@/lib/types'

interface HoverMenuProps {
  member: Member
  onClose: () => void
  onEdit: (member: Member) => void
  onAdd: (member: Member) => void
  onDelete: (member: Member) => void
  onViewProfile: (member: Member) => void
  onAddStory: (member: Member) => void
}

const menuItems = [
  { id: 'chat',        icon: MessageCircle, label: (name: string) => `Chatear con ${name}`, isContact: true },
  { id: 'greeting',    icon: Heart,         label: () => 'Enviar Saludo', isContact: true },
  { id: 'add',         icon: UserPlus,      label: () => 'Añadir Familiar', isContact: false },
  { id: 'edit',        icon: Edit2,         label: () => 'Editar Detalles', isContact: false },
  { id: 'delete',      icon: Trash2,        label: () => 'Eliminar Integrante', isContact: false, isCritical: true },
  { id: 'achievement', icon: Trophy,        label: () => 'Publicar Logro', isContact: false },
  { id: 'profile',     icon: User,          label: () => 'Ver Perfil', isContact: false },
]

export default function HoverMenu({ member, onClose, onEdit, onAdd, onDelete, onViewProfile, onAddStory }: HoverMenuProps) {
  
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

  // FILTERED MENU: Remove contact options for protected members (minors/babies)
  const filteredItems = menuItems.filter(item => {
    if (isProtected && item.isContact) return false
    return true
  })

  return (
    <div
      className="hover-menu"
      onMouseLeave={onClose}
      id={`hover-menu-${member.id}`}
    >
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
  )
}
