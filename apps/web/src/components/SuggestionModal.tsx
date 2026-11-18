'use client'

import { useState, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

// Formulario para que un familiar sugiera un cambio al administrador:
// corregir datos de una manzana o agregar a alguien que falta (padres,
// hermanos…). Lo revisa el fundador o un administrador en su bandeja.
interface SuggestionModalProps {
  member: Member
  treeId: string
  authorName: string
  onClose: () => void
}

const KINDS = [
  { id: 'edit', label: 'Corregir un dato' },
  { id: 'new_relative', label: 'Falta un familiar' },
  { id: 'other', label: 'Otra cosa' },
] as const

export default function SuggestionModal({ member, treeId, authorName, onClose }: SuggestionModalProps) {
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('edit')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setError('')
    if (message.trim().length < 3) { setError('Escribe qué cambio sugieres.'); return }
    setSending(true)
    const { error: err } = await supabase.from('member_suggestions').insert({
      tree_id: treeId,
      member_id: member.id,
      kind,
      message: message.trim(),
      author_name: authorName,
    })
    setSending(false)
    if (err) { setError('No se pudo enviar. Intenta de nuevo.'); return }
    setSent(true)
  }

  const placeholder = kind === 'new_relative'
    ? `Ej.: Falta la mamá de ${member.firstName}: Rosa Pérez, nació en 1950.`
    : kind === 'edit'
      ? `Ej.: ${member.firstName} nació el 3 de mayo de 1972, no en 1971.`
      : 'Cuéntale al administrador qué necesitas.'

  return (
    <div
      role="dialog" aria-modal="true" aria-label={`Sugerir un cambio sobre ${member.firstName}`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 420, borderRadius: 20, padding: '22px 20px 20px',
        background: '#FFF8E7', color: '#2C1810', boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 20 }}>
            {sent ? '¡Sugerencia enviada!' : 'Sugerir un cambio'}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6558' }}>
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: '#5A4636' }}>
              El administrador del árbol la va a revisar. Te avisaremos cuando la resuelva.
            </p>
            <button onClick={onClose} style={primaryBtn}>Listo</button>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#7A6558' }}>
              Sobre <strong>{member.firstName} {member.lastName}</strong>. El administrador del árbol revisará tu sugerencia.
            </p>
            <div role="radiogroup" aria-label="Tipo de sugerencia" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {KINDS.map(k => (
                <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}
                  style={{
                    padding: '7px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${kind === k.id ? '#B8860B' : 'rgba(44,24,16,0.18)'}`,
                    background: kind === k.id ? '#F3DFA2' : 'transparent', color: '#2C1810',
                  }}>
                  {k.label}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={placeholder}
              maxLength={2000}
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, resize: 'vertical',
                border: '1px solid rgba(44,24,16,0.2)', fontSize: 14, fontFamily: 'inherit', background: '#FFFDF6',
              }}
            />
            <p role="alert" style={{ minHeight: 18, margin: '6px 0', color: '#C0392B', fontSize: 12, fontWeight: 600 }}>{error}</p>
            <button onClick={send} disabled={sending} style={{ ...primaryBtn, opacity: sending ? 0.65 : 1 }}>
              {sending ? 'Enviando…' : 'Enviar sugerencia'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const primaryBtn: CSSProperties = {
  width: '100%', padding: 13, border: 'none', borderRadius: 12, cursor: 'pointer',
  background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)', color: '#1B1208', fontWeight: 700, fontSize: 14,
}
