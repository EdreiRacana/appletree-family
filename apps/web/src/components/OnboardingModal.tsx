'use client'

// Onboarding para usuarios nuevos que aún no tienen árbol propio ni invitación.
// Pide el nombre de la familia (obligatorio) y datos personales opcionales.
// Al enviar llama a bootstrap_user_tree y devuelve el nuevo tree_id.

import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { TreePine, ArrowRight } from 'lucide-react'
import { bootstrapUserTree } from '@/lib/treesApi'

interface OnboardingModalProps {
  defaultFirstName?: string
  onCreated: (treeId: string) => void
}

export default function OnboardingModal({ defaultFirstName, onCreated }: OnboardingModalProps) {
  const [familyName, setFamilyName] = useState('')
  const [firstName, setFirstName] = useState(defaultFirstName || '')
  const [lastName, setLastName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!familyName.trim()) {
      setError('Escribe un nombre para tu familia.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const treeId = await bootstrapUserTree({
        familyName: familyName.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      })
      onCreated(treeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear tu árbol. Intenta de nuevo.')
      setBusy(false)
    }
  }, [familyName, firstName, lastName, onCreated])

  const overlay = (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(10, 20, 15, 0.88)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      zIndex: 9999,
    }}>
      <div style={{
        width: 'min(480px, 100%)',
        backgroundColor: '#1E2A22',
        borderRadius: '22px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.35)',
        padding: '36px 32px',
        color: '#F5E6C8',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header con logo iconográfico */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '50%',
            backgroundColor: '#D4AF37', color: '#1E2A22',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(212,175,55,0.4)',
            marginBottom: '16px',
          }}>
            <TreePine size={32} strokeWidth={2.2} />
          </div>
          <h1 style={{
            margin: 0, fontFamily: 'Georgia, serif',
            fontSize: '26px', fontWeight: 600, color: '#D4AF37',
            letterSpacing: '0.01em',
          }}>
            Bienvenido a AppleFamily
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: '13.5px', opacity: 0.8, lineHeight: 1.5 }}>
            Antes de empezar, cuéntanos cómo se llama tu familia.<br />
            Vas a crear tu propio árbol privado.
          </p>
        </div>

        {/* Formulario */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{
              fontSize: '11px', letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 700, color: '#D4AF37',
            }}>
              Nombre de la familia <span style={{ color: '#B22222' }}>*</span>
            </span>
            <input
              type="text"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="Ej. Familia Ramírez"
              autoFocus
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={labelStyle}>Tu nombre</span>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Nombre"
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={labelStyle}>Tu apellido</span>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Apellido"
                style={inputStyle}
              />
            </label>
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: '10px',
              backgroundColor: 'rgba(178, 34, 34, 0.15)',
              color: '#FFB4A2', fontSize: '13px',
              border: '1px solid rgba(178, 34, 34, 0.4)',
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={busy || !familyName.trim()}
            style={{
              marginTop: '10px',
              padding: '14px 22px', borderRadius: '999px',
              backgroundColor: '#D4AF37', color: '#1E2A22',
              border: 'none', fontWeight: 700, fontSize: '14.5px',
              letterSpacing: '0.02em',
              cursor: busy || !familyName.trim() ? 'not-allowed' : 'pointer',
              opacity: busy || !familyName.trim() ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              boxShadow: '0 6px 18px rgba(212,175,55,0.35)',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
          >
            {busy ? 'Creando tu árbol…' : (<>Crear mi árbol familiar <ArrowRight size={16} strokeWidth={2.6} /></>)}
          </button>

          <p style={{
            margin: '4px 0 0', fontSize: '11.5px', opacity: 0.55,
            textAlign: 'center', lineHeight: 1.5,
          }}>
            Podrás invitar familiares por correo después.<br />
            Todo es privado — solo tu familia verá tu árbol.
          </p>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(overlay, document.body)
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px', borderRadius: '10px',
  backgroundColor: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(212,175,55,0.35)',
  color: '#F5E6C8', fontSize: '14.5px',
  outline: 'none', fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.08em',
  textTransform: 'uppercase', fontWeight: 700, color: '#D4AF37',
}
