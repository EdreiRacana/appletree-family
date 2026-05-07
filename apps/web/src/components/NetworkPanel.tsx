'use client'

import React, { useState, useMemo } from 'react'
import { Search, UserPlus, Users, X, ChevronRight, Baby } from 'lucide-react'
import type { Member } from '@/lib/types'

interface NetworkPanelProps {
  members: Member[]
  onInviteMember: (member: Member) => void
}

// --- Helpers ---
function getAge(dob?: string | null): number | null {
  if (!dob) return null
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getGenerationLabel(gen?: number | null): string {
  if (gen === null || gen === undefined) return ''
  if (gen <= -2) return 'Bisabuelos'
  if (gen === -1) return 'Abuelos'
  if (gen === 0) return 'Padres'
  if (gen === 1) return 'Hijos'
  if (gen === 2) return 'Nietos'
  if (gen >= 3) return 'Bisnietos'
  return `Gen ${gen}`
}

function getAppleColor(appleType?: string | null, gender?: string | null): string {
  if (appleType === 'red') return '#C0392B'
  if (appleType === 'pink') return '#E75480'
  if (appleType === 'green') return '#27AE60'
  if (gender === 'female') return '#E75480'
  return '#C0392B'
}

// --- Sub-components ---
function MemberRow({ member, onInvite }: { member: Member; onInvite: (m: Member) => void }) {
  const age = getAge(member.dateOfBirth)
  const isBaby = member.isBaby || (age !== null && age < 13)
  const appleColor = getAppleColor(member.appleType, member.gender)
  const isDead = !!member.dateOfDeath

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '14px',
        backgroundColor: 'rgba(255,255,255,0.35)',
        border: '1px solid rgba(44,24,16,0.08)',
        transition: 'all 0.2s ease',
        cursor: 'default',
        opacity: isDead ? 0.6 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.6)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.35)' }}
    >
      {/* Avatar */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: `2.5px solid ${appleColor}`,
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: `${appleColor}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {isBaby ? (
          <Baby size={20} color={appleColor} />
        ) : member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={`${member.firstName}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: '14px', fontWeight: '900', color: appleColor }}>
            {getInitials(member.firstName, member.lastName)}
          </span>
        )}
        {isDead && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '12px' }}>✝</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: '13px',
          fontWeight: '900',
          color: '#2C1810',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {member.firstName} {member.maidenName ? `(${member.maidenName})` : ''} {member.lastName}
        </p>
        <p style={{ margin: 0, fontSize: '10px', color: '#7A6558', fontWeight: '700' }}>
          {getGenerationLabel(member.generation)}
          {age !== null && !isBaby ? ` · ${age} años` : ''}
          {isBaby && !member.isBaby ? ' · Menor' : ''}
          {member.occupation ? ` · ${member.occupation}` : ''}
        </p>
      </div>

      {/* Invite Button */}
      <button
        onClick={() => onInvite(member)}
        title="Invitar al árbol"
        style={{
          background: 'none',
          border: '1.5px solid rgba(44,24,16,0.2)',
          borderRadius: '8px',
          padding: '5px 7px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: '#2C1810',
          opacity: 0.6,
          flexShrink: 0,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.borderColor = '#D4822A'
          e.currentTarget.style.color = '#D4822A'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.opacity = '0.6'
          e.currentTarget.style.borderColor = 'rgba(44,24,16,0.2)'
          e.currentTarget.style.color = '#2C1810'
        }}
      >
        <UserPlus size={14} />
      </button>
    </div>
  )
}

// --- Main Component ---
export default function NetworkPanel({ members, onInviteMember }: NetworkPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState<'members' | 'stats'>('members')

  // Stats
  const totalMembers = members.length
  const aliveCount = members.filter(m => !m.dateOfDeath).length
  const generationCount = new Set(members.map(m => m.generation).filter(g => g !== null && g !== undefined)).size

  // Filtered & grouped members
  const filteredAndGrouped = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const filtered = query
      ? members.filter(m =>
          `${m.firstName} ${m.lastName} ${m.maidenName || ''} ${m.nickname || ''}`.toLowerCase().includes(query)
        )
      : members

    // Group by generation label
    const groups: Record<string, Member[]> = {}
    const generationOrder: Record<string, number> = {
      'Bisabuelos': -2,
      'Abuelos': -1,
      'Padres': 0,
      'Hijos': 1,
      'Nietos': 2,
      'Bisnietos': 3,
    }

    filtered.forEach(m => {
      const label = getGenerationLabel(m.generation) || 'Sin Generación'
      if (!groups[label]) groups[label] = []
      groups[label].push(m)
    })

    // Sort groups by generation order
    return Object.entries(groups).sort(([a], [b]) => {
      const aOrder = generationOrder[a] ?? 99
      const bOrder = generationOrder[b] ?? 99
      return aOrder - bOrder
    })
  }, [members, searchQuery])

  const totalFiltered = filteredAndGrouped.reduce((acc, [, arr]) => acc + arr.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>

      {/* View Toggle */}
      <div style={{
        display: 'flex',
        backgroundColor: 'rgba(44,24,16,0.06)',
        borderRadius: '12px',
        padding: '4px',
        gap: '4px',
      }}>
        {[
          { id: 'members', label: '👥 Directorio' },
          { id: 'stats', label: '📊 Red' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '900',
              backgroundColor: activeView === tab.id ? '#2C1810' : 'transparent',
              color: activeView === tab.id ? '#FAEFBC' : '#2C1810',
              transition: 'all 0.2s ease',
              letterSpacing: '0.03em',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === MEMBERS VIEW === */}
      {activeView === 'members' && (
        <>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '13px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#7A6558',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Buscar familiar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 13px 11px 36px',
                borderRadius: '12px',
                border: '1.5px solid rgba(44,24,16,0.15)',
                backgroundColor: 'rgba(255,255,255,0.5)',
                color: '#2C1810',
                fontSize: '13px',
                fontWeight: '700',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#D4822A' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(44,24,16,0.15)' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} color="#7A6558" />
              </button>
            )}
          </div>

          {/* Results count */}
          <p style={{
            margin: 0,
            fontSize: '10px',
            fontWeight: '800',
            color: '#2C1810',
            opacity: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {searchQuery
              ? `${totalFiltered} resultado${totalFiltered !== 1 ? 's' : ''}`
              : `${totalMembers} miembro${totalMembers !== 1 ? 's' : ''} en el árbol`
            }
          </p>

          {/* Member List — grouped by generation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
            {filteredAndGrouped.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '30px 0',
                opacity: 0.5,
              }}>
                <Users size={32} color="#2C1810" />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#2C1810', textAlign: 'center' }}>
                  No se encontró ningún familiar
                </p>
              </div>
            ) : (
              filteredAndGrouped.map(([groupLabel, groupMembers]) => (
                <div key={groupLabel}>
                  <h4 style={{
                    margin: '0 0 8px',
                    fontSize: '10px',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: '#2C1810',
                    opacity: 0.5,
                  }}>
                    {groupLabel} ({groupMembers.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {groupMembers.map(member => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        onInvite={onInviteMember}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* === STATS VIEW === */}
      {activeView === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { value: totalMembers, label: 'Total Familia', icon: '👨‍👩‍👧‍👦' },
              { value: aliveCount, label: 'Vivos', icon: '🌱' },
              { value: totalMembers - aliveCount, label: 'En Memoria', icon: '✝️' },
              { value: generationCount, label: 'Generaciones', icon: '🌳' },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.4)',
                  borderRadius: '14px',
                  padding: '14px 12px',
                  border: '1px solid rgba(44,24,16,0.08)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{stat.icon}</div>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#2C1810' }}>{stat.value}</p>
                <p style={{ margin: '2px 0 0', fontSize: '9px', fontWeight: '900', color: '#2C1810', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Gender breakdown */}
          {(() => {
            const males = members.filter(m => m.gender === 'male').length
            const females = members.filter(m => m.gender === 'female').length
            const others = members.filter(m => !m.gender || m.gender === 'other').length
            const total = members.length || 1
            return (
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.4)',
                borderRadius: '14px',
                padding: '16px',
                border: '1px solid rgba(44,24,16,0.08)',
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2C1810', opacity: 0.55 }}>
                  Distribución
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: '♂ Hombres', count: males, color: '#3498DB' },
                    { label: '♀ Mujeres', count: females, color: '#E75480' },
                    ...(others > 0 ? [{ label: '◆ Otro', count: others, color: '#95a5a6' }] : []),
                  ].map(row => (
                    <div key={row.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#2C1810' }}>{row.label}</span>
                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#2C1810' }}>{row.count}</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'rgba(44,24,16,0.08)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${(row.count / total) * 100}%`,
                          backgroundColor: row.color,
                          borderRadius: '3px',
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Generation breakdown */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.4)',
            borderRadius: '14px',
            padding: '16px',
            border: '1px solid rgba(44,24,16,0.08)',
          }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2C1810', opacity: 0.55 }}>
              Por Generación
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredAndGrouped.map(([label, group]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#2C1810', minWidth: '80px' }}>{label}</span>
                  <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: 'rgba(44,24,16,0.08)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(group.length / (members.length || 1)) * 100}%`,
                      backgroundColor: '#2C1810',
                      borderRadius: '3px',
                      opacity: 0.5,
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#2C1810', minWidth: '20px', textAlign: 'right' }}>{group.length}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA to go to directory */}
          <button
            onClick={() => setActiveView('members')}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#2C1810',
              color: '#FAEFBC',
              borderRadius: '12px',
              border: 'none',
              fontSize: '12px',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              letterSpacing: '0.05em',
            }}
          >
            <Users size={14} />
            Ver Directorio Familiar
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
