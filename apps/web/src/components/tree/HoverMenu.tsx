'use client'

import { MessageCircle, Heart, Trophy, User, Shield, Share2 } from 'lucide-react'
import type { Member } from '@/lib/types'

interface HoverMenuProps {
  member: Member
  onClose: () => void
}

const menuItems = [
  { id: 'chat',        icon: MessageCircle, label: (name: string) => `Chat with ${name}` },
  { id: 'greeting',    icon: Heart,         label: () => 'Send Greeting' },
  { id: 'achievement', icon: Trophy,        label: () => 'Post an Achievement' },
  { id: 'profile',     icon: User,          label: () => 'View Full Profile' },
  { id: 'privacy',     icon: Shield,        label: () => 'Adjust Privacy Settings' },
  { id: 'share',       icon: Share2,        label: () => 'Share Photo' },
]

export default function HoverMenu({ member, onClose }: HoverMenuProps) {
  const handleAction = (actionId: string) => {
    console.log('Action:', actionId, 'for member:', member.id)
    // TODO: wire up to real actions
    onClose()
  }

  return (
    <div
      className="hover-menu"
      onMouseLeave={onClose}
      id={`hover-menu-${member.id}`}
    >
      {menuItems.map((item, idx) => {
        const Icon = item.icon
        const isLast = idx === menuItems.length - 1
        const showDivider = idx === 3 // Divider before privacy/share
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
