'use client'

// Reusable mute toggle: 🔕 muted / 🔔 unmuted.
// Persiste en user_mute_prefs. Optimista (invierte de inmediato,
// revierte si falla el update).

import React, { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { muteSubject, unmuteSubject, type MuteSubjectType } from '@/lib/muteApi'

interface MuteToggleProps {
  subjectType: MuteSubjectType
  subjectId: string
  initialMuted: boolean
  onChange?: (muted: boolean) => void
  size?: number
  label?: string
}

export default function MuteToggle({
  subjectType,
  subjectId,
  initialMuted,
  onChange,
  size = 16,
  label,
}: MuteToggleProps) {
  const [muted, setMuted] = useState(initialMuted)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setMuted(initialMuted) }, [initialMuted])

  const toggle = async () => {
    if (busy) return
    const next = !muted
    setMuted(next)
    setBusy(true)
    try {
      if (next) await muteSubject(subjectType, subjectId)
      else await unmuteSubject(subjectType, subjectId)
      onChange?.(next)
    } catch (err) {
      console.error('MuteToggle failed:', err)
      setMuted(!next) // rollback
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); void toggle() }}
      disabled={busy}
      title={muted ? 'Reactivar notificaciones' : 'Silenciar notificaciones'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        border: '1px solid rgba(212,175,55,0.35)',
        backgroundColor: muted ? 'rgba(178,34,34,0.12)' : 'rgba(212,175,55,0.12)',
        color: muted ? '#8B2C1C' : '#8B6508',
        fontSize: '11px', fontWeight: 700,
        cursor: busy ? 'wait' : 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {muted ? <BellOff size={size} /> : <Bell size={size} />}
      {label ?? (muted ? 'Silenciado' : 'Activo')}
    </button>
  )
}
