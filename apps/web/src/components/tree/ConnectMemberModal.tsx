'use client'

// Modal para conectar DOS miembros que ya existen en el arbol.
// Ejemplo: creaste la mamá y el papá por separado; ahora quieres decir
// "Esta mamá es cónyuge del papá" o "Esta mamá es también madre de X hijo".
//
// Flujo:
//   1. Fijamos "de un lado" el miembro origen (el que hizo tap en "...")
//   2. El usuario elige el OTRO miembro del árbol (search + select)
//   3. Elige tipo de relación
//   4. Confirma → INSERT en relationships + UPDATE parents/spouses arrays.

import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Link2, Users, Baby, Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

type ConnType = 'spouse' | 'parent-of' | 'child-of' | 'sibling'

interface ConnectMemberModalProps {
  sourceMember: Member       // Miembro origen (el del "...")
  allMembers: Member[]       // Todos los del árbol para elegir target
  onClose: () => void
  onSaved: () => void        // Refresca datos del árbol
}

const CONN_LABEL: Record<ConnType, string> = {
  'spouse':   'Cónyuge / Pareja',
  'parent-of': 'Es padre / madre de',
  'child-of':  'Es hijo / hija de',
  'sibling':   'Hermano / Hermana',
}

const CONN_ICON: Record<ConnType, React.ComponentType<{ size?: number }>> = {
  'spouse':   Heart,
  'parent-of': Users,
  'child-of':  Baby,
  'sibling':   Users,
}

export default function ConnectMemberModal({ sourceMember, allMembers, onClose, onSaved }: ConnectMemberModalProps) {
  const [connType, setConnType] = useState<ConnType>('spouse')
  const [targetId, setTargetId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allMembers
      .filter(m => m.id !== sourceMember.id)
      .filter(m => {
        if (!q) return true
        const full = `${m.firstName} ${m.lastName || ''}`.toLowerCase()
        return full.includes(q)
      })
      .slice(0, 40)
  }, [allMembers, sourceMember.id, query])

  const target = allMembers.find(m => m.id === targetId) || null

  const handleSave = async () => {
    if (!target) { setError('Elige un familiar del árbol.'); return }
    setBusy(true)
    setError(null)
    try {
      const treeId = sourceMember.treeId

      if (connType === 'spouse') {
        // Update ambos spouses arrays + create relationship row
        await supabase.from('members')
          .update({ spouses: Array.from(new Set([...(sourceMember.spouses || []), target.id])) })
          .eq('id', sourceMember.id)
        await supabase.from('members')
          .update({ spouses: Array.from(new Set([...(target.spouses || []), sourceMember.id])) })
          .eq('id', target.id)
        await supabase.from('relationships').insert({
          tree_id: treeId,
          member1_id: sourceMember.id,
          member2_id: target.id,
          relationship: 'spouse',
        })
      } else if (connType === 'parent-of') {
        // source es padre/madre de target
        await supabase.from('members')
          .update({ parents: Array.from(new Set([...(target.parents || []), sourceMember.id])) })
          .eq('id', target.id)
        await supabase.from('relationships').insert({
          tree_id: treeId,
          member1_id: sourceMember.id,
          member2_id: target.id,
          relationship: 'parent',
        })
      } else if (connType === 'child-of') {
        // source es hijo/a de target
        await supabase.from('members')
          .update({ parents: Array.from(new Set([...(sourceMember.parents || []), target.id])) })
          .eq('id', sourceMember.id)
        await supabase.from('relationships').insert({
          tree_id: treeId,
          member1_id: target.id,
          member2_id: sourceMember.id,
          relationship: 'parent',
        })
      } else if (connType === 'sibling') {
        await supabase.from('relationships').insert({
          tree_id: treeId,
          member1_id: sourceMember.id,
          member2_id: target.id,
          relationship: 'sibling',
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la conexión.')
      setBusy(false)
    }
  }

  const overlay = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(10, 20, 15, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', zIndex: 9998,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(460px, 100%)', maxHeight: '90vh',
          backgroundColor: '#1E2A22',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.35)',
          padding: '24px 22px',
          color: '#F5E6C8',
          overflow: 'auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              backgroundColor: '#D4AF37', color: '#1E2A22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Link2 size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#D4AF37' }}>
                Conectar familiar
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', opacity: 0.7 }}>
                {sourceMember.firstName} {sourceMember.lastName || ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        {/* Tipo de relación */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Tipo de relación</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            {(['spouse', 'parent-of', 'child-of', 'sibling'] as ConnType[]).map(t => {
              const Icon = CONN_ICON[t]
              const active = connType === t
              return (
                <button
                  key={t}
                  onClick={() => setConnType(t)}
                  style={{
                    padding: '10px 12px', borderRadius: '10px',
                    border: active ? '1.5px solid #D4AF37' : '1px solid rgba(212,175,55,0.25)',
                    background: active ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                    color: '#F5E6C8', fontSize: '12.5px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={14} />
                  <span style={{ textAlign: 'left', lineHeight: 1.2 }}>{CONN_LABEL[t]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Buscador de miembro */}
        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Elige a la otra persona</label>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre…"
            style={{
              width: '100%', marginTop: '8px', boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(212,175,55,0.35)',
              color: '#F5E6C8', fontSize: '14px', outline: 'none',
            }}
          />
        </div>

        {/* Lista */}
        <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '14px', borderRadius: '10px', border: '1px solid rgba(212,175,55,0.15)' }}>
          {candidates.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
              No hay coincidencias.
            </div>
          ) : candidates.map(m => {
            const active = targetId === m.id
            return (
              <button
                key={m.id}
                onClick={() => setTargetId(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '9px 12px',
                  background: active ? 'rgba(212,175,55,0.18)' : 'transparent',
                  border: 'none', borderBottom: '1px solid rgba(212,175,55,0.08)',
                  color: '#F5E6C8', textAlign: 'left', cursor: 'pointer',
                }}
              >
                <img
                  src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.firstName)}`}
                  alt={m.firstName}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid #D4AF37', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600 }}>
                    {m.firstName} {m.lastName || ''}
                  </div>
                  {m.dateOfBirth && (
                    <div style={{ fontSize: '10.5px', opacity: 0.6 }}>
                      {new Date(m.dateOfBirth).getFullYear()}
                      {m.dateOfDeath ? ` – ${new Date(m.dateOfDeath).getFullYear()}` : ''}
                    </div>
                  )}
                </div>
                {active && <span style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 700 }}>✓</span>}
              </button>
            )
          })}
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: '10px',
            backgroundColor: 'rgba(178, 34, 34, 0.15)',
            color: '#FFB4A2', fontSize: '13px',
            border: '1px solid rgba(178, 34, 34, 0.4)',
            marginBottom: '10px',
          }}>
            {error}
          </div>
        )}

        {/* Vista previa de la conexión */}
        {target && (
          <div style={{
            padding: '10px 12px', borderRadius: '10px',
            backgroundColor: 'rgba(212,175,55,0.08)',
            fontSize: '13px', lineHeight: 1.4,
            marginBottom: '12px',
          }}>
            <strong>{sourceMember.firstName}</strong> quedará conectado como{' '}
            <strong style={{ color: '#D4AF37' }}>{CONN_LABEL[connType]}</strong>{' '}
            de <strong>{target.firstName} {target.lastName || ''}</strong>.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={busy || !target}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: '999px',
            backgroundColor: '#D4AF37', color: '#1E2A22',
            border: 'none', fontWeight: 700, fontSize: '14px',
            cursor: busy || !target ? 'not-allowed' : 'pointer',
            opacity: busy || !target ? 0.5 : 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 6px 18px rgba(212,175,55,0.35)',
          }}
        >
          {busy ? 'Conectando…' : (<>Guardar conexión <Link2 size={15} /></>)}
        </button>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(overlay, document.body)
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.08em',
  textTransform: 'uppercase', fontWeight: 700, color: '#D4AF37',
}

const closeBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,175,55,0.3)',
  borderRadius: '50%', width: '30px', height: '30px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#D4AF37',
}
