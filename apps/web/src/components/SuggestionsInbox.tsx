'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { X, Check, XCircle, Pencil, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

// Bandeja del fundador / administradores: sugerencias de los familiares.
// "Editar manzana" abre el formulario de esa manzana; luego se marca como
// hecha o se rechaza (con nota opcional). El autor recibe una notificación.
interface Suggestion {
  id: string
  member_id: string | null
  kind: 'edit' | 'new_relative' | 'other'
  message: string
  author_name: string | null
  created_at: string
  status: 'pending' | 'done' | 'rejected'
  review_note: string | null
}

interface SuggestionsInboxProps {
  treeId: string
  members: Member[]
  onClose: () => void
  onEditMember: (m: Member) => void
  canReview: boolean          // admin: puede resolver; familiar: solo ve las suyas
  onMembersChanged?: () => void  // tras aprobar a alguien, recargar el árbol
}

interface JoinRequest {
  id: string
  requester_name: string | null
  created_at: string
}

const KIND_LABEL: Record<Suggestion['kind'], string> = {
  edit: 'Corregir un dato',
  new_relative: 'Falta un familiar',
  other: 'Otra cosa',
}

export default function SuggestionsInbox({ treeId, members, onClose, onEditMember, canReview, onMembersChanged }: SuggestionsInboxProps) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'closed'>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [joins, setJoins] = useState<JoinRequest[]>([])
  const [joinPick, setJoinPick] = useState<Record<string, string>>({})

  // Solicitudes para unirse a esta familia (solo admins las ven).
  const fetchJoins = useCallback(() => supabase
    .from('tree_join_requests')
    .select('id, requester_name, created_at')
    .eq('tree_id', treeId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true }), [treeId])

  const loadJoins = useCallback(() => fetchJoins().then(({ data }) => setJoins((data as JoinRequest[]) ?? [])), [fetchJoins])

  useEffect(() => {
    if (!canReview) return
    let alive = true
    fetchJoins().then(({ data }) => { if (alive) setJoins((data as JoinRequest[]) ?? []) })
    return () => { alive = false }
  }, [fetchJoins, canReview])

  // Manzanas que pueden ser esa persona: sin cuenta y vivas.
  const unclaimed = members
    .filter(m => !m.userId && !m.dateOfDeath)
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'es'))

  const guessMember = (name: string | null) => {
    const first = (name || '').trim().split(/\s+/)[0]?.toLowerCase()
    if (!first) return ''
    return unclaimed.find(m => m.firstName.trim().toLowerCase() === first)?.id ?? ''
  }

  const answerJoin = async (j: JoinRequest, approve: boolean) => {
    const pick = joinPick[j.id] ?? guessMember(j.requester_name)
    setBusyId(j.id)
    const { error: err } = await supabase.rpc('answer_join_request', {
      p_request: j.id,
      p_approve: approve,
      p_member_id: approve && pick && pick !== 'new' ? pick : null,
    })
    setBusyId(null)
    if (err) { setError(err.message || 'No se pudo responder la solicitud.'); return }
    void loadJoins()
    if (approve) onMembersChanged?.()
  }

  const fetchRows = useCallback(() => supabase
    .from('member_suggestions')
    .select('id, member_id, kind, message, author_name, created_at, status, review_note')
    .eq('tree_id', treeId)
    .order('created_at', { ascending: false })
    .limit(200), [treeId])

  const apply = useCallback(({ data, error: err }: { data: unknown; error: unknown }) => {
    if (err) setError('No se pudieron cargar las sugerencias.')
    setItems((data as Suggestion[]) ?? [])
    setLoading(false)
  }, [])

  const load = useCallback(() => fetchRows().then(apply), [fetchRows, apply])

  useEffect(() => {
    let alive = true
    fetchRows().then(r => { if (alive) apply(r) })
    return () => { alive = false }
  }, [fetchRows, apply])

  const resolve = async (s: Suggestion, status: 'done' | 'rejected') => {
    let note: string | null = null
    if (status === 'rejected') {
      note = window.prompt('¿Quieres explicarle por qué? (opcional)') ?? null
    }
    setBusyId(s.id)
    const { error: err } = await supabase
      .from('member_suggestions')
      .update({ status, review_note: note || null })
      .eq('id', s.id)
    setBusyId(null)
    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); return }
    void load()
  }

  const memberById = new Map(members.map(m => [m.id, m]))
  const shown = items.filter(s => (tab === 'pending' ? s.status === 'pending' : s.status !== 'pending'))
  const pendingCount = items.filter(s => s.status === 'pending').length + joins.length

  return (
    <div role="dialog" aria-modal="true" aria-label="Sugerencias de la familia" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 11500, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, maxHeight: '86dvh', display: 'flex', flexDirection: 'column',
        borderRadius: 20, background: '#FFF8E7', color: '#2C1810', boxShadow: '0 24px 60px rgba(0,0,0,0.45)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 21 }}>{canReview ? 'Sugerencias de la familia' : 'Mis sugerencias'}</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A6558' }}>
            <X size={20} />
          </button>
        </div>
        <div role="tablist" style={{ display: 'flex', gap: 6, padding: '0 20px 12px' }}>
          {(['pending', 'closed'] as const).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{
              padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: '1.5px solid ' + (tab === t ? '#B8860B' : 'rgba(44,24,16,0.18)'),
              background: tab === t ? '#F3DFA2' : 'transparent', color: '#2C1810',
            }}>
              {t === 'pending' ? `Pendientes (${pendingCount})` : 'Resueltas'}
            </button>
          ))}
        </div>
        {error && <p role="alert" style={{ margin: '0 20px 8px', color: '#C0392B', fontSize: 12, fontWeight: 600 }}>{error}</p>}

        <div style={{ overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {canReview && joins.map(j => {
            const pick = joinPick[j.id] ?? guessMember(j.requester_name)
            return (
              <div key={j.id} style={{ borderRadius: 14, padding: 14, background: '#FFF3D0', border: '1.5px solid #D4AF37' }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserPlus size={16} /> {j.requester_name || 'Un familiar'} quiere unirse a esta familia
                </p>
                <label style={{ display: 'block', fontSize: 12, color: '#5A4A3F', margin: '8px 0 4px', fontWeight: 600 }}>
                  ¿Quién es en el árbol?
                </label>
                <select value={pick || 'new'} onChange={e => setJoinPick(prev => ({ ...prev, [j.id]: e.target.value }))}
                  style={{ width: '100%', height: 36, borderRadius: 9, border: '1px solid rgba(44,24,16,0.25)', background: '#FFFDF6', color: '#2C1810', fontSize: 13, padding: '0 8px' }}>
                  <option value="new">No está todavía — agregarlo como manzana nueva</option>
                  {unclaimed.map(m => (
                    <option key={m.id} value={m.id}>Es {m.firstName} {m.lastName}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button disabled={busyId === j.id} onClick={() => answerJoin(j, true)} style={{ ...secondaryBtn, borderColor: '#2E7D32', color: '#2E7D32' }}>
                    <Check size={14} /> Aceptar
                  </button>
                  <button disabled={busyId === j.id} onClick={() => answerJoin(j, false)} style={{ ...secondaryBtn, borderColor: '#A04030', color: '#A04030' }}>
                    <XCircle size={14} /> No aceptar
                  </button>
                </div>
              </div>
            )
          })}
          {loading ? (
            <p style={{ color: '#7A6558', fontSize: 13 }}>Cargando…</p>
          ) : shown.length === 0 && !(tab === 'pending' && joins.length > 0) ? (
            <p style={{ color: '#7A6558', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              {tab === 'pending' ? 'No hay sugerencias pendientes.' : 'Todavía no hay sugerencias resueltas.'}
            </p>
          ) : shown.map(s => {
            const m = s.member_id ? memberById.get(s.member_id) : undefined
            return (
              <div key={s.id} style={{ borderRadius: 14, padding: 14, background: '#FFFDF6', border: '1px solid rgba(44,24,16,0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: '#7A6558', marginBottom: 6 }}>
                  <span><strong style={{ color: '#2C1810' }}>{s.author_name || 'Un familiar'}</strong> · {KIND_LABEL[s.kind]}{m ? ` · sobre ${m.firstName} ${m.lastName}` : ''}</span>
                  <span>{new Date(s.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.message}</p>
                {s.status !== 'pending' && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: s.status === 'done' ? '#2E7D32' : '#A04030', fontWeight: 600 }}>
                    {s.status === 'done' ? 'Hecha' : 'Rechazada'}{s.review_note ? ` — ${s.review_note}` : ''}
                  </p>
                )}
                {s.status === 'pending' && canReview && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {m && (
                      <button onClick={() => onEditMember(m)} style={secondaryBtn}>
                        <Pencil size={14} /> Editar manzana
                      </button>
                    )}
                    <button disabled={busyId === s.id} onClick={() => resolve(s, 'done')} style={{ ...secondaryBtn, borderColor: '#2E7D32', color: '#2E7D32' }}>
                      <Check size={14} /> Marcar como hecha
                    </button>
                    <button disabled={busyId === s.id} onClick={() => resolve(s, 'rejected')} style={{ ...secondaryBtn, borderColor: '#A04030', color: '#A04030' }}>
                      <XCircle size={14} /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const secondaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10,
  border: '1.5px solid rgba(44,24,16,0.25)', background: 'transparent', color: '#2C1810',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
}
