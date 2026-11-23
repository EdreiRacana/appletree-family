'use client'

import React, { useEffect, useState } from 'react'
import { X, Briefcase, BookOpen, MapPin, Award, Share2, Edit3, UserPlus, Eye, MessageCircle, Link2, Lightbulb, Heart } from 'lucide-react'
import type { Member } from '@/lib/types'
import { ageOn } from '@/lib/familyDates'
import MourningRibbon from '@/components/MourningRibbon'

interface MemberProfilePanelProps {
  member: Member | null
  onClose: () => void
  onEdit?: (member: Member) => void
  onInvite?: (member: Member) => void
  onAddRelative?: (member: Member) => void
  onFocusBranch?: (member: Member) => void
  onChat?: (member: Member) => void
  onConnect?: (member: Member) => void
  onSuggest?: (member: Member) => void
  relationLabel?: string        // parentesco desde quien mira ("Tu abuela")
}

export default function MemberProfilePanel({ member, onClose, onEdit, onInvite, onAddRelative, onFocusBranch, onChat, onConnect, onSuggest, relationLabel }: MemberProfilePanelProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (member) {
      // Small delay to trigger animation
      const timer = setTimeout(() => setIsVisible(true), 10)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [member])

  if (!member) return null

  const birthYear = member.dateOfBirth?.split('-')[0] || '?'
  const deathYear = member.dateOfDeath?.split('-')[0] || ''
  const lifeSpan = deathYear ? `${birthYear} — ${deathYear}` : `Desde ${birthYear}`
  const isDeceased = !!member.dateOfDeath

  const age = ageOn(member)

  // Línea de tiempo solo con datos reales de la manzana (nada inventado).
  const timeline = [
    { year: birthYear, title: 'Nacimiento', desc: member.birthPlace ? `Llegó al mundo en ${member.birthPlace}.` : 'Comienzo de su historia en la familia.' },
    ...(member.biography && !isDeceased ? [{ year: 'HOY', title: 'Vida y legado', desc: 'Su historia sigue escribiéndose en la familia.' }] : []),
    ...(deathYear ? [{
      year: deathYear,
      title: 'Partió',
      desc: age !== null ? `A los ${age} años. Su legado sigue vivo en la familia.` : 'Su legado sigue vivo en la familia.',
    }] : []),
  ].filter(item => item.year !== '?')

  // Datos rápidos: a un finado no se le muestran huecos ("Sin ocupación").
  const chips = isDeceased
    ? [
        member.birthPlace && { icon: <MapPin size={16} />, text: `De ${member.birthPlace}`, title: 'Lugar de origen' },
        member.occupation && { icon: <Briefcase size={16} />, text: member.occupation, title: 'Ocupación' },
        age !== null && { icon: <Heart size={16} />, text: `Vivió ${age} años`, title: 'Años de vida' },
      ].filter(Boolean) as { icon: React.ReactNode, text: string, title: string }[]
    : [
        { icon: <MapPin size={16} />, text: member.birthPlace || 'Sin ubicación', title: 'Ubicación' },
        { icon: <Briefcase size={16} />, text: member.occupation || 'Sin ocupación', title: 'Ocupación' },
      ]

  const defaultBio = isDeceased
    ? `${member.firstName} es parte de nuestra raíz familiar. Su recuerdo vive en las tradiciones y en el amor que hoy nos une. Comparte una historia o una foto para que su memoria siga presente.`
    : `${member.firstName} es una parte fundamental de nuestra raíz familiar. Su historia se entrelaza con las tradiciones y el amor que hoy nos une. (Biografía en desarrollo para documentar sus mayores logros y memorias).`

  return (
    <>
      {/* Non-modal drawer: keeps the tree and minimap navigable while the
         story is open (Notion / Linear / Figma pattern). No backdrop. */}
      <div style={{
        position: 'fixed',
        top: '88px',
        right: '18px',
        bottom: '18px',
        width: 'min(340px, calc(100vw - 36px))',
        backgroundColor: 'var(--drawer-bg)',
        backdropFilter: 'blur(26px) saturate(140%)',
        WebkitBackdropFilter: 'blur(26px) saturate(140%)',
        boxShadow: 'var(--panel-shadow)',
        borderRadius: '18px',
        zIndex: 4001,
        display: 'flex',
        flexDirection: 'column',
        transform: isVisible ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        border: '1px solid var(--drawer-border)',
        color: 'var(--drawer-fg)',
        overflow: 'hidden',
      }}>
        
        {/* Header / Cover Area — compacto */}
        <div style={{
          padding: '52px 22px 20px',
          backgroundColor: 'transparent',
          borderBottom: '1px solid var(--drawer-border)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              background: 'var(--accent-gold-soft)',
              border: '1px solid var(--drawer-border)',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--drawer-accent)'
            }}
          >
            <X size={16} />
          </button>

          {/* Medallion — más pequeño. Finados: moño negro discreto. */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <div style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              border: '2px solid var(--drawer-accent)',
              overflow: 'hidden',
              backgroundColor: '#FFF',
              boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            }}>
              <img
                src={member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`}
                alt={member.firstName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            {isDeceased && (
              <MourningRibbon size={21} style={{ position: 'absolute', right: '-6px', bottom: '-4px' }} />
            )}
          </div>

          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            color: 'var(--drawer-fg)',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.2
          }}>
            {member.firstName} {member.lastName}
            {member.nickname && <span style={{ fontSize: '13px', opacity: 0.7, display: 'block', fontStyle: 'italic' }}>&quot;{member.nickname}&quot;</span>}
          </h2>
          <p style={{
            color: 'var(--drawer-accent)',
            fontSize: '11px',
            fontWeight: '700',
            marginTop: '4px',
            letterSpacing: '0.1em'
          }}>
            {lifeSpan.toUpperCase()}
          </p>
          {relationLabel && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', fontWeight: 700, color: 'var(--drawer-accent)' }}>
              {relationLabel}
            </p>
          )}
        </div>

        {/* Content Area — overflow-x hidden para que no aparezca scroll
            horizontal cuando algún hijo (biografía larga, foto ancha)
            excede el ancho del drawer. */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          minWidth: 0,
        }}>
          
          {/* Quick Info Bar */}
          {chips.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {chips.map(c => (
                <div key={c.title} style={badgeStyle} title={c.title}>
                  {c.icon} {c.text}
                </div>
              ))}
            </div>
          )}

          {/* Biography */}
          <section>
            <div style={sectionHeaderStyle}>
              <BookOpen size={20} color="var(--drawer-accent)" />
              <h3 style={sectionTitleStyle}>Biografía de Vida</h3>
            </div>
            <p style={{
              fontSize: '15px',
              lineHeight: '1.6',
              color: 'var(--drawer-fg)',
              fontStyle: 'italic',
              fontFamily: 'serif',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              margin: 0,
            }}>
              {member.biography || defaultBio}
            </p>
          </section>

          {/* Timeline / Milestones */}
          <section>
            <div style={sectionHeaderStyle}>
              <Award size={20} color="var(--drawer-accent)" />
              <h3 style={sectionTitleStyle}>Línea del Tiempo & Hitos</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px' }}>
              {timeline.map(item => (
                <div key={item.title} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <span style={{ minWidth: '50px', fontSize: '14px', fontWeight: '900', color: 'var(--drawer-accent)', paddingTop: '3px' }}>
                    {item.year}
                  </span>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--drawer-fg)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.title}
                      {item.title === 'Partió' && <MourningRibbon size={10} />}
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--drawer-fg)', opacity: 0.75, fontWeight: '500' }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer Actions — grid 2x2. "Chatear" fue reemplazado por
              "Ver su rama" (útil, no vacío). "Invitar" se oculta para
              fallecidos. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginTop: '10px',
            paddingTop: '20px',
            borderTop: '1px solid var(--drawer-border)'
          }}>
            {onFocusBranch && (
              <button onClick={() => onFocusBranch(member)} style={actionButtonStyle}>
                <Eye size={16} /> Ver su rama
              </button>
            )}
            {onAddRelative && (
              <button onClick={() => onAddRelative(member)} style={actionButtonStyle}>
                <UserPlus size={16} /> Añadir hijo o pareja
              </button>
            )}
            {onConnect && (
              <button onClick={() => onConnect(member)} style={actionButtonStyle}>
                <Link2 size={16} /> Conectar familiar
              </button>
            )}
            {onChat && !isDeceased && (
              <button onClick={() => onChat(member)} style={actionButtonStyle}>
                <MessageCircle size={16} /> Chatear
              </button>
            )}
            {onInvite && !isDeceased && !member.userId && (
              <button
                onClick={() => onInvite(member)}
                style={{ ...actionButtonStyle, border: '2px solid var(--drawer-accent)', color: 'var(--drawer-accent)' }}
              >
                <Share2 size={16} /> Invitar
              </button>
            )}
            {onSuggest && (
              <button onClick={() => onSuggest(member)} style={actionButtonStyle}>
                <Lightbulb size={16} /> Sugerir un cambio
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(member)}
                style={{ ...actionButtonStyle, backgroundColor: 'var(--drawer-accent)', color: 'var(--body-bg)', border: 'none' }}
              >
                <Edit3 size={16} /> Editar
              </button>
            )}
          </div>

        </div>

      </div>

      <style jsx>{`
        /* Custom scrollbar for parchment feel */
        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: rgba(44,24,16,0.05);
        }
        div::-webkit-scrollbar-thumb {
          background: #D4822A;
          border-radius: 10px;
        }
      `}</style>
    </>
  )
}

// Sub-styles
const badgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  backgroundColor: 'var(--accent-gold-soft)',
  borderRadius: '20px',
  fontSize: '13px',
  fontWeight: '700',
  color: 'var(--drawer-accent)'
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '15px',
  borderBottom: '1px solid var(--drawer-border)',
  paddingBottom: '10px'
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: '900',
  color: 'var(--drawer-accent)',
  margin: 0
}

const actionButtonStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '12px',
  borderRadius: '12px',
  border: '1.5px solid var(--drawer-border)',
  backgroundColor: 'transparent',
  color: 'var(--drawer-fg)',
  fontSize: '14px',
  fontWeight: '800',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
}
