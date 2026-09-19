import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

export type NotifType = 'birthday' | 'event' | 'comment' | 'message' | 'event_comment' | 'wall'

export interface AppNotification {
  id: string
  type: NotifType
  text: string
  time: string
  /** Where to navigate on click */
  action: 'open_events' | 'open_stories' | 'open_chat' | 'open_event_thread' | 'open_wall'
  /** ISO date string for sorting */
  sortKey: string
  /** Solo para action='open_chat' — id del member remitente */
  senderMemberId?: string
  /** Solo para action='open_event_thread' — id del evento (activity) */
  activityId?: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function daysUntilNextBirthday(isoDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [, m, d] = isoDate.split('-').map(Number)
  let next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

function daysUntilEvent(isoDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [yr, m, d] = isoDate.split('-').map(Number)
  let next = new Date(yr, m - 1, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

function relativeTime(isoDatetime: string): string {
  const diff = Date.now() - new Date(isoDatetime).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'Ahora mismo'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `Hace ${hrs}h`
  return `Hace ${Math.floor(hrs / 24)}d`
}

const DAYS_AHEAD = 7
const COMMENT_WINDOW_MS = 48 * 3600 * 1000

// ── hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(treeId: string, members: Member[]) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const STORAGE_KEY = `apple_notif_read_${treeId}`

  const getReadIds = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  }, [STORAGE_KEY])

  const markAllRead = useCallback(() => {
    const ids = notifications.map(n => n.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    setUnreadCount(0)
  }, [notifications, STORAGE_KEY])

  const build = useCallback(async () => {
    const notifs: AppNotification[] = []

    // 1. Birthdays ≤ DAYS_AHEAD
    members
      .filter(m => m.dateOfBirth && !m.dateOfDeath)
      .forEach(m => {
        const days = daysUntilNextBirthday(m.dateOfBirth!)
        if (days > DAYS_AHEAD) return
        const label = days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `En ${days} días`
        notifs.push({
          id: `bday-${m.id}`,
          type: 'birthday',
          text: `🎂 ${label} es el cumpleaños de ${m.firstName} ${m.lastName}`,
          time: label,
          action: 'open_events',
          sortKey: String(days).padStart(3, '0'),
        })
      })

    // 2. Upcoming events ≤ DAYS_AHEAD
    try {
      const { data } = await supabase
        .from('activities')
        .select('id, title, description')
        .eq('tree_id', treeId)
        .in('type', ['birthday', 'anniversary', 'memorial', 'achievement', 'greeting'])

      ;(data || [])
        .filter((a: any) => (a.description || '').includes('[EVDATE:'))
        .forEach((a: any) => {
          const match = (a.description as string).match(/\[EVDATE:(\d{4}-\d{2}-\d{2})\]/)
          if (!match) return
          const days = daysUntilEvent(match[1])
          if (days > DAYS_AHEAD) return
          const label = days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `En ${days} días`
          notifs.push({
            id: `ev-${a.id}`,
            type: 'event',
            text: `📅 ${label}: ${a.title}`,
            time: label,
            action: 'open_events',
            sortKey: String(days).padStart(3, '0') + a.id,
          })
        })
    } catch { /* ignore */ }

    // 3. New comments last 48h
    try {
      const since = new Date(Date.now() - COMMENT_WINDOW_MS).toISOString()
      const { data } = await supabase
        .from('story_comments')
        .select('id, content, author_name, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5)

      ;(data || []).forEach((c: any) => {
        notifs.push({
          id: `cmt-${c.id}`,
          type: 'comment',
          text: `💬 ${c.author_name} comentó: "${(c.content as string).substring(0, 50)}${c.content.length > 50 ? '…' : ''}"`,
          time: relativeTime(c.created_at),
          action: 'open_stories',
          sortKey: c.created_at,
        })
      })
    } catch { /* ignore */ }

    // Cargar preferencias de mute UNA vez y usarlas para filtrar todo lo que
    // esté silenciado (chats/eventos/buzón).
    const mutedSet = new Set<string>()
    try {
      const { data: muteRows } = await supabase.from('user_mute_prefs').select('subject_type, subject_id')
      ;(muteRows || []).forEach((r: any) => mutedSet.add(`${r.subject_type}:${r.subject_id}`))
    } catch { /* si la tabla aún no existe, no bloqueamos */ }

    // 4. Mensajes de chat sin leer (agrupados por remitente para no spam)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: myChats } = await supabase
          .from('chats')
          .select('id')
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        const chatIds = (myChats || []).map(c => c.id as string)
        if (chatIds.length > 0) {
          const { data: unreadMsgs } = await supabase
            .from('messages')
            .select('id, chat_id, sender_id, content, created_at')
            .in('chat_id', chatIds)
            .neq('sender_id', user.id)
            .is('read_at', null)
            .order('created_at', { ascending: false })
          const rows = (unreadMsgs || []) as Array<{
            id: string; chat_id: string; sender_id: string; content: string | null; created_at: string
          }>
          if (rows.length > 0) {
            const senderIds = Array.from(new Set(rows.map(r => r.sender_id)))
            senderIds.forEach(senderId => {
              const senderRows = rows.filter(r => r.sender_id === senderId)
              const latest = senderRows[0]
              // Si el chat está silenciado, no generamos notif
              if (mutedSet.has(`chat:${latest.chat_id}`)) return
              const senderMember = members.find(m => m.userId === senderId)
              const senderName = senderMember
                ? `${senderMember.firstName}${senderMember.lastName ? ' ' + senderMember.lastName : ''}`
                : 'Un familiar'
              const preview = latest.content ? latest.content.substring(0, 40) : ''
              const text = senderRows.length === 1
                ? `💬 ${senderName}: "${preview}${preview.length >= 40 ? '…' : ''}"`
                : `💬 ${senderName} te envió ${senderRows.length} mensajes nuevos`
              notifs.push({
                id: `msg-${senderId}`,
                type: 'message',
                text,
                time: relativeTime(latest.created_at),
                action: 'open_chat',
                senderMemberId: senderMember?.id,
                sortKey: `msg-${latest.created_at}`,
              })
            })
          }
        }
      }
    } catch { /* ignore */ }

    // 5. Comentarios nuevos en eventos (agrupados por evento). Respeta mute.
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const since = new Date(Date.now() - COMMENT_WINDOW_MS).toISOString()
      const { data: eventComments } = await supabase
        .from('event_comments')
        .select('id, activity_id, author_name, author_user_id, content, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      const commentRows = (eventComments || []) as Array<{
        id: string; activity_id: string; author_name: string;
        author_user_id: string | null; content: string; created_at: string
      }>
      if (commentRows.length > 0) {
        // Traer títulos de esos eventos
        const activityIds = Array.from(new Set(commentRows.map(r => r.activity_id)))
        const { data: acts } = await supabase
          .from('activities')
          .select('id, title')
          .in('id', activityIds)
        const titleById = new Map<string, string>()
        ;(acts || []).forEach((a: any) => titleById.set(a.id, a.title))

        // Agrupar por activity_id, filtrar propios y muteados
        activityIds.forEach(actId => {
          if (mutedSet.has(`event:${actId}`)) return
          const rows = commentRows.filter(r => r.activity_id === actId && r.author_user_id !== user?.id)
          if (rows.length === 0) return
          const latest = rows[0]
          const eventTitle = titleById.get(actId) || 'Evento'
          const preview = latest.content.substring(0, 40)
          const text = rows.length === 1
            ? `📅 ${latest.author_name} comentó en "${eventTitle}": "${preview}${preview.length >= 40 ? '…' : ''}"`
            : `📅 ${rows.length} nuevos comentarios en "${eventTitle}"`
          notifs.push({
            id: `evcmt-${actId}`,
            type: 'event_comment',
            text,
            time: relativeTime(latest.created_at),
            action: 'open_event_thread',
            activityId: actId,
            sortKey: `evcmt-${latest.created_at}`,
          })
        })
      }
    } catch { /* ignore */ }

    // 6. Mensajes nuevos en el Buzón Familiar. Respeta mute del wall.
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mutedSet.has(`wall:${treeId}`)) {
        const since = new Date(Date.now() - COMMENT_WINDOW_MS).toISOString()
        const { data: wallRows } = await supabase
          .from('family_wall_messages')
          .select('id, author_name, author_user_id, content, created_at')
          .eq('tree_id', treeId)
          .eq('is_deleted', false)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20)
        const rows = ((wallRows || []) as Array<{
          id: string; author_name: string; author_user_id: string | null; content: string; created_at: string
        }>).filter(r => r.author_user_id !== user?.id)
        if (rows.length > 0) {
          const latest = rows[0]
          const preview = latest.content.substring(0, 40)
          const text = rows.length === 1
            ? `👨‍👩‍👧 ${latest.author_name}: "${preview}${preview.length >= 40 ? '…' : ''}"`
            : `👨‍👩‍👧 ${rows.length} mensajes nuevos en el Buzón`
          notifs.push({
            id: `wall-${treeId}`,
            type: 'wall',
            text,
            time: relativeTime(latest.created_at),
            action: 'open_wall',
            sortKey: `wall-${latest.created_at}`,
          })
        }
      }
    } catch { /* ignore */ }

    // Sort: días adelantados primero, luego por sortKey descendente
    notifs.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    const readIds = getReadIds()
    const unread = notifs.filter(n => !readIds.has(n.id)).length

    setNotifications(notifs.slice(0, 10))
    setUnreadCount(unread)
  }, [treeId, members, getReadIds])

  useEffect(() => { build() }, [build])

  // Suscripción Realtime: mensajes de chat, comentarios de eventos y
  // buzón familiar. Un mismo canal escucha las 3 tablas y refresca
  // build() al llegar cualquier cosa. RLS filtra por participación.
  useEffect(() => {
    const channel = supabase
      .channel('user-notifs-all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => build())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => build())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_comments' }, () => build())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_wall_messages' }, () => build())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [build])

  return { notifications, unreadCount, markAllRead, refresh: build }
}
