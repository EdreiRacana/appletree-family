'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, MoreHorizontal } from 'lucide-react'
import type { Member } from '@/lib/types'

interface HoverPeekProps {
  member: Member
  // Screen coordinates (viewport pixels) — se computan en TreeCanvas a partir
  // de la posición de la manzana en pan/zoom. Como usamos position: fixed el
  // peek nunca queda contenido dentro del transform del container ni clipped
  // por el topbar/sidebar.
  screenX: number
  screenY: number
  flipBelow: boolean
  onExpand: () => void
  onQuickContact: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

// Pill discreto: nombre + botón contacto + botón expandir. Aparece al hover
// sobre la manzana. Se auto-voltea abajo si la manzana está cerca del top
// del viewport (para no quedar bajo el topbar). Fallecidos no ven el botón
// de contacto (isDeceased) porque ya no se les puede contactar.
export default function HoverPeek({
  member,
  screenX,
  screenY,
  flipBelow,
  onExpand,
  onQuickContact,
  onMouseEnter,
  onMouseLeave,
}: HoverPeekProps) {
  const fullName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`
  const isDeceased = !!member.dateOfDeath
  const isBaby = member.isBaby
  const canContact = !isDeceased && !isBaby

  // Portal a document.body para escapar del pan-zoom transform. Un
  // position:fixed ADENTRO de un ancestro con transform:translate/scale
  // se posiciona relativo a ese ancestro, no al viewport. Ese es el bug
  // que hacía que el peek apareciera lejos aunque las coords fueran las
  // correctas. Al portalizar, position:fixed sí se ancla al viewport.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const peekNode = (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: `${screenX}px`,
        top: `${screenY}px`,
        // Modo arriba: el ancla es el borde superior de la manzana, así que
        // subimos el peek completo con translateY(-100%). Modo abajo: el
        // ancla es el borde inferior de la manzana; dejamos el peek pegado
        // hacia abajo. En ambos casos translateX(-50%) lo centra en X.
        transform: flipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
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
        zIndex: 10000,
        pointerEvents: 'auto',
        animation: flipBelow
          ? 'peekFadeDown 0.18s cubic-bezier(0.22, 0.61, 0.36, 1)'
          : 'peekFadeUp 0.18s cubic-bezier(0.22, 0.61, 0.36, 1)',
      }}
    >
      <span style={{ paddingRight: '2px' }}>{fullName}</span>

      {canContact && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onQuickContact()
          }}
          title="Contactar"
          style={{
            width: '28px',
            height: '28px',
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
          <MessageCircle size={14} />
        </button>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation()
          onExpand()
        }}
        title="Más opciones"
        style={{
          width: '28px',
          height: '28px',
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
        <MoreHorizontal size={16} />
      </button>

      <style jsx>{`
        /* peekFadeUp: peek arriba de la manzana → resting = translate(-50%,-100%).
           Aparece deslizándose 6px hacia arriba. */
        @keyframes peekFadeUp {
          from { opacity: 0; transform: translate(-50%, calc(-100% + 6px)); }
          to   { opacity: 1; transform: translate(-50%, -100%); }
        }
        /* peekFadeDown: peek abajo de la manzana → resting = translate(-50%,0). */
        @keyframes peekFadeDown {
          from { opacity: 0; transform: translate(-50%, -6px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )

  return createPortal(peekNode, document.body)
}
