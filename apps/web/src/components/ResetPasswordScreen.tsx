'use client'

import { useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

// Se muestra cuando la persona abre el enlace del correo "olvidé mi contraseña".
// Supabase ya la dejó con una sesión temporal de recuperación; aquí escribe la nueva.
export default function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setError('')
    if (pass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pass !== pass2) { setError('Las dos contraseñas no coinciden.'); return }
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    setSaving(false)
    if (err) {
      setError(/expired|invalid/i.test(err.message)
        ? 'El enlace ya venció. Pide otro desde "¿Olvidaste tu contraseña?".'
        : 'No se pudo guardar la contraseña. Intenta de nuevo.')
      return
    }
    setSaved(true)
    // Limpia el enlace de la barra de direcciones.
    try { window.history.replaceState({}, '', window.location.pathname) } catch { /* ignore */ }
  }

  const input: CSSProperties = {
    width: '100%', padding: '13px 18px', borderRadius: 12, boxSizing: 'border-box',
    border: '1px solid rgba(212,175,55,0.22)', outline: 'none',
    backgroundColor: 'rgba(255,255,255,0.05)', fontSize: 14, color: '#F5E6C8',
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'radial-gradient(circle at center, #2D5016 0%, #1B2E1B 100%)',
    }}>
      <div style={{
        width: '100%', maxWidth: 380, padding: '32px 26px', borderRadius: 24, textAlign: 'center',
        background: 'rgba(15,26,15,0.82)', border: '1px solid rgba(212,175,55,0.25)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
      }}>
        <h1 style={{ margin: '0 0 8px', fontFamily: "'Playfair Display', serif", fontSize: 24, color: '#F5E6C8' }}>
          {saved ? '¡Listo!' : 'Crea tu contraseña nueva'}
        </h1>
        {saved ? (
          <>
            <p style={{ color: 'rgba(245,230,200,0.75)', fontSize: 14, margin: '0 0 22px' }}>
              Tu contraseña se cambió. Ya puedes entrar a tu árbol.
            </p>
            <button onClick={onDone} style={btn}>Entrar a mi árbol</button>
          </>
        ) : (
          <>
            <p style={{ color: 'rgba(245,230,200,0.7)', fontSize: 13, margin: '0 0 20px' }}>
              Usa al menos 8 caracteres.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="password" placeholder="Contraseña nueva" autoComplete="new-password"
                value={pass} onChange={e => setPass(e.target.value)} style={input} />
              <input type="password" placeholder="Repite la contraseña" autoComplete="new-password"
                value={pass2} onChange={e => setPass2(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save() }} style={input} />
            </div>
            <p role="alert" style={{ minHeight: 20, color: '#FF6B6B', fontSize: 13, fontWeight: 600, margin: '12px 0 4px' }}>
              {error}
            </p>
            <button onClick={save} disabled={saving} style={{ ...btn, opacity: saving ? 0.65 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const btn: CSSProperties = {
  width: '100%', padding: 14, border: 'none', borderRadius: 12, cursor: 'pointer',
  background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)', color: '#0F1A0F',
  fontSize: 15, fontWeight: 700,
}
