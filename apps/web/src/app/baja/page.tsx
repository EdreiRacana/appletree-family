'use client'

// Página del enlace "Ya no quiero recibir el resumen semanal" del correo.
// Funciona sin iniciar sesión: el enlace trae un código único de la persona.

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import BrandLogo from '@/components/BrandLogo'

type State = 'loading' | 'done' | 'invalid' | 'error'

export default function BajaPage() {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t') || ''
    if (!/^[0-9a-f-]{36}$/i.test(t)) { setState('invalid'); return }
    supabase.rpc('digest_unsubscribe', { p_token: t }).then(({ data, error }) => {
      if (error) setState('error')
      else setState(data ? 'done' : 'invalid')
    })
  }, [])

  const text: Record<State, { title: string, body: string }> = {
    loading: { title: 'Un momento…', body: 'Estamos guardando tu preferencia.' },
    done: { title: 'Listo, ya no recibirás el resumen', body: 'Si cambias de opinión, puedes volver a activarlo en Configuración → Notificaciones.' },
    invalid: { title: 'Este enlace no es válido', body: 'Puede que ya no exista. Puedes desactivar el resumen en Configuración → Notificaciones.' },
    error: { title: 'No pudimos guardar tu preferencia', body: 'Intenta de nuevo en unos minutos o desactívalo en Configuración → Notificaciones.' },
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
      background: 'radial-gradient(circle at center, #2D5016 0%, #1B2E1B 100%)', color: '#F5E6C8',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        maxWidth: '420px', width: '100%', textAlign: 'center', padding: '34px 28px', borderRadius: '20px',
        background: 'rgba(30,42,34,0.75)', border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}><BrandLogo height={64} /></div>
        <h1 style={{ margin: '0 0 10px', fontFamily: 'Georgia, serif', fontSize: '22px', color: '#D4AF37', fontWeight: 600 }}>
          {text[state].title}
        </h1>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, opacity: 0.88 }}>{text[state].body}</p>
        <a href="/" style={{
          display: 'inline-block', marginTop: '22px', padding: '11px 24px', borderRadius: '999px',
          background: '#D4AF37', color: '#1E2A22', fontWeight: 700, fontSize: '14px', textDecoration: 'none',
        }}>
          Ir a AppleFamily Tree
        </a>
      </div>
    </main>
  )
}
