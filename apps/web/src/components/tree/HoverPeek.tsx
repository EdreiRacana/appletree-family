'use client'

import { MessageCircle, MoreHorizontal } from 'lucide-react'
import type { Member } from '@/lib/types'

interface HoverPeekProps {
  member: Member
  onExpand: () => void
  onQuickContact: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

// Pill discreto: solo nombre + botón de contacto rápido + botón de expandir.
// Aparece al hover sobre la manzana. Es invisible en el flujo hasta que se
// necesite algo específico — no invade el árbol como el menu completo.
export default function HoverPeek({
  member,
  onExpand,
  onQuickContact,
  onMouseEnter,
  onMouseLeave,
}: HoverPeekProps) {
  const fullName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`
  const isDeceased = !!member.dateOfDeath
  const isBaby = member.isBaby

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        top: '-58px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 8px 6px 12px',
        borderRadius: '999px',
        backgroundColor: 'var(--chrome-bg)',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        border: '1px solid var(--chrome-border)',
        boxShadow: 'var(--panel-shadow)',
        color: 'var(--chrome-fg-strong)',
        fontFamily: "'Inter', sans-serif",
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        zIndex: 5000,
        pointerEvents: 'auto',
        animation: 'peekFadeUp 0.18s cubic-bezier(0.22, 0.61, 0.36, 1)',
      }}
    >
      <span style={{ paddingRight: '2px' }}>{fullName}</span>

      {/* Botón contacto (solo si no es fallecido ni bebé) */}
      {!isDeceased && !isBaby && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onQuickContact()
          }}
          title="Contactar"
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            border: '1px solid var(--chrome-border)',
            background: 'var(--accent-gold-soft)',
            color: 'var(--chrome-fg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <MessageCircle size={13} />
        </button>
      )}

      {/* Botón expandir menú completo */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onExpand()
        }}
        title="Más opciones"
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          border: '1px solid var(--chrome-border)',
          background: 'transparent',
          color: 'var(--chrome-fg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <MoreHorizontal size={14} />
      </button>

      <style jsx>{`
        @keyframes peekFadeUp {
          from { opacity: 0; transform: translate(-50%, 6px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}
