'use client'

import { useEffect, useCallback, type CSSProperties } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

// Ventana para ver la foto de una historia en grande (sin recortes), con su
// título, año y descripción. Flechas (o ← →) para pasar entre historias;
// Esc, la X o tocar fuera la cierran.
export interface LightboxStory {
  id: string
  imageUrl: string
  title: string
  description?: string | null
  badge?: string
}

interface StoryLightboxProps {
  stories: LightboxStory[]
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
}

export default function StoryLightbox({ stories, index, onClose, onIndexChange }: StoryLightboxProps) {
  const story = stories[index]
  const hasPrev = index > 0
  const hasNext = index < stories.length - 1
  const prev = useCallback(() => { if (hasPrev) onIndexChange(index - 1) }, [hasPrev, index, onIndexChange])
  const next = useCallback(() => { if (hasNext) onIndexChange(index + 1) }, [hasNext, index, onIndexChange])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [onClose, prev, next])

  if (!story) return null

  const arrow: CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%',
    border: '1px solid rgba(212,175,55,0.45)', background: 'rgba(20,26,14,0.7)', color: '#F5E6C8',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2,
  }

  return (
    <div
      role="dialog" aria-modal="true" aria-label={story.title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(8,10,6,0.88)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 16px 24px',
      }}
    >
      <button onClick={onClose} aria-label="Cerrar" style={{
        position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: '50%', border: 'none',
        background: 'rgba(255,255,255,0.12)', color: '#F5E6C8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        <X size={22} />
      </button>

      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
        maxWidth: 'min(1100px, 100%)', width: '100%',
      }}>
        {hasPrev && (
          <button onClick={prev} aria-label="Historia anterior" style={{ ...arrow, left: 4 }}><ChevronLeft size={24} /></button>
        )}
        {hasNext && (
          <button onClick={next} aria-label="Historia siguiente" style={{ ...arrow, right: 4 }}><ChevronRight size={24} /></button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={story.imageUrl}
          alt={story.title}
          style={{
            maxWidth: '100%', maxHeight: 'calc(100dvh - 220px)', objectFit: 'contain',
            borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', background: '#111',
          }}
        />
        <div style={{ marginTop: 16, maxWidth: 720, textAlign: 'center', color: '#F5E6C8' }}>
          {story.badge && (
            <span style={{
              display: 'inline-block', marginBottom: 6, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.45)',
            }}>{story.badge}</span>
          )}
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 22 }}>{story.title}</h2>
          {story.description && (
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: 'rgba(245,230,200,0.8)', whiteSpace: 'pre-wrap' }}>
              {story.description}
            </p>
          )}
          {stories.length > 1 && (
            <p style={{ margin: '10px 0 0', fontSize: 11, color: 'rgba(245,230,200,0.45)' }}>{index + 1} de {stories.length}</p>
          )}
        </div>
      </div>
    </div>
  )
}
