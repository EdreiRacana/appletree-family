'use client'

// AppleTree Family — Lista de conversaciones
//
// Estilo WhatsApp: panel a la izquierda del árbol con todas las conversaciones
// del usuario. Click en una → abre el ChatPanel con esa persona.
//
// Usa listMyChats + Realtime para actualizar orden y previews al vuelo.

import React, { useEffect, useState, useCallback } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { listMyChats, type ChatSummary } from '@/lib/chatApi'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

interface ChatsListPanelProps {
  members: Member[]
  onOpenChat: (member: Member) => void
  onClose: () => void
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export default function ChatsListPanel({ members, onOpenChat, onClose }: ChatsListPanelProps) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const rows = await listMyChats()
      setChats(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando chats.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Realtime: actualizar la lista cuando llega un mensaje nuevo o cambia
  // el read_at.
  useEffect(() => {
    const channel = supabase
      .channel('chats-list-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => void load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const memberByUserId = new Map<string, Member>()
  members.forEach(m => { if (m.userId) memberByUserId.set(m.userId, m) })

  return (
    <div style={{
      position: 'fixed',
      top: '92px',
      left: '128px',
      bottom: '24px',
      width: 'min(360px, calc(100vw - 156px))',
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
      <div style={{
        padding: '18px 20px',
        borderBottom: '1px solid var(--drawer-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
            Chats
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '11px', opacity: 0.65, letterSpacing: '0.06em' }}>
            {chats.length === 0 ? 'Sin conversaciones' : `${chats.length} conversación${chats.length === 1 ? '' : 'es'}`}
          </p>
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6, fontSize: '13px' }}>
            Cargando…
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#B22222', fontSize: '13px' }}>
            {error}
          </div>
        ) : chats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', opacity: 0.6 }}>
            <MessageCircle size={40} style={{ opacity: 0.35, marginBottom: '16px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Aún no hay conversaciones
            </p>
            <p style={{ margin: 0, fontSize: '12px', opacity: 0.7, lineHeight: 1.5 }}>
              Abre una manzana del árbol y toca el botón 💬 Chatear para empezar.
            </p>
          </div>
        ) : (
          chats.map(chat => {
            const member = memberByUserId.get(chat.otherUserId)
            const displayName = member
              ? `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`
              : (chat.otherUserName || 'Familiar')
            const avatar = member?.avatarUrl || chat.otherAvatarUrl ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`
            return (
              <button
                key={chat.id}
                onClick={() => { if (member) onOpenChat(member) }}
                disabled={!member}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  cursor: member ? 'pointer' : 'not-allowed',
                  textAlign: 'left',
                  color: 'inherit',
                  opacity: member ? 1 : 0.5,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (member) e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <img
                  src={avatar}
                  alt={displayName}
                  style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0,
                    border: '1.5px solid var(--drawer-accent)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{
                      fontSize: '14px', fontWeight: 700, color: 'var(--drawer-fg)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {displayName}
                    </span>
                    <span style={{ fontSize: '10px', opacity: 0.55, flexShrink: 0, fontWeight: 600 }}>
                      {relativeTime(chat.lastMessageAt)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px', opacity: 0.7,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    fontStyle: chat.lastMessagePreview ? 'normal' : 'italic',
                  }}>
                    {chat.lastMessagePreview || 'Sin mensajes aún'}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
