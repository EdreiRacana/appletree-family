'use client'

// AppleTree Family — Chat Panel
//
// Drawer que se abre desde el HoverPeek "contactar" o desde el drawer de
// perfil. Estilo pill oscuro (matching el drawer del árbol) para que
// visualmente sea "la misma tela" del app. Realtime activo mientras esté
// montado: cualquier mensaje nuevo del otro lado aparece sin refresh.

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, Mail } from 'lucide-react'
import type { Member } from '@/lib/types'
import {
  getOrCreateChat,
  listMessages,
  sendMessage,
  subscribeToChat,
  markChatAsRead,
  type ChatMessage,
} from '@/lib/chatApi'
import { supabase } from '@/lib/supabase'
import RichTextWithVideo from '@/components/media/RichTextWithVideo'

interface ChatPanelProps {
  member: Member
  onClose: () => void
  // Cuando el miembro no tiene user_id (no ha aceptado invitación / es
  // ancestro fallecido), invitar es la única acción posible.
  onInvite?: (member: Member) => void
}

export default function ChatPanel({ member, onClose, onInvite }: ChatPanelProps) {
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const hasAccount = !!member.userId

  // Descubre el chatId + cargar mensajes iniciales.
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      setLoading(true)
      setError(null)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Inicia sesión para chatear.')
        if (cancelled) return
        setMyUserId(user.id)

        if (!hasAccount || !member.userId) {
          setLoading(false)
          return
        }

        const id = await getOrCreateChat(member.userId)
        if (cancelled) return
        setChatId(id)

        const rows = await listMessages(id)
        if (cancelled) return
        setMessages(rows)
        void markChatAsRead(id)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error abriendo el chat.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void bootstrap()
    return () => { cancelled = true }
  }, [member.userId, hasAccount])

  // Suscripción a Realtime — mientras el panel esté montado.
  useEffect(() => {
    if (!chatId) return
    const unsub = subscribeToChat(chatId, (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      if (msg.senderId !== myUserId) void markChatAsRead(chatId)
    })
    return unsub
  }, [chatId, myUserId])

  // Auto-scroll al final cuando entran mensajes nuevos.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const handleSend = useCallback(async () => {
    if (!chatId || !draft.trim() || sending) return
    setSending(true)
    try {
      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}`,
        chatId,
        senderId: myUserId || '',
        content: draft.trim(),
        attachmentUrl: null,
        attachmentType: null,
        status: 'sent',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      }
      setMessages(prev => [...prev, optimistic])
      const text = draft.trim()
      setDraft('')
      const saved = await sendMessage(chatId, text)
      // Reemplazar el optimista por el real (mismo contenido, id real).
      setMessages(prev => prev.map(m => m.id === optimistic.id ? saved : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.')
      // Rollback: quita el optimista con el prefijo tmp-
      setMessages(prev => prev.filter(m => !m.id.startsWith('tmp-')))
    } finally {
      setSending(false)
    }
  }, [chatId, draft, sending, myUserId])

  const fullName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`

  return (
    <div style={{
      position: 'fixed',
      top: '88px',
      right: '18px',
      bottom: '18px',
      width: 'min(380px, calc(100vw - 36px))',
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
      <div style={{
        padding: '18px 20px',
        borderBottom: '1px solid var(--drawer-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          overflow: 'hidden', border: '2px solid var(--drawer-accent)',
          backgroundColor: '#fff', flexShrink: 0,
        }}>
          <img
            src={member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}`}
            alt={member.firstName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700 }}>
            {fullName}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.7, letterSpacing: '0.05em' }}>
            {hasAccount ? 'Conversación privada' : 'Aún no está en AppleFamily'}
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

      {/* Body */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {!hasAccount ? (
          <div style={{ textAlign: 'center', padding: '40px 12px' }}>
            <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '18px' }}>
              {member.firstName} aún no tiene cuenta en AppleFamily. Invítale por
              correo para empezar una conversación.
            </p>
            {onInvite && (
              <button
                onClick={() => onInvite(member)}
                style={{
                  padding: '10px 18px', borderRadius: '999px',
                  backgroundColor: 'var(--drawer-accent)',
                  color: 'var(--body-bg)', border: 'none',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                }}
              >
                <Mail size={14} /> Invitar por correo
              </button>
            )}
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', opacity: 0.6, padding: '20px', fontSize: '13px' }}>
            Cargando…
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: '#B22222', padding: '20px', fontSize: '13px' }}>
            {error}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', opacity: 0.55, padding: '40px 12px', fontSize: '13px' }}>
            Todavía no hay mensajes.<br />Escribe el primero.
          </div>
        ) : (
          messages.map(m => {
            const mine = m.senderId === myUserId
            return (
              <div key={m.id} style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                backgroundColor: mine ? 'var(--drawer-accent)' : 'var(--accent-gold-soft)',
                color: mine ? 'var(--body-bg)' : 'var(--drawer-fg)',
                padding: '9px 13px',
                borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: '14px',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}>
                <RichTextWithVideo text={m.content || ''} size="small" textStyle={{ display: 'block' }} />
                <div style={{ fontSize: '10px', opacity: 0.55, marginTop: '4px', textAlign: 'right' }}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      {hasAccount && (
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--drawer-border)',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
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
            placeholder="Escribe un mensaje…"
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              minHeight: '36px',
              maxHeight: '120px',
              padding: '9px 12px',
              borderRadius: '18px',
              border: '1px solid var(--drawer-border)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: 'var(--drawer-fg)',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!draft.trim() || sending}
            style={{
              width: '38px', height: '38px', borderRadius: '50%',
              backgroundColor: 'var(--drawer-accent)',
              color: 'var(--body-bg)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
              opacity: draft.trim() && !sending ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
