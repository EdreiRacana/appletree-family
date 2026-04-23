'use client'

import React, { useEffect, useState } from 'react'
import { X, Briefcase, BookOpen, MapPin, Calendar, Award, Heart, MessageCircle, Share2, Edit3 } from 'lucide-react'
import type { Member } from '@/lib/types'

interface MemberProfilePanelProps {
  member: Member | null
  onClose: () => void
  onEdit?: (member: Member) => void
}

export default function MemberProfilePanel({ member, onClose, onEdit }: MemberProfilePanelProps) {
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

  // Mock Timeline Data (In a real app, this would come from a 'milestones' table)
  const timeline = [
    { year: birthYear, title: 'Nacimiento', desc: `Nacido/a en ${member.birthPlace || 'Lugar desconocido'}` },
    { year: '1995', title: 'Graduación', desc: 'Completó sus estudios con honores.' },
    { year: '2005', title: 'Matrimonio', desc: 'Unión con su pareja actual.' },
  ].filter(item => item.year !== '?')

  return (
    <>
      {/* Backdrop Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 4000,
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
      />

      {/* Main Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '450px',
        height: '100vh',
        backgroundColor: '#FAEFBC', // Warm parchment
        boxShadow: '-10px 0 50px rgba(0,0,0,0.3)',
        zIndex: 4001,
        display: 'flex',
        flexDirection: 'column',
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        borderLeft: '3px solid #D4822A', // Lux Gold Border
      }}>
        
        {/* Header / Cover Area */}
        <div style={{ 
          height: '240px', 
          backgroundColor: '#2C1810', // Deep wood
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflow: 'hidden'
        }}>
          {/* Close Button */}
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              padding: '8px',
              cursor: 'pointer',
              color: '#FAEFBC'
            }}
          >
            <X size={24} />
          </button>

          {/* Medallion */}
          <div style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            border: '4px solid #D4822A',
            overflow: 'hidden',
            backgroundColor: '#FFF',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            marginBottom: '15px'
          }}>
            <img 
              src={member.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`} 
              alt={member.firstName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          <h2 style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: '32px', 
            color: '#FAEFBC', 
            margin: 0,
            textAlign: 'center'
          }}>
            {member.firstName} {member.lastName}
            {member.nickname && <span style={{ fontSize: '18px', opacity: 0.7, display: 'block', fontStyle: 'italic' }}>"{member.nickname}"</span>}
          </h2>
          <p style={{ 
            color: '#D4822A', 
            fontSize: '14px', 
            fontWeight: '700', 
            marginTop: '5px',
            letterSpacing: '0.1em'
          }}>
            {lifeSpan.toUpperCase()}
          </p>
        </div>

        {/* Content Area */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '35px'
        }}>
          
          {/* Quick Info Bar */}
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
             <div style={badgeStyle} title="Ubicación">
               <MapPin size={16} /> {member.birthPlace || 'Sin ubicación'}
             </div>
             <div style={badgeStyle} title="Ocupación">
               <Briefcase size={16} /> {member.occupation || 'Sin ocupación'}
             </div>
          </div>

          {/* Biography */}
          <section>
            <div style={sectionHeaderStyle}>
              <BookOpen size={20} color="#D4822A" />
              <h3 style={sectionTitleStyle}>Biografía de Vida</h3>
            </div>
            <p style={{ 
              fontSize: '16px', 
              lineHeight: '1.7', 
              color: '#3D2B1F',
              fontStyle: 'italic',
              fontFamily: 'serif'
            }}>
              {member.biography || `${member.firstName} es una parte fundamental de nuestra raíz familiar. Su historia se entrelaza con las tradiciones y el amor que hoy nos une. (Biografía en desarrollo para documentar sus mayores logros y memorias).`}
            </p>
          </section>

          {/* Timeline / Milestones */}
          <section>
            <div style={sectionHeaderStyle}>
              <Award size={20} color="#D4822A" />
              <h3 style={sectionTitleStyle}>Línea del Tiempo & Hitos</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '15px' }}>
              {/* Actual Birth Event */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <span style={{ minWidth: '50px', fontSize: '14px', fontWeight: '900', color: '#D4822A', paddingTop: '3px' }}>
                  {birthYear}
                </span>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#2C1810', fontWeight: '800' }}>Nacimiento</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#7A6558', fontWeight: '500' }}>
                    {member.birthPlace ? `Llegada al mundo en ${member.birthPlace}` : 'Comienzo de la historia familiar.'}
                  </p>
                </div>
              </div>

              {/* Dynamic logic could be added here for structured milestones */}
              {member.biography && (
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                  <span style={{ minWidth: '50px', fontSize: '14px', fontWeight: '900', color: '#D4822A', paddingTop: '3px' }}>
                    INFO
                  </span>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#2C1810', fontWeight: '800' }}>Vida y Legado</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#7A6558', fontWeight: '500' }}>
                      Información detallada sobre su trayectoria y momentos clave.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Footer Actions */}
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            marginTop: '20px', 
            paddingTop: '30px', 
            borderTop: '1px solid rgba(44,24,16,0.1)' 
          }}>
            <button style={actionButtonStyle}>
              <MessageCircle size={18} /> Chatear
            </button>
            <button style={actionButtonStyle}>
              <Share2 size={18} /> Compartir
            </button>
            {onEdit && (
              <button onClick={() => onEdit(member)} style={{ ...actionButtonStyle, backgroundColor: '#D4822A', color: 'white', border: 'none' }}>
                <Edit3 size={18} /> Editar
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
  backgroundColor: 'rgba(212, 130, 42, 0.1)',
  borderRadius: '20px',
  fontSize: '13px',
  fontWeight: '700',
  color: '#B8691A'
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '15px',
  borderBottom: '1px solid rgba(212, 130, 42, 0.2)',
  paddingBottom: '10px'
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: '900',
  color: '#B8691A',
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
  border: '1.5px solid rgba(44,24,16,0.2)',
  backgroundColor: 'transparent',
  color: '#2C1810',
  fontSize: '14px',
  fontWeight: '800',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
}
