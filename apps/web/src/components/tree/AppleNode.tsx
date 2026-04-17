'use client'

import type { Member } from '@/lib/types'

interface AppleNodeProps {
  member: Member
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
}

function getAppleType(member: Member): 'red' | 'green' | 'pink' {
  if (member.isBaby) return 'pink'
  return member.appleType ?? 'red'
}

export default function AppleNode({ member, isHovered, onHover, onLeave }: AppleNodeProps) {
  const appleType = getAppleType(member)
  const birthYear = member.dateOfBirth ? new Date(member.dateOfBirth).getFullYear() : null
  const deathYear = member.dateOfDeath ? new Date(member.dateOfDeath).getFullYear() : null
  const dates = birthYear
    ? deathYear
      ? `${birthYear}–${deathYear}`
      : `b. ${birthYear}`
    : null

  return (
    <div
      className="apple-node"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      id={`node-${member.id}`}
    >
      <div className={`apple-body ${appleType} ${isHovered ? 'animate-float' : ''}`}>
        {/* Stem & Leaf */}
        <div className="apple-stem" />
        <div className="apple-leaf" />

        {/* Photo or Baby Icon */}
        {member.isBaby ? (
          <span className="apple-baby-icon">
            {member.gender === 'female' ? '👶🏻' : '👶'}
          </span>
        ) : member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={`${member.firstName} ${member.lastName}`}
            className="apple-photo"
          />
        ) : (
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.firstName}${member.lastName}&backgroundColor=${appleType === 'red' ? 'ffb3b3' : 'b3ffb3'}`}
            alt={`${member.firstName} ${member.lastName}`}
            className="apple-photo"
          />
        )}
      </div>

      {/* Label */}
      <div className="apple-label">
        <div className="apple-name">
          {member.firstName}<br />{member.lastName}
        </div>
        {dates && <div className="apple-dates">{dates}</div>}
      </div>
    </div>
  )
}
