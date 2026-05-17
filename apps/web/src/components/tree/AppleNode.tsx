import React, { useState } from 'react'
import type { Member } from '@/lib/types'

interface AppleNodeProps {
  member: Member
  isHovered: boolean
  onHover?: () => void
  onLeave?: () => void
  hideText?: boolean
  size?: number
  showNameBelow?: boolean
  onClick?: () => void
}

export default function AppleNode({ member, isHovered, onHover, onLeave, hideText = false, size = 200, showNameBelow = false, onClick }: AppleNodeProps) {
  const [imgHasError, setImgHasError] = useState(false)

  React.useEffect(() => {
    setImgHasError(false)
  }, [member.avatarUrl])
  const isBabyMode = () => {
    if (member.isBaby) return true
    if (!member.dateOfBirth) return false
    
    const birthDate = new Date(member.dateOfBirth)
    const today = new Date('2026-04-21') // Demo Context
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
    
    return age < 3
  }

  const isBaby = isBabyMode()
  const isDeceased = !!member.dateOfDeath
  
  const getAppleImage = () => {
    return member.appleType === 'green' ? '/assets/Manzana_verde.png' : '/assets/Manzana_roja.png'
  }

  const getMedallionContent = () => {
    if (isBaby) {
      return member.gender === 'female' ? '/assets/baby-girl.png' : '/assets/baby-boy.png'
    }
    if (!member.avatarUrl) {
      // Use initials if no custom avatar is provided. Random avatars cause gender confusion.
      return `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}&backgroundColor=transparent&textColor=000000&fontFamily=Playfair%20Display`
    }
    if (imgHasError) {
      return `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}&backgroundColor=transparent&textColor=000000&fontFamily=Playfair%20Display`
    }
    return member.avatarUrl
  }

  const birthYear = member.dateOfBirth?.split('-')[0] || ''
  const deathYear = member.dateOfDeath?.split('-')[0] || ''
  const dates = deathYear ? `${birthYear}–${deathYear}` : birthYear

  const scale = size / 200
  const fontSize = member.firstName.length > 9 ? '8px' : '10px'

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: showNameBelow ? 'flex-start' : 'center',
        margin: showNameBelow ? '0 8px' : '0',
        cursor: 'pointer',
        width: showNameBelow ? `${Math.max(size, 60)}px` : `${size}px`,
        flexShrink: 0
      }}
    >
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        zIndex: isHovered ? 2000 : 10
      }}>
        <div style={{
          position: 'relative',
          width: '200px',
          height: '200px',
          transform: `scale(${scale})`,
          flexShrink: 0,
          pointerEvents: 'none'
        }}>
      {/* 1. Base Apple */}
      <img 
        src={getAppleImage()} 
        alt="Apple" 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
          filter: isDeceased 
            ? 'grayscale(100%) drop-shadow(0 10px 25px rgba(0,0,0,0.5))' 
            : 'drop-shadow(0 10px 25px rgba(0,0,0,0.5))'
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
        {!hideText && (
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
        )}
        </div>
      </div>

      {showNameBelow && (
        <span style={{
          marginTop: '6px',
          maxWidth: '70px',
          fontSize: fontSize,
          color: '#FFF',
          textAlign: 'center',
          wordBreak: 'break-word',
          whiteSpace: 'normal',
          lineHeight: '1.1',
          fontWeight: '600',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)'
        }}>
          {member.firstName}
        </span>
      )}
    </div>
  )
}
