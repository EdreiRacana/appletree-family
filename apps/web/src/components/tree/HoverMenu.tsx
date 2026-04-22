'use client'

import { MessageCircle, Heart, Trophy, User, Shield, Share2, Edit2, UserPlus } from 'lucide-react'
import type { Member } from '@/lib/types'

interface HoverMenuProps {
  member: Member
  onClose: () => void
  onEdit: (member: Member) => void
  onAdd: (member: Member) => void
}

const menuItems = [
  { id: 'chat',        icon: MessageCircle, label: (name: string) => `Chat with ${name}`, isContact: true },
  { id: 'greeting',    icon: Heart,         label: () => 'Send Greeting', isContact: true },
  { id: 'add',         icon: UserPlus,      label: () => 'Add Family Member', isContact: false },
  { id: 'edit',        icon: Edit2,         label: () => 'Edit Member Details', isContact: false },
  { id: 'achievement', icon: Trophy,        label: () => 'Post an Achievement', isContact: false },
  { id: 'profile',     icon: User,          label: () => 'View Full Profile', isContact: false },
  { id: 'privacy',     icon: Shield,        label: () => 'Adjust Privacy Settings', isContact: false },
  { id: 'share',       icon: Share2,        label: () => 'Share Photo', isContact: false },
]

export default function HoverMenu({ member, onClose, onEdit, onAdd }: HoverMenuProps) {
  
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
              className="hover-menu-item"
              onClick={() => handleAction(item.id)}
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
