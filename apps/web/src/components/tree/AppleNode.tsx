import React, { useState } from 'react'
import type { Member } from '@/lib/types'

interface AppleNodeProps {
  member: Member
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
}

export default function AppleNode({ member, isHovered, onHover, onLeave }: AppleNodeProps) {
  const [imgHasError, setImgHasError] = useState(false)
  const isBaby = member.isBaby || member.generation === 3
  
  const getAppleImage = () => {
    return member.appleType === 'green' ? '/assets/Manzana_verde.png' : '/assets/Manzana_roja.png'
  }

  const getMedallionContent = () => {
    if (imgHasError) {
      // Professional Fallback Avatar
      return `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}&backgroundColor=d4af37&fontFamily=Playfair%20Display`
    }
    if (isBaby) {
      return member.gender === 'female' ? '/assets/BB_nina.png' : '/assets/BB_nino.png'
    }
    return member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`
  }

  const birthYear = member.dateOfBirth?.split('-')[0] || ''
  const deathYear = member.dateOfDeath?.split('-')[0] || ''
  const dates = deathYear ? `${birthYear}–${deathYear}` : birthYear

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        position: 'relative',
        cursor: 'pointer',
        width: '200px',
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        zIndex: isHovered ? 2000 : 10
      }}
    >
      {/* 1. Base Apple */}
      <img 
        src={getAppleImage()} 
        alt="Apple" 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
          filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.5))'
        }} 
      />

      {/* 2. CENTERED INTERNAL BLOCK */}
      <div style={{
        position: 'absolute',
        top: '58%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        zIndex: 10
      }}>
        
        {/* 3. Small Medallion (48px Lux Style) */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '1.2px solid rgba(255,255,255,0.9)',
          boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
          backgroundColor: '#FFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '6px'
        }}>
          <img
            src={getMedallionContent()}
            alt={member.firstName}
            onError={() => setImgHasError(true)}
            style={{ 
              width: isBaby || imgHasError ? '75%' : '100%', 
              height: isBaby || imgHasError ? '75%' : '100%', 
              objectFit: isBaby || imgHasError ? 'contain' : 'cover'
            }}
          />
        </div>

        {/* 4. Fine Single-Line Typography */}
        <div style={{
          width: '100%',
          textAlign: 'center',
          padding: '0 25px',
          pointerEvents: 'none'
        }}>
          <p style={{
            fontSize: '8.5px',
            fontWeight: '600',
            color: '#FFF',
            lineHeight: '1',
            margin: 0,
            textShadow: '0 1px 3px rgba(0,0,0,1)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.02em'
          }}>
            {member.firstName} {member.lastName}
          </p>
          <p style={{
            fontSize: '7.5px',
            fontWeight: '600',
            color: '#F5E6C8',
            margin: '3px 0 0',
            textShadow: '0 1px 2px rgba(0,0,0,1)'
          }}>
            {dates}
          </p>
        </div>
      </div>
    </div>
  )
}
