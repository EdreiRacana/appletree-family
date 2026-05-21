'use client'

import React from 'react'
import type { Member, Relationship } from '@/lib/types'

export interface MobileLayoutProps {
  members: Member[]
  relationships: Relationship[]
  activeTab: string
  onTabChange: (tab: string) => void
  currentUser: string
  currentTreeId: string
  
  // Modals & Actions
  onViewProfile: (m: Member) => void
  onEditMember: (m: Member) => void
  onAddMember: (m: Member) => void
  onDeleteMember: (m: Member) => Promise<void>
  onAddStory: (m: Member) => void
}

export default function MobileLayout(props: MobileLayoutProps) {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#1B2E1B',
      color: '#D4AF37',
      fontSize: '24px',
      fontWeight: 'bold'
    }}>
      Mobile OK
    </div>
  )
}
