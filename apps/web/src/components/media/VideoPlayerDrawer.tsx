'use client'

// Drawer lateral con el reproductor embebido. Iframe responsive con
// aspect-ratio 16:9. Portalizado a body para evitar problemas de
// stacking con pan/zoom del árbol.

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink } from 'lucide-react'
import type { VideoLink } from '@/lib/videoLinkParser'

interface VideoPlayerDrawerProps {
  video: VideoLink
  onClose: () => void
}

export default function VideoPlayerDrawer({ video, onClose }: VideoPlayerDrawerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Escape para cerrar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  const externalUrl = video.platform === 'youtube'
    ? `https://youtube.com/watch?v=${video.id}`
    : `https://vimeo.com/${video.id}`

  const drawer = (
    <div style={{
      position: 'fixed',
      top: '88px', right: '18px', bottom: '18px',
      width: 'min(520px, calc(100vw - 36px))',
      backgroundColor: 'var(--drawer-bg)',
      backdropFilter: 'blur(26px) saturate(140%)',
      WebkitBackdropFilter: 'blur(26px) saturate(140%)',
      boxShadow: 'var(--panel-shadow)',
      borderRadius: '18px',
      zIndex: 5000,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid var(--drawer-border)',
      color: 'var(--drawer-fg)',
      overflow: 'hidden',
      animation: 'videoDrawerIn 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--drawer-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7, fontWeight: 700 }}>
          {video.platform === 'youtube' ? '▶ YouTube' : '▶ Vimeo'}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'var(--accent-gold-soft)',
              border: '1px solid var(--drawer-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--drawer-accent)',
              textDecoration: 'none',
            }}
            title="Abrir en la plataforma original"
          >
            <ExternalLink size={14} />
          </a>
          <button onClick={onClose} style={{
            background: 'var(--accent-gold-soft)',
            border: '1px solid var(--drawer-border)',
            borderRadius: '50%', width: '30px', height: '30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--drawer-accent)',
          }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Reproductor 16:9 responsive */}
      <div style={{ padding: '16px' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '56.25%', // 16:9
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <iframe
            src={video.embedUrl}
            title="Video familiar"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%', border: 'none',
            }}
          />
        </div>
        <p style={{ margin: '14px 2px 0', fontSize: '11px', opacity: 0.55, lineHeight: 1.5 }}>
          El video se reproduce directo desde {video.platform === 'youtube' ? 'YouTube' : 'Vimeo'}.
          AppleFamily solo guarda el enlace — el archivo vive en la plataforma original.
        </p>
      </div>

      <style jsx>{`
        @keyframes videoDrawerIn {
          from { opacity: 0; transform: translateX(30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )

  return createPortal(drawer, document.body)
}
