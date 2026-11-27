'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { X, GitMerge, ArrowLeft, AlertTriangle, Link2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'
import type { FamilyTree } from '@/components/FamilySwitcher'

// "Unir familias": junta otra familia que administras con la actual.
//  1) Elegir la otra familia.
//  2) Confirmar quiénes son la misma persona en las dos (se sugiere solo).
//  3) Confirmar y unir. La familia elegida para conservar se queda con todo.

interface Row {
  id: string
  first_name: string
  last_name: string | null
  date_of_birth: string | null
  date_of_death: string | null
  avatar_url: string | null
  user_id: string | null
  generation: number | null
}

const norm = (s: string | null | undefined) =>
  (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
const first = (s: string | null | undefined) => norm(s).split(' ')[0] || ''
const year = (d: string | null | undefined) => (d || '').slice(0, 4)
const fullName = (m: { first_name: string, last_name: string | null }) => `${m.first_name} ${m.last_name ?? ''}`.trim()

function toRow(m: Member): Row {
  return {
    id: m.id, first_name: m.firstName, last_name: m.lastName ?? null, date_of_birth: m.dateOfBirth ?? null,
    date_of_death: m.dateOfDeath ?? null, avatar_url: m.avatarUrl ?? null, user_id: m.userId ?? null, generation: m.generation ?? null,
  }
}

// Sugerencia: misma cuenta → seguro; mismo nombre y apellido (y año si ambos
// lo tienen) → probable. Cada persona de la que queda se usa una sola vez.
function suggestPairs(absorb: Row[], keep: Row[]): Map<string, string> {
  const out = new Map<string, string>()
  const used = new Set<string>()
  for (const a of absorb) {
    if (!a.user_id) continue
    const k = keep.find(x => x.user_id === a.user_id)
    if (k) { out.set(a.id, k.id); used.add(k.id) }
  }
  const score = (a: Row, k: Row) => {
    if (first(a.first_name) !== first(k.first_name)) return 0
    if (first(a.last_name) !== first(k.last_name)) return 0
    const ya = year(a.date_of_birth), yk = year(k.date_of_birth)
    if (ya && yk && ya !== yk) return 0
    let s = 1
    if (norm(a.first_name) === norm(k.first_name)) s += 1
    if (norm(a.last_name) === norm(k.last_name)) s += 1
    if (ya && yk) s += 3
    return s
  }
  const cands: Array<{ a: string, k: string, s: number }> = []
  for (const a of absorb) {
    if (out.has(a.id)) continue
    for (const k of keep) {
      if (used.has(k.id) || (a.user_id && k.user_id)) continue
      const s = score(a, k)
      if (s > 0) cands.push({ a: a.id, k: k.id, s })
    }
  }
  cands.sort((x, y) => y.s - x.s)
  for (const c of cands) {
    if (out.has(c.a) || used.has(c.k)) continue
    out.set(c.a, c.k); used.add(c.k)
  }
  return out
}

export default function MergeFamiliesModal({ families, current, currentMembers, onClose, onMerged }: {
  families: FamilyTree[]
  current: FamilyTree
  currentMembers: Member[]
  onClose: () => void
  onMerged: (keepTreeId: string) => void
}) {
  const options = families.filter(f => f.tree_id !== current.tree_id && (f.role === 'owner' || f.role === 'admin'))
  const [other, setOther] = useState<FamilyTree | null>(options.length === 1 ? options[0] : null)
  const [otherRows, setOtherRows] = useState<Row[] | null>(null)
  const [keepCurrent, setKeepCurrent] = useState(true)
  // Parejas siempre como: persona de la OTRA familia → persona de la actual.
  const [pairs, setPairs] = useState<Map<string, string>>(new Map())
  const [step, setStep] = useState<'pick' | 'match' | 'confirm'>(options.length === 1 ? 'match' : 'pick')
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)

  const currentRows = useMemo(() => currentMembers.map(toRow), [currentMembers])

  useEffect(() => {
    if (!other) return
    let alive = true
    setOtherRows(null); setError('')
    supabase.from('members')
      .select('id, first_name, last_name, date_of_birth, date_of_death, avatar_url, user_id, generation')
      .eq('tree_id', other.tree_id)
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) { setError('No se pudo leer la otra familia.'); return }
        const rows = (data ?? []) as Row[]
        setOtherRows(rows)
        setPairs(suggestPairs(rows, currentRows))
      })
    return () => { alive = false }
  }, [other, currentRows])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const locked = useMemo(() => {
    const s = new Set<string>()
    otherRows?.forEach(a => { if (a.user_id && currentRows.some(k => k.user_id === a.user_id)) s.add(a.id) })
    return s
  }, [otherRows, currentRows])

  const usedKeep = new Set(pairs.values())
  const sorted = useMemo(() => {
    if (!otherRows) return []
    return [...otherRows].sort((a, b) =>
      Number(pairs.has(b.id)) - Number(pairs.has(a.id)) || (a.generation ?? 0) - (b.generation ?? 0) || a.first_name.localeCompare(b.first_name, 'es'))
  }, [otherRows, pairs])
  const visible = showAll ? sorted : sorted.filter(r => pairs.has(r.id))
  const newCount = (otherRows?.length ?? 0) - pairs.size

  const keepTree = keepCurrent ? current : other!
  const goneTree = keepCurrent ? other! : current
  const keepName = (f: FamilyTree) => f.tree_name?.trim() || 'Mi familia'

  const setPair = (aId: string, kId: string) => {
    setPairs(prev => {
      const n = new Map(prev)
      if (!kId) n.delete(aId)
      else {
        for (const [a, k] of n) if (k === kId && a !== aId) n.delete(a)
        n.set(aId, kId)
      }
      return n
    })
  }

  const merge = async () => {
    if (!other) return
    setBusy(true); setError('')
    const list = [...pairs.entries()].map(([a, k]) => keepCurrent ? { absorb: a, keep: k } : { absorb: k, keep: a })
    const { data, error: err } = await supabase.rpc('merge_family_trees', {
      p_keep: keepTree.tree_id, p_absorb: goneTree.tree_id, p_pairs: list,
    })
    setBusy(false)
    if (err) { setError(err.message || 'No se pudo unir. No se cambió nada.'); return }
    onMerged((data as { tree_id?: string } | null)?.tree_id || keepTree.tree_id)
  }

  const card: React.CSSProperties = {
    width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', borderRadius: 22,
    background: 'var(--glass-card-bg, rgba(22,30,22,0.94))', color: 'var(--menu-fg)',
    border: '1px solid var(--menu-border)', boxShadow: 'var(--panel-shadow)', padding: '22px 22px 20px',
    animation: 'afModalIn 0.35s cubic-bezier(0.16,1,0.3,1)',
  }
  const gold: React.CSSProperties = {
    width: '100%', padding: '13px 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)', color: '#16201A', fontWeight: 800, fontSize: 14.5,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  }
  const ghost: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 12, border: '1px solid var(--menu-border)', background: 'transparent',
    color: 'var(--menu-fg)', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6,
  }
  const avatar = (r: Row) => r.avatar_url
    ? <img src={r.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--accent-gold)', flexShrink: 0 }} />
    : <span style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--accent-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--accent-gold)', flexShrink: 0 }}>
        {(r.first_name[0] || '') + (r.last_name?.[0] || '')}
      </span>

  return (
    <div role="dialog" aria-modal="true" aria-label="Unir familias"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000, background: 'var(--glass-overlay, rgba(8,12,8,0.6))',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <GitMerge size={22} /> Unir familias
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.75 }}>
              Junta dos árboles que comparten personas (por ejemplo, la familia de tu mamá) en uno solo.
            </p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Cerrar" style={{
            width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--menu-border)', cursor: 'pointer',
            background: 'transparent', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={16} /></button>
        </div>

        {/* ── 1. Elegir familia ── */}
        {step === 'pick' && (
          options.length === 0 ? (
            <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--menu-border)', fontSize: 13.5, lineHeight: 1.55 }}>
              Para unir dos familias necesitas <strong>administrar las dos</strong>. Si la otra familia la administra
              alguien más, pídele que te nombre administrador (Configuración → Administradores) y vuelve aquí.
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 13.5 }}>¿Con qué familia quieres unir <strong>{keepName(current)}</strong>?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {options.map(f => (
                  <button key={f.tree_id} onClick={() => { setOther(f); setStep('match') }} style={{
                    ...ghost, justifyContent: 'space-between', padding: '12px 14px', fontSize: 14,
                    background: other?.tree_id === f.tree_id ? 'var(--menu-active)' : 'transparent',
                  }}>
                    <span>{keepName(f)}</span>
                    <span style={{ fontWeight: 500, opacity: 0.65, fontSize: 12 }}>{f.member_count} personas</span>
                  </button>
                ))}
              </div>
            </>
          )
        )}

        {/* ── 2. Emparejar personas ── */}
        {step === 'match' && other && (
          <>
            {!otherRows ? (
              <p style={{ fontSize: 13, opacity: 0.8 }}>Buscando a las personas que están en las dos familias…</p>
            ) : (
              <>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--menu-active)', fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
                  <strong>{pairs.size}</strong> {pairs.size === 1 ? 'persona está' : 'personas están'} en las dos familias
                  {pairs.size > 0 ? ' y se volverán una sola manzana' : ''}. <strong>{newCount}</strong> {newCount === 1 ? 'persona nueva se agregará' : 'personas nuevas se agregarán'}.
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Revisa que las parejas sean correctas. Puedes corregirlas abajo.</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visible.map(r => {
                    const k = pairs.get(r.id) ?? ''
                    const isLocked = locked.has(r.id)
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, border: '1px solid var(--menu-border)' }}>
                        {avatar(r)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(r)}</div>
                          <div style={{ fontSize: 11.5, opacity: 0.6 }}>{year(r.date_of_birth) || 'Sin fecha'} · en {keepName(other)}</div>
                        </div>
                        <Link2 size={14} style={{ opacity: k ? 0.9 : 0.25, color: 'var(--accent-gold)', flexShrink: 0 }} />
                        {isLocked ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-gold)', maxWidth: 190 }}>
                            Es la misma cuenta: {currentRows.find(x => x.id === k)?.first_name}
                          </span>
                        ) : (
                          <select value={k} onChange={e => setPair(r.id, e.target.value)} aria-label={`¿Quién es ${r.first_name} en ${keepName(current)}?`}
                            style={{
                              maxWidth: 200, padding: '7px 8px', borderRadius: 10, border: '1px solid var(--menu-border)',
                              background: 'var(--menu-input-bg, transparent)', color: 'var(--menu-fg)', fontSize: 12.5,
                            }}>
                            <option value="">Persona nueva</option>
                            {currentRows
                              .filter(x => x.id === k || !usedKeep.has(x.id))
                              .sort((x, y) => x.first_name.localeCompare(y.first_name, 'es'))
                              .map(x => <option key={x.id} value={x.id}>Es {fullName(x)}{year(x.date_of_birth) ? ` (${year(x.date_of_birth)})` : ''}</option>)}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!showAll && newCount > 0 && (
                  <button onClick={() => setShowAll(true)} style={{ ...ghost, marginTop: 10, border: 'none', padding: '6px 2px', color: 'var(--accent-gold)' }}>
                    ¿Falta alguien? Ver a las {newCount} personas nuevas y emparejar a mano
                  </button>
                )}

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: 8 }}>¿Qué nombre se queda?</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[true, false].map(v => (
                      <button key={String(v)} onClick={() => setKeepCurrent(v)} aria-pressed={keepCurrent === v} style={{
                        ...ghost, flex: 1, justifyContent: 'center',
                        border: keepCurrent === v ? '1.5px solid var(--accent-gold)' : '1px solid var(--menu-border)',
                        background: keepCurrent === v ? 'var(--menu-active)' : 'transparent',
                      }}>{keepName(v ? current : other)}</button>
                    ))}
                  </div>
                </div>

                {error && <div style={{ marginTop: 12, fontSize: 13, color: '#E57373' }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  {options.length > 1 && <button onClick={() => setStep('pick')} style={ghost}><ArrowLeft size={14} /> Atrás</button>}
                  <button disabled={pairs.size === 0} onClick={() => { setUnderstood(false); setStep('confirm') }}
                    style={{ ...gold, opacity: pairs.size === 0 ? 0.5 : 1, cursor: pairs.size === 0 ? 'not-allowed' : 'pointer' }}>
                    Continuar
                  </button>
                </div>
                {pairs.size === 0 && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.7, textAlign: 'center' }}>
                    Elige al menos una persona que esté en las dos familias, para saber dónde se unen las ramas.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* ── 3. Confirmar ── */}
        {step === 'confirm' && other && (
          <>
            <div style={{ padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(229,115,115,0.45)', background: 'rgba(229,115,115,0.08)', fontSize: 13.5, lineHeight: 1.6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800, marginBottom: 6, color: '#E57373' }}>
                <AlertTriangle size={16} /> Esto no se puede deshacer
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Todo queda en <strong>{keepName(keepTree)}</strong>.</li>
                <li><strong>{keepName(goneTree)}</strong> deja de existir por separado: sus personas, historias, fotos y álbumes pasan a {keepName(keepTree)}.</li>
                <li>{pairs.size} {pairs.size === 1 ? 'persona repetida se junta' : 'personas repetidas se juntan'} en una sola manzana (se completan los datos que falten).</li>
                <li>Quien estaba en cualquiera de las dos familias seguirá viendo el árbol, y los administradores lo siguen siendo.</li>
              </ul>
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, fontSize: 13.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} style={{ marginTop: 3, accentColor: '#D4AF37' }} />
              Entiendo, quiero unir las dos familias.
            </label>
            {error && <div style={{ marginTop: 12, fontSize: 13, color: '#E57373' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setStep('match')} disabled={busy} style={ghost}><ArrowLeft size={14} /> Atrás</button>
              <button disabled={!understood || busy} onClick={() => void merge()}
                style={{ ...gold, opacity: !understood || busy ? 0.55 : 1, cursor: !understood ? 'not-allowed' : busy ? 'wait' : 'pointer' }}>
                <GitMerge size={16} /> {busy ? 'Uniendo familias…' : 'Unir familias'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
