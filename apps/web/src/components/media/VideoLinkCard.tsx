'use client'

// Card visual de un link de video. Muestra la portada + overlay con
// botón play dorado. Click abre el drawer del reproductor.
//
// Se puede usar dentro de historias, comentarios, buzón y chats — cualquier
// lugar donde el texto pueda contener un link.

import React, { useState } from 'react'
import { Play, Video, Film } from 'lucide-react'
import type { VideoLink } from '@/lib/videoLinkParser'

interface VideoLinkCardProps {
  video: VideoLink
  onOpen: (video: VideoLink) => void
  size?: 'small' | 'medium'
}

export default function VideoLinkCard({ video, onOpen, size = 'medium' }: VideoLinkCardProps) {
  const [imgError, setImgError] = useState(false)
  const isSmall = size === 'small'

  const width = isSmall ? 180 : 260
  const height = isSmall ? 100 : 145

  const PlatformIcon = video.platform === 'youtube' ? Video : Film
  const platformLabel = video.platform === 'youtube' ? 'YouTube' : 'Vimeo'

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(video) }}
      style={{
        position: 'relative',
        width: `${width}px`, height: `${height}px`,
        border: 'none', borderRadius: '14px', padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(212,175,55,0.35)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        display: 'block',
        backgroundColor: '#1E2A22',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(212,175,55,0.6)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(212,175,55,0.35)'
      }}
    >
      {/* Thumbnail. Si no carga, dejamos el fondo verde con ícono. */}
      {!imgError && (
        <img
          src={video.thumbnailUrl}
          alt="Video preview"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}

      {/* Overlay oscuro para que el botón resalte */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* Botón play centrado en dorado */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: isSmall ? '42px' : '54px',
        height: isSmall ? '42px' : '54px',
        borderRadius: '50%',
        backgroundColor: '#D4AF37',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(212,175,55,0.5)',
      }}>
        <Play size={isSmall ? 18 : 24} color="#1E2A22" fill="#1E2A22" style={{ marginLeft: '2px' }} />
      </div>

      {/* Etiqueta de plataforma abajo a la izquierda */}
      <div style={{
        position: 'absolute',
        bottom: '8px', left: '8px',
        padding: '3px 8px',
        borderRadius: '999px',
        backgroundColor: 'rgba(0,0,0,0.65)',
        color: '#F5E6C8',
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
        display: 'inline-flex', alignItems: 'center', gap: '5px',
      }}>
        <PlatformIcon size={11} /> {platformLabel}
      </div>
    </button>
  )
}
