'use client'

// Wrapper que auto-detecta un link de video en el texto, muestra el texto
// limpio + card de video debajo, y expone un state para el drawer del
// reproductor. Sirve en historias, comentarios, buzón y chats.

import React, { useState } from 'react'
import { splitTextAndVideo, type VideoLink } from '@/lib/videoLinkParser'
import VideoLinkCard from './VideoLinkCard'
import VideoPlayerDrawer from './VideoPlayerDrawer'

interface RichTextWithVideoProps {
  text: string
  size?: 'small' | 'medium'
  textStyle?: React.CSSProperties
}

export default function RichTextWithVideo({ text, size = 'medium', textStyle }: RichTextWithVideoProps) {
  const [openVideo, setOpenVideo] = useState<VideoLink | null>(null)
  const { cleanText, video } = splitTextAndVideo(text)

  return (
    <>
      {cleanText && (
        <div style={{ ...textStyle, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {cleanText}
        </div>
      )}
      {video && (
        <div style={{ marginTop: cleanText ? '10px' : 0 }}>
          <VideoLinkCard video={video} onOpen={setOpenVideo} size={size} />
        </div>
      )}
      {openVideo && (
        <VideoPlayerDrawer video={openVideo} onClose={() => setOpenVideo(null)} />
      )}
    </>
  )
}
