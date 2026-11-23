'use client'

import React, { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { X, Flame, ArrowLeft, Feather } from 'lucide-react'
import type { Member } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { ageOn, yearsLabel, parseYMD } from '@/lib/familyDates'
import { MemberAvatar } from './HomeDashboard'

// EN MEMORIA: un lugar para quienes ya partieron. Cada persona tiene su
// tarjeta (foto, años, edad) y, al abrirla, su historia y los recuerdos que
// la familia comparte. "Compartir un recuerdo" publica una historia ligada a
// esa persona (actor_member_id).

interface Memory {
  id: string
  title: string
  description: string | null
  image_url: string | null
  created_at: string
  actor_member_id: string | null
}

interface InMemoriamPanelProps {
  treeId: string
  members: Member[]
  onClose: () => void
  onShareMemory: (m: Member) => void
  refreshKey?: number
}

const cleanTitle = (t: string) => t.replace(/\s*\(\d{4}\)\s*$/, '')

export default function InMemoriamPanel({ treeId, members, onClose, onShareMemory, refreshKey = 0 }: InMemoriamPanelProps) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [openId, setOpenId] = useState<string | null>(null)

  const departed = useMemo(() => members
    .filter(m => !!m.dateOfDeath)
    .sort((a, b) => (parseYMD(a.dateOfBirth)?.y ?? 9999) - (parseYMD(b.dateOfBirth)?.y ?? 9999)), [members])

  useEffect(() => {
    const ids = departed.map(m => m.id)
    if (ids.length === 0) return
    let alive = true
    supabase.from('activities')
      .select('id, title, description, image_url, created_at, actor_member_id')
      .eq('tree_id', treeId)
      .in('actor_member_id', ids)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (alive) setMemories((data as Memory[]) || []) })
    return () => { alive = false }
  }, [treeId, departed, refreshKey])

  const countBy = useMemo(() => {
    const c = new Map<string, number>()
    memories.forEach(m => { if (m.actor_member_id) c.set(m.actor_member_id, (c.get(m.actor_member_id) || 0) + 1) })
    return c
  }, [memories])

  const open = openId ? departed.find(m => m.id === openId) : undefined
  const openMemories = open ? memories.filter(x => x.actor_member_id === open.id) : []

  return (
    <div role="dialog" aria-modal="true" aria-label="En memoria" style={overlay} onClick={onClose} className="memoriam-overlay">
      <div style={panel} onClick={e => e.stopPropagation()} className="memoriam-panel">
        <div aria-hidden style={glow} />

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          {open ? (
            <button onClick={() => setOpenId(null)} aria-label="Volver" style={iconBtn}><ArrowLeft size={18} /></button>
          ) : (
            <span style={candle}><Flame size={20} /></span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={title}>{open ? `${open.firstName} ${open.lastName}` : 'En memoria'}</h2>
            <p style={subtitle}>
              {open ? yearsLabel(open) : 'Quienes nos dieron raíces. Aquí guardamos sus historias.'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={iconBtn}><X size={18} /></button>
        </div>

        {/* Lista */}
        {!open && (
          departed.length === 0 ? (
            <div style={emptyBox}>
              <Flame size={28} color="var(--accent-gold)" />
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                Cuando un familiar tenga fecha de fallecimiento en su perfil, aparecerá aquí para que la familia comparta sus recuerdos.
              </p>
            </div>
          ) : (
            <div style={grid} className="memoriam-grid">
              {departed.map(m => {
                const age = ageOn(m)
                const n = countBy.get(m.id) || 0
                return (
                  <button key={m.id} onClick={() => setOpenId(m.id)} style={tile}>
                    <div style={photoFrame}>
                      {m.avatarUrl
                        ? <img src={m.avatarUrl} alt="" style={photo} />
                        : <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, color: 'var(--accent-gold)' }}>{m.firstName[0]}{m.lastName?.[0] ?? ''}</span>}
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, marginTop: 10 }}>{m.firstName} {m.lastName}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{yearsLabel(m)}{age !== null ? ` · ${age} años` : ''}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--accent-gold)', marginTop: 6, fontWeight: 700 }}>
                      {n === 0 ? 'Sé el primero en recordarle' : `${n} ${n === 1 ? 'recuerdo' : 'recuerdos'}`}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        )}

        {/* Detalle de una persona */}
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }} className="memoriam-hero">
              <MemberAvatar m={open} size={96} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {ageOn(open) !== null && <div style={{ fontSize: 13, opacity: 0.75 }}>Vivió {ageOn(open)} años</div>}
                {open.birthPlace && <div style={{ fontSize: 13, opacity: 0.75 }}>Nació en {open.birthPlace}</div>}
                <button onClick={() => onShareMemory(open)} style={{ ...primaryBtn, marginTop: 10 }}>
                  <Feather size={16} /> Compartir un recuerdo
                </button>
              </div>
            </div>
            {open.biography && (
              <blockquote style={quote}>{open.biography}</blockquote>
            )}
            <h3 style={sectionTitle}>Recuerdos de la familia</h3>
            {openMemories.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, opacity: 0.75, lineHeight: 1.5 }}>
                Aún no hay recuerdos. Una foto, una anécdota o una receta suya: todo ayuda a que las nuevas generaciones le conozcan.
              </p>
            ) : openMemories.map(mem => (
              <article key={mem.id} style={memoryCard}>
                {mem.image_url && !mem.image_url.includes('unsplash.com') && (
                  <img src={mem.image_url} alt="" style={{ width: '100%', maxHeight: 340, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
                )}
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{cleanTitle(mem.title)}</div>
                {mem.description && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', opacity: 0.9 }}>{mem.description}</p>}
                <div style={{ fontSize: 11.5, opacity: 0.6 }}>{new Date(mem.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 4000, padding: '92px 16px 24px 130px',
  background: 'var(--glass-overlay)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
}
const panel: CSSProperties = {
  position: 'relative', width: '100%', maxWidth: 920, maxHeight: '100%', overflowY: 'auto',
  display: 'flex', flexDirection: 'column', gap: 18, padding: 22, borderRadius: 24,
  background: 'var(--glass-card-bg)', color: 'var(--menu-fg)', border: '1px solid var(--menu-border)',
  backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
  animation: 'afModalIn 0.3s ease-out', scrollbarWidth: 'none',
}
const glow: CSSProperties = {
  position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 520, height: 220, pointerEvents: 'none',
  background: 'radial-gradient(ellipse at center, rgba(255,190,90,0.18), transparent 70%)',
}
const candle: CSSProperties = {
  width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  color: '#F2C14E', background: 'radial-gradient(circle, rgba(242,193,78,0.35), rgba(242,193,78,0.06))',
  boxShadow: '0 0 24px rgba(242,193,78,0.35)',
}
const title: CSSProperties = { margin: 0, fontFamily: "'Playfair Display', 'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--accent-gold)' }
const subtitle: CSSProperties = { margin: '3px 0 0', fontSize: 13, opacity: 0.75 }
const iconBtn: CSSProperties = {
  width: 38, height: 38, borderRadius: 11, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--menu-fg)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, position: 'relative' }
const tile: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '18px 12px 14px', borderRadius: 18,
  background: 'var(--menu-input-bg)', border: '1px solid var(--menu-border)', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit',
  transition: 'transform 0.2s ease, border-color 0.2s ease',
}
const photoFrame: CSSProperties = {
  width: 104, height: 104, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '2px solid var(--accent-gold)', background: 'var(--accent-gold-soft)',
  boxShadow: '0 0 0 5px var(--accent-gold-soft), 0 10px 24px rgba(0,0,0,0.25)',
}
const photo: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(0.25) saturate(0.85)' }
const emptyBox: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '30px 20px', borderRadius: 18,
  background: 'var(--menu-input-bg)', border: '1px dashed var(--menu-border)',
}
const sectionTitle: CSSProperties = { margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-gold)' }
const quote: CSSProperties = {
  margin: 0, padding: '12px 16px', borderLeft: '3px solid var(--accent-gold)', borderRadius: 8,
  background: 'var(--accent-gold-soft)', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 15, lineHeight: 1.55,
}
const memoryCard: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 16,
  background: 'var(--menu-input-bg)', border: '1px solid var(--menu-border)',
}
const primaryBtn: CSSProperties = {
  height: 42, padding: '0 16px', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
  background: 'linear-gradient(180deg, #E2C15A 0%, #C9A23A 55%, #B08A2A 100%)', color: '#1A1408', fontSize: 14, fontWeight: 800,
  boxShadow: '0 8px 20px rgba(184,134,11,0.28)',
}
