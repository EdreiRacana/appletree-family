'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronDown, Check, Plus, Pencil, Send, Clock, X, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

// Lista desplegable "Familia Elías ▾": las familias (árboles) a las que
// perteneces y, debajo, las otras ramas de tu familia (el apellido de tu
// papá / mamá o el tuyo). Si esa familia ya la creó un familiar, puedes pedir
// unirte; si no existe, puedes fundarla y empieza con tu papá o mamá y sus
// hijos copiados del árbol actual.

export interface FamilyTree {
  tree_id: string
  tree_name: string
  surname: string | null
  role: 'owner' | 'admin' | 'member'
  member_count: number
  created_at: string
}

interface FoundTree {
  tree_id: string
  tree_name: string
  surname: string
  owner_name: string
  request_status: 'pending' | 'approved' | 'rejected' | null
}

interface Candidate {
  key: string          // apellido normalizado
  label: string        // como se muestra: "Fuentes"
  seed: Member[]       // personas que se copian al fundarla (sin contarme)
  via: string | null   // "tu mamá Dolores"
}

interface FamilySwitcherProps {
  families: FamilyTree[]
  currentTreeId: string
  members: Member[]          // manzanas del árbol actual
  myUserId: string | null
  onSwitch: (treeId: string) => void
  onFamiliesChanged: () => Promise<void> | void
}

// Igual que public.norm_surname en la base.
export function normSurname(s: string | null | undefined): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

const firstWord = (s: string | null | undefined) => (s || '').trim().split(/\s+/)[0] || ''
const cap = (s: string) => s.charAt(0).toLocaleUpperCase('es-MX') + s.slice(1)

export function familyLabel(f: Pick<FamilyTree, 'tree_name'>): string {
  return f.tree_name?.trim() || 'Mi familia'
}

export default function FamilySwitcher({
  families, currentTreeId, members, myUserId, onSwitch, onFamiliesChanged,
}: FamilySwitcherProps) {
  const [open, setOpen] = useState(false)
  const [found, setFound] = useState<FoundTree[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<Candidate | null>(null)
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const current = families.find(f => f.tree_id === currentTreeId)
  const canRename = current && (current.role === 'owner' || current.role === 'admin')
  const me = useMemo(() => members.find(m => myUserId && m.userId === myUserId) || null, [members, myUserId])

  // Ramas posibles: apellido de cada papá/mamá y cada palabra de mi apellido.
  const candidates = useMemo<Candidate[]>(() => {
    if (!me) return []
    const mine = new Set(families.map(f => normSurname(f.surname)).filter(Boolean))
    const byKey = new Map<string, Candidate>()
    const parents = (me.parents || [])
      .map(id => members.find(m => m.id === id))
      .filter((m): m is Member => !!m)
    for (const p of parents) {
      const word = firstWord(p.lastName)
      const key = normSurname(word)
      if (!key || mine.has(key) || byKey.has(key)) continue
      const kids = members.filter(m => m.id !== me.id && (m.parents || []).includes(p.id))
      const rel = p.gender === 'female' ? 'tu mamá' : p.gender === 'male' ? 'tu papá' : 'tu papá/mamá'
      byKey.set(key, { key, label: cap(word), seed: [p, ...kids], via: `${rel} ${p.firstName}` })
    }
    for (const word of (me.lastName || '').trim().split(/\s+/)) {
      const key = normSurname(word)
      if (!key || key.length < 2 || mine.has(key) || byKey.has(key)) continue
      byKey.set(key, { key, label: cap(word), seed: [], via: null })
    }
    return [...byKey.values()].slice(0, 4)
  }, [me, members, families])

  // ¿Alguna de esas familias ya la fundó un familiar?
  const candidateKeys = candidates.map(c => c.key).join('|')
  useEffect(() => {
    if (!open || !candidateKeys) return
    let alive = true
    supabase.rpc('find_family_trees', { p_surnames: candidateKeys.split('|') })
      .then(({ data }) => { if (alive) setFound((data as FoundTree[]) || []) })
    return () => { alive = false }
  }, [open, candidateKeys])

  // Cerrar al tocar fuera
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [open])

  const close = () => { setOpen(false); setConfirm(null); setShowCustom(false); setRenaming(false); setError('') }

  const create = async (c: Candidate) => {
    setBusy(c.key); setError('')
    const { data, error: err } = await supabase.rpc('create_family_tree', {
      p_surname: c.label,
      p_source_tree: me ? currentTreeId : null,
      p_seed: c.seed.map(m => m.id),
    })
    setBusy(null)
    if (err || !data) { setError(err?.message || 'No se pudo crear la familia.'); return }
    await onFamiliesChanged()
    close()
    onSwitch(data as string)
  }

  const requestJoin = async (t: FoundTree) => {
    setBusy(t.tree_id); setError('')
    const { error: err } = await supabase.rpc('request_join_tree', { p_tree: t.tree_id })
    setBusy(null)
    if (err) { setError(err.message); return }
    setFound(prev => prev.map(x => x.tree_id === t.tree_id ? { ...x, request_status: 'pending' } : x))
  }

  const rename = async () => {
    if (!current) return
    setBusy('rename'); setError('')
    const { error: err } = await supabase.rpc('rename_family_tree', { p_tree: current.tree_id, p_name: newName })
    setBusy(null)
    if (err) { setError(err.message); return }
    setRenaming(false)
    await onFamiliesChanged()
  }

  const foundByKey = new Map(found.map(f => [normSurname(f.surname), f]))

  return (
    <div ref={boxRef} className="family-switcher" style={{ position: 'relative' }}>
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        className="family-switcher-btn"
        style={triggerBtn}
      >
        <Users size={15} style={{ flexShrink: 0, opacity: 0.85 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? familyLabel(current) : 'Mi familia'}
        </span>
        <ChevronDown size={15} style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div role="menu" className="family-switcher-panel" style={panel}>
          <div style={sectionTitle}>Mis familias</div>
          {families.map(f => {
            const active = f.tree_id === currentTreeId
            return (
              <button key={f.tree_id} role="menuitemradio" aria-checked={active}
                onClick={() => { close(); if (!active) onSwitch(f.tree_id) }}
                style={{ ...row, background: active ? 'rgba(212,175,55,0.16)' : 'transparent' }}>
                <span style={{ width: 18, display: 'inline-flex' }}>{active && <Check size={16} color="#D4AF37" />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={rowTitle}>{familyLabel(f)}</span>
                  <span style={rowSub}>
                    {f.member_count} {Number(f.member_count) === 1 ? 'persona' : 'personas'}
                    {f.role === 'owner' ? ' · Fundador' : f.role === 'admin' ? ' · Administrador' : ''}
                  </span>
                </span>
              </button>
            )
          })}

          {canRename && !renaming && (
            <button onClick={() => { setRenaming(true); setNewName(current ? familyLabel(current) : '') }} style={{ ...linkBtn, marginLeft: 30 }}>
              <Pencil size={13} /> Cambiar nombre de esta familia
            </button>
          )}
          {renaming && (
            <div style={{ display: 'flex', gap: 6, padding: '4px 4px 8px 30px' }}>
              <input autoFocus value={newName} maxLength={60} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void rename() }}
                aria-label="Nuevo nombre de la familia" style={input} />
              <button disabled={busy === 'rename' || newName.trim().length < 2} onClick={() => void rename()} style={smallBtn}>Guardar</button>
              <button onClick={() => setRenaming(false)} aria-label="Cancelar" style={{ ...smallBtn, background: 'transparent', color: '#E8DAB2' }}><X size={14} /></button>
            </div>
          )}

          {(candidates.length > 0 || me) && <div style={{ ...sectionTitle, marginTop: 10 }}>Otras ramas de tu familia</div>}

          {candidates.map(c => {
            const f = foundByKey.get(c.key)
            if (f) {
              return (
                <div key={c.key} style={{ ...row, cursor: 'default' }}>
                  <span style={{ width: 18 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={rowTitle}>{f.tree_name}</span>
                    <span style={rowSub}>La fundó {f.owner_name}</span>
                  </span>
                  {f.request_status === 'pending' ? (
                    <span style={{ ...pill, opacity: 0.8 }}><Clock size={12} /> Solicitud enviada</span>
                  ) : (
                    <button disabled={busy === f.tree_id} onClick={() => void requestJoin(f)} style={pillBtn}>
                      <Send size={12} /> Pedir unirme
                    </button>
                  )}
                </div>
              )
            }
            return (
              <div key={c.key} style={{ ...row, cursor: 'default' }}>
                <span style={{ width: 18 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={rowTitle}>Familia {c.label}</span>
                  <span style={rowSub}>{c.via ? `La de ${c.via}. Aún no existe.` : 'Aún no existe.'}</span>
                </span>
                <button onClick={() => setConfirm(c)} style={pillBtn}><Plus size={12} /> Crear</button>
              </div>
            )
          })}

          {confirm && (
            <div style={confirmBox}>
              <p style={{ margin: '0 0 6px', fontWeight: 700 }}>¿Crear la Familia {confirm.label}?</p>
              <p style={{ margin: '0 0 8px', fontSize: 12, lineHeight: 1.45, opacity: 0.85 }}>
                Tú serás el fundador. Empezará con:{' '}
                <strong>{['tú', ...confirm.seed.map(m => m.firstName)].join(', ')}</strong>.
                Después podrás invitar a cada uno y agregar al resto de la familia.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={busy === confirm.key} onClick={() => void create(confirm)} style={smallBtn}>
                  {busy === confirm.key ? 'Creando…' : 'Sí, crear'}
                </button>
                <button onClick={() => setConfirm(null)} style={{ ...smallBtn, background: 'transparent', color: '#E8DAB2', border: '1px solid rgba(232,218,178,0.35)' }}>Cancelar</button>
              </div>
            </div>
          )}

          {!showCustom ? (
            <button onClick={() => { setShowCustom(true); setConfirm(null) }} style={{ ...linkBtn, marginTop: 4 }}>
              <Plus size={13} /> Crear otra familia con otro apellido
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, padding: '6px 4px' }}>
              <input autoFocus value={custom} maxLength={40} placeholder="Apellido, p. ej. García"
                onChange={e => setCustom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && custom.trim().length >= 2) setConfirm({ key: normSurname(custom), label: cap(custom.trim()), seed: [], via: null }) }}
                aria-label="Apellido de la nueva familia" style={input} />
              <button disabled={custom.trim().length < 2}
                onClick={() => setConfirm({ key: normSurname(custom), label: cap(custom.trim()), seed: [], via: null })}
                style={smallBtn}>Seguir</button>
            </div>
          )}

          {error && <p role="alert" style={{ margin: '8px 4px 0', color: '#FFB4A2', fontSize: 12, fontWeight: 600 }}>{error}</p>}
        </div>
      )}
    </div>
  )
}

const triggerBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, maxWidth: 260, height: 38, padding: '0 14px',
  borderRadius: 12, border: '1px solid rgba(212,175,55,0.35)', background: 'rgba(232,218,183,0.1)',
  color: '#E8DAB2', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.01em',
}
const panel: CSSProperties = {
  position: 'absolute', top: 46, left: 0, width: 360, maxHeight: '70vh', overflowY: 'auto',
  padding: 10, borderRadius: 16, background: 'rgba(22,32,24,0.97)', color: '#E8DAB2',
  border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 18px 48px rgba(0,0,0,0.5)', zIndex: 2600,
  backdropFilter: 'blur(18px)',
}
const sectionTitle: CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, padding: '6px 8px 4px',
}
const row: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 8px', borderRadius: 10,
  border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', background: 'transparent',
}
const rowTitle: CSSProperties = { display: 'block', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const rowSub: CSSProperties = { display: 'block', fontSize: 11.5, opacity: 0.65, marginTop: 1 }
const pill: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 20,
  fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid rgba(232,218,178,0.3)',
}
const pillBtn: CSSProperties = { ...pill, background: '#D4AF37', color: '#16201A', border: 'none', cursor: 'pointer' }
const linkBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px', border: 'none', background: 'none',
  color: '#D4AF37', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
}
const input: CSSProperties = {
  flex: 1, minWidth: 0, height: 34, padding: '0 10px', borderRadius: 9, border: '1px solid rgba(212,175,55,0.4)',
  background: 'rgba(255,255,255,0.06)', color: '#F5E6C8', fontSize: 14, outline: 'none',
}
const smallBtn: CSSProperties = {
  height: 34, padding: '0 12px', borderRadius: 9, border: 'none', background: '#D4AF37', color: '#16201A',
  fontSize: 12.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
}
const confirmBox: CSSProperties = {
  margin: '6px 4px', padding: 12, borderRadius: 12, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.35)', fontSize: 13,
}
