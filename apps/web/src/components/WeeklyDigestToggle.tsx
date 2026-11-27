'use client'

import React, { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Interruptor "Resumen semanal por correo" (Configuración → Notificaciones).
export default function WeeklyDigestToggle() {
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('users').select('weekly_digest').eq('id', user.id).maybeSingle()
      if (!alive) return
      if (error) { setOn(true); return }   // columna aún no creada: se asume activo
      setOn(data?.weekly_digest ?? true)
    })()
    return () => { alive = false }
  }, [])

  const toggle = async () => {
    if (on === null) return
    setBusy(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const next = !on
    const { error } = await supabase.from('users').update({ weekly_digest: next }).eq('id', user?.id ?? '')
    setBusy(false)
    if (error) { setError('No se pudo guardar. Intenta de nuevo.'); return }
    setOn(next)
  }

  return (
    <div style={{
      marginTop: '16px', padding: '16px 18px', borderRadius: '14px',
      backgroundColor: on ? 'rgba(212,175,55,0.10)' : 'rgba(139,69,19,0.05)',
      border: on ? '1px solid rgba(184,134,11,0.4)' : '1px solid rgba(139,69,19,0.15)',
      display: 'flex', alignItems: 'center', gap: '14px',
    }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
        backgroundColor: on ? '#B8860B' : '#8B4513', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Mail size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#2C1810' }}>Resumen semanal por correo</div>
        <div style={{ fontSize: '12px', opacity: 0.75, color: '#5D4037' }}>
          Cada domingo: cumpleaños de la semana, a quién recordamos e historias nuevas.
        </div>
        {error && <div style={{ fontSize: '12px', color: '#B00020', marginTop: '4px' }}>{error}</div>}
      </div>
      <button
        role="switch"
        aria-checked={!!on}
        aria-label="Resumen semanal por correo"
        onClick={toggle}
        disabled={busy || on === null}
        style={{
          width: '48px', height: '28px', borderRadius: '999px', border: 'none', flexShrink: 0,
          backgroundColor: on ? '#B8860B' : 'rgba(93,64,55,0.3)', position: 'relative',
          cursor: busy ? 'wait' : 'pointer', transition: 'background-color 0.2s', opacity: on === null ? 0.5 : 1,
        }}
      >
        <span style={{
          position: 'absolute', top: '3px', left: on ? '23px' : '3px', width: '22px', height: '22px',
          borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}
