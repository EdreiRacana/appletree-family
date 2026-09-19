'use client'

// Drawer que abre al hacer click en un evento. Muestra:
//  - Header con título/fecha del evento + botón silenciar
//  - Lista de comentarios (Realtime)
//  - Input para agregar comentario

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, Calendar } from 'lucide-react'
import {
  listEventComments,
  postEventComment,
  subscribeToEventComments,
  type EventComment,
} from '@/lib/eventCommentsApi'
import { listMyMutes, toMuteKeySet, isMuted } from '@/lib/muteApi'
import { supabase } from '@/lib/supabase'
import MuteToggle from '@/components/MuteToggle'

interface EventCommentsPanelProps {
  activityId: string
  title: string
  dateLabel: string
  authorName: string
  authorAvatarUrl?: string | null
  onClose: () => void
}

export default function EventCommentsPanel({
  activityId,
  title,
  dateLabel,
  authorName,
  authorAvatarUrl,
  onClose,
}: EventCommentsPanelProps) {
  const [comments, setComments] = useState<EventComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [muted, setMuted] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Inicia sesión para comentar.')
      setMyUserId(user.id)

      const [rows, mutes] = await Promise.all([
        listEventComments(activityId),
        listMyMutes(),
      ])
      setComments(rows)
      setMuted(isMuted(toMuteKeySet(mutes), 'event', activityId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando comentarios.')
    } finally {
      setLoading(false)
    }
  }, [activityId])

  useEffect(() => { void load() }, [load])

  // Realtime: nuevos comentarios entran solos
  useEffect(() => {
    const unsub = subscribeToEventComments(activityId, (comment) => {
      setComments(prev => prev.some(c => c.id === comment.id) ? prev : [...prev, comment])
    })
    return unsub
  }, [activityId])

  // Auto-scroll al final
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [comments.length])

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return
    setSending(true)
    try {
      await postEventComment(activityId, draft.trim(), {
        name: authorName,
        avatarUrl: authorAvatarUrl,
      })
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el comentario.')
    } finally {
      setSending(false)
    }
  }, [activityId, draft, sending, authorName, authorAvatarUrl])

  return (
    <div style={{
      position: 'fixed',
      top: '88px', right: '18px', bottom: '18px',
      width: 'min(420px, calc(100vw - 36px))',
      backgroundColor: 'var(--drawer-bg)',
      backdropFilter: 'blur(26px) saturate(140%)',
      WebkitBackdropFilter: 'blur(26px) saturate(140%)',
      boxShadow: 'var(--panel-shadow)',
      borderRadius: '18px',
      zIndex: 4002,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid var(--drawer-border)',
      color: 'var(--drawer-fg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--drawer-border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Calendar size={14} style={{ opacity: 0.6 }} />
              <span style={{ fontSize: '11px', opacity: 0.7, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                {dateLabel}
              </span>
            </div>
            <h2 style={{
              margin: 0, fontFamily: 'var(--font-display)',
              fontSize: '18px', fontWeight: 700, lineHeight: 1.25,
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {title}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--accent-gold-soft)',
            border: '1px solid var(--drawer-border)',
            borderRadius: '50%', width: '30px', height: '30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--drawer-accent)', flexShrink: 0,
          }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ marginTop: '10px' }}>
          <MuteToggle
            subjectType="event"
            subjectId={activityId}
            initialMuted={muted}
            onChange={setMuted}
            label={muted ? 'Notificaciones silenciadas' : 'Notificaciones activas'}
          />
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', opacity: 0.6, fontSize: '13px', padding: '20px' }}>Cargando…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: '#B22222', fontSize: '13px', padding: '20px' }}>{error}</div>
        ) : comments.length === 0 ? (
          <div style={{ textAlign: 'center', opacity: 0.55, padding: '32px 16px', fontSize: '13px' }}>
            Sé el primero en comentar.
          </div>
        ) : (
          comments.map(c => {
            const mine = c.authorUserId === myUserId
            return (
              <div key={c.id} style={{
                display: 'flex', gap: '10px',
                flexDirection: mine ? 'row-reverse' : 'row',
              }}>
                <img
                  src={c.authorAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.authorName)}`}
                  alt={c.authorName}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid var(--drawer-accent)' }}
                />
                <div style={{ maxWidth: '78%' }}>
                  <div style={{ fontSize: '10px', opacity: 0.7, fontWeight: 700, marginBottom: '3px', textAlign: mine ? 'right' : 'left' }}>
                    {mine ? 'Tú' : c.authorName} · {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    backgroundColor: mine ? 'var(--drawer-accent)' : 'var(--accent-gold-soft)',
                    color: mine ? 'var(--body-bg)' : 'var(--drawer-fg)',
                    padding: '9px 13px',
                    borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: '14px', lineHeight: 1.4, wordBreak: 'break-word',
                  }}>
                    {c.content}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--drawer-border)',
        display: 'flex', gap: '8px', alignItems: 'flex-end',
      }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Escribe un comentario…"
          rows={1}
          style={{
            flex: 1, resize: 'none',
            minHeight: '36px', maxHeight: '120px',
            padding: '9px 12px', borderRadius: '18px',
            border: '1px solid var(--drawer-border)',
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: 'var(--drawer-fg)',
            fontSize: '14px', fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={!draft.trim() || sending}
          style={{
            width: '38px', height: '38px', borderRadius: '50%',
            backgroundColor: 'var(--drawer-accent)',
            color: 'var(--body-bg)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
            opacity: draft.trim() && !sending ? 1 : 0.5,
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
