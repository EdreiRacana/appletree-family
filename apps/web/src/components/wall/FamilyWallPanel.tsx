'use client'

// Buzón Familiar — un solo grupo por árbol para banter cotidiano.
// Estilo similar a chat, pero abierto a todos los miembros registrados.

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Send, X, Users } from 'lucide-react'
import { listWallMessages, postWallMessage, subscribeToWall, type WallMessage } from '@/lib/familyWallApi'
import { listMyMutes, toMuteKeySet, isMuted } from '@/lib/muteApi'
import { supabase } from '@/lib/supabase'
import MuteToggle from '@/components/MuteToggle'
import RichTextWithVideo from '@/components/media/RichTextWithVideo'

interface FamilyWallPanelProps {
  treeId: string
  authorName: string
  authorAvatarUrl?: string | null
  onClose: () => void
}

export default function FamilyWallPanel({ treeId, authorName, authorAvatarUrl, onClose }: FamilyWallPanelProps) {
  const [messages, setMessages] = useState<WallMessage[]>([])
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
      if (!user) throw new Error('Inicia sesión para participar en el buzón.')
      setMyUserId(user.id)

      const [rows, mutes] = await Promise.all([
        listWallMessages(treeId),
        listMyMutes(),
      ])
      setMessages(rows)
      setMuted(isMuted(toMuteKeySet(mutes), 'wall', treeId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el buzón.')
    } finally {
      setLoading(false)
    }
  }, [treeId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const unsub = subscribeToWall(treeId, (msg) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
    })
    return unsub
  }, [treeId])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return
    setSending(true)
    try {
      await postWallMessage(treeId, draft.trim(), { name: authorName, avatarUrl: authorAvatarUrl })
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }, [treeId, draft, sending, authorName, authorAvatarUrl])

  return (
    <div style={{
      position: 'fixed',
      top: '92px', left: '128px', bottom: '24px',
      width: 'min(440px, calc(100vw - 156px))',
      backgroundColor: 'var(--drawer-bg)',
      backdropFilter: 'blur(26px) saturate(140%)',
      WebkitBackdropFilter: 'blur(26px) saturate(140%)',
      boxShadow: 'var(--panel-shadow)',
      borderRadius: '18px',
      zIndex: 3900,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid var(--drawer-border)',
      color: 'var(--drawer-fg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--drawer-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              backgroundColor: 'var(--drawer-accent)', color: 'var(--body-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
                Buzón Familiar
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', opacity: 0.7, letterSpacing: '0.05em' }}>
                Todos los familiares con cuenta pueden participar
              </p>
            </div>
          </div>
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
        <div style={{ marginTop: '10px' }}>
          <MuteToggle
            subjectType="wall"
            subjectId={treeId}
            initialMuted={muted}
            onChange={setMuted}
            label={muted ? 'Buzón silenciado' : 'Buzón activo'}
          />
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', opacity: 0.6, fontSize: '13px', padding: '20px' }}>Cargando…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: '#B22222', fontSize: '13px', padding: '20px' }}>{error}</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', opacity: 0.55, padding: '32px 16px', fontSize: '13px' }}>
            El buzón está vacío.<br />Escribe el primer mensaje familiar.
          </div>
        ) : (
          messages.map(m => {
            const mine = m.authorUserId === myUserId
            return (
              <div key={m.id} style={{ display: 'flex', gap: '10px', flexDirection: mine ? 'row-reverse' : 'row' }}>
                <img
                  src={m.authorAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.authorName)}`}
                  alt={m.authorName}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid var(--drawer-accent)' }}
                />
                <div style={{ maxWidth: '78%' }}>
                  <div style={{ fontSize: '10px', opacity: 0.7, fontWeight: 700, marginBottom: '3px', textAlign: mine ? 'right' : 'left' }}>
                    {mine ? 'Tú' : m.authorName} · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    backgroundColor: mine ? 'var(--drawer-accent)' : 'var(--accent-gold-soft)',
                    color: mine ? 'var(--body-bg)' : 'var(--drawer-fg)',
                    padding: '9px 13px',
                    borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: '14px', lineHeight: 1.4, wordBreak: 'break-word',
                  }}>
                    <RichTextWithVideo text={m.content} size="small" />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--drawer-border)', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Comparte con la familia… pega un link de YouTube o Vimeo para adjuntar un video"
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
            backgroundColor: 'var(--drawer-accent)', color: 'var(--body-bg)',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
