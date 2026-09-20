import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

// Sistema de notificaciones persistente:
//  - Las notificaciones de eventos vivos (chat, comentarios en eventos, buzón)
//    se generan por triggers en Postgres (migration 010) y se guardan en la
//    tabla public.notifications. Este hook las lee ordenadas y sincroniza el
//    contador de "sin leer" en tiempo real.
//  - Los recordatorios calculados al vuelo (cumpleaños próximos, eventos con
//    fecha en los próximos 7 días) siguen como derivados y se calculan cada
//    build() — no se guardan porque cambian solos con el tiempo.

export type NotifType =
  | 'birthday' | 'event'
  | 'chat' | 'story_comment' | 'event_comment' | 'wall'

export interface AppNotification {
  id: string
  type: NotifType
  title: string
  body?: string
  time: string
  action: 'open_events' | 'open_stories' | 'open_chat' | 'open_event_thread' | 'open_wall'
  sortKey: string
  senderMemberId?: string
  activityId?: string
  isRead: boolean
  isDerived: boolean       // true = calculada al vuelo (no vive en BD)
  createdAt: string
}

function daysUntilNextBirthday(isoDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [, m, d] = isoDate.split('-').map(Number)
  let next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

function daysUntilEvent(isoDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
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
const VISIBLE_LIMIT = 30

export function useNotifications(treeId: string, members: Member[]) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const build = useCallback(async () => {
    const list: AppNotification[] = []

    // 1. Cumpleaños próximos (derivados, no en BD)
    members
      .filter(m => m.dateOfBirth && !m.dateOfDeath)
      .forEach(m => {
        const days = daysUntilNextBirthday(m.dateOfBirth!)
        if (days > DAYS_AHEAD) return
        const label = days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `En ${days} días`
        list.push({
          id: `bday-${m.id}`,
          type: 'birthday',
          title: `🎂 ${label}: cumpleaños de ${m.firstName} ${m.lastName}`,
          time: label,
          action: 'open_events',
          sortKey: `0-${String(days).padStart(3, '0')}`,
          isRead: false,
          isDerived: true,
          createdAt: new Date().toISOString(),
        })
      })

    // 2. Eventos próximos (derivados)
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
          list.push({
            id: `ev-${a.id}`,
            type: 'event',
            title: `📅 ${label}: ${a.title}`,
            time: label,
            action: 'open_events',
            sortKey: `0-${String(days).padStart(3, '0')}-${a.id}`,
            isRead: false,
            isDerived: true,
            createdAt: new Date().toISOString(),
          })
        })
    } catch { /* ignore */ }

    // 3. Persistentes de la tabla notifications (no descartadas, últimas 60 días)
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .is('dismissed_at', null)
        .gte('created_at', new Date(Date.now() - 60 * 86_400_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(VISIBLE_LIMIT)

      ;(data || []).forEach((n: any) => {
        const emoji = n.type === 'chat' ? '💬'
          : n.type === 'wall' ? '👨‍👩‍👧'
          : n.type === 'event_comment' ? '📅'
          : n.type === 'story_comment' ? '📖' : '🔔'
        const senderMember = n.sender_id
          ? members.find(m => m.userId === n.sender_id)
          : null
        list.push({
          id: n.id,
          type: n.type as NotifType,
          title: `${emoji} ${n.title}`,
          body: n.body,
          time: relativeTime(n.created_at),
          action: n.action as AppNotification['action'],
          senderMemberId: senderMember?.id,
          activityId: n.type === 'event_comment' ? n.related_id : undefined,
          sortKey: `1-${n.created_at}`,
          isRead: !!n.read_at,
          isDerived: false,
          createdAt: n.created_at,
        })
      })
    } catch { /* ignore */ }

    // Sort: derivadas urgentes primero, luego persistentes por fecha desc
    list.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    setNotifications(list.slice(0, VISIBLE_LIMIT))
    setUnreadCount(list.filter(n => !n.isRead && !n.isDerived).length)
  }, [treeId, members])

  useEffect(() => { void build() }, [build])

  // Realtime: refresca cuando entra una nueva notif o alguna cambia.
  useEffect(() => {
    const channel = supabase
      .channel('user-notifs-persist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => void build())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [build])

  // Marca TODAS las persistentes como leídas.
  const markAllRead = useCallback(async () => {
    try {
      await supabase.rpc('notif_mark_all_read')
    } catch { /* ignore */ }
    setUnreadCount(0)
    void build()
  }, [build])

  // Descarta una notif específica (soft delete).
  const dismiss = useCallback(async (id: string) => {
    // Derivada: no está en BD, la escondemos localmente.
    const isDerived = id.startsWith('bday-') || id.startsWith('ev-')
    if (isDerived) {
      setNotifications(prev => prev.filter(n => n.id !== id))
      return
    }
    try {
      await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id)
    } catch { /* ignore */ }
    void build()
  }, [build])

  // Marca una específica como leída al hacer clic.
  const markRead = useCallback(async (id: string) => {
    const isDerived = id.startsWith('bday-') || id.startsWith('ev-')
    if (isDerived) return
    try {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
    } catch { /* ignore */ }
    void build()
  }, [build])

  // Descarta TODAS (para el botón "Borrar todo").
  const dismissAll = useCallback(async () => {
    try {
      await supabase.rpc('notif_dismiss_all')
    } catch { /* ignore */ }
    void build()
  }, [build])

  return { notifications, unreadCount, markAllRead, dismiss, markRead, dismissAll, refresh: build }
}
