import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

export type NotifType = 'birthday' | 'event' | 'comment'

export interface AppNotification {
  id: string
  type: NotifType
  text: string
  time: string
  /** Where to navigate on click */
  action: 'open_events' | 'open_stories'
  /** ISO date string for sorting */
  sortKey: string
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

    // Sort: days-ahead items first, then by sortKey
    notifs.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    const readIds = getReadIds()
    const unread = notifs.filter(n => !readIds.has(n.id)).length

    setNotifications(notifs.slice(0, 10))
    setUnreadCount(unread)
  }, [treeId, members, getReadIds])

  useEffect(() => { build() }, [build])

  return { notifications, unreadCount, markAllRead, refresh: build }
}
