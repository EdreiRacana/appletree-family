'use client'

import React, { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Cake, Flame, Sparkles, TreePine, MessageCircle, Users, Layers } from 'lucide-react'
import type { Member } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { nextAnniversary, isDeceased, shortDate } from '@/lib/familyDates'

// INICIO: lo que hace que la familia regrese cada día.
//  - Hoy: cumpleaños, quien "habría cumplido" y aniversarios de quienes partieron.
//  - Próximos cumpleaños (30 días) con botón para felicitar.
//  - Un día como hoy: historias publicadas este mismo día en años anteriores
//    (o un recuerdo distinto cada día mientras la familia junta años de historias).

interface Story {
  id: string
  title: string
  description: string | null
  image_url: string | null
  created_at: string
  actor_member_id?: string | null
}

interface HomeDashboardProps {
  members: Member[]
  treeId: string
  meId?: string | null
  onViewTree: () => void
  onOpenChat?: (m: Member) => void
  canContact?: (m: Member) => boolean
  onOpenMemorial?: () => void
}

const cleanTitle = (t: string) => t.replace(/\s*\(\d{4}\)\s*$/, '')

export default function HomeDashboard({ members, treeId, meId, onViewTree, onOpenChat, canContact, onOpenMemorial }: HomeDashboardProps) {
  const [stories, setStories] = useState<Story[]>([])

  useEffect(() => {
    let alive = true
    supabase.from('activities')
      .select('id, title, description, image_url, created_at, actor_member_id')
      .eq('tree_id', treeId)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        if (!alive) return
        setStories(((data as Story[]) || []).filter(s => !(s.description || '').includes('[EVDATE:')))
      })
    return () => { alive = false }
  }, [treeId])

  const [today] = useState(() => new Date())
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  // Cumpleaños (vivos) y aniversarios de quienes ya partieron
  const { todayItems, upcoming } = useMemo(() => {
    const todayItems: Array<{ m: Member, kind: 'birthday' | 'would' | 'passing', years: number }> = []
    const upcoming: Array<{ m: Member, daysLeft: number, years: number, date: Date }> = []
    members.forEach(m => {
      const b = nextAnniversary(m.dateOfBirth, today)
      if (isDeceased(m)) {
        if (b && b.daysLeft === 0) todayItems.push({ m, kind: 'would', years: b.years })
        const d = nextAnniversary(m.dateOfDeath, today)
        if (d && d.daysLeft === 0 && d.years > 0) todayItems.push({ m, kind: 'passing', years: d.years })
        return
      }
      if (!b) return
      if (b.daysLeft === 0) todayItems.push({ m, kind: 'birthday', years: b.years })
      else if (b.daysLeft <= 30) upcoming.push({ m, daysLeft: b.daysLeft, years: b.years, date: b.date })
    })
    upcoming.sort((a, b) => a.daysLeft - b.daysLeft)
    return { todayItems, upcoming: upcoming.slice(0, 8) }
  }, [members, today])

  // Un día como hoy: misma fecha (mes/día) en años anteriores
  const onThisDay = useMemo(() => {
    const md = (s: string) => { const d = new Date(s); return `${d.getMonth()}-${d.getDate()}` }
    const key = `${today.getMonth()}-${today.getDate()}`
    const same = stories.filter(s => md(s.created_at) === key && new Date(s.created_at).getFullYear() < today.getFullYear())
    if (same.length) return { onThisDay: true, items: same.slice(0, 3) }
    // Mientras no haya años de historia: un recuerdo con foto, distinto cada día
    const withPhoto = stories.filter(s => s.image_url && !s.image_url.includes('unsplash.com'))
    const pool = withPhoto.length ? withPhoto : stories
    if (!pool.length) return null
    const dayNum = Math.floor(today.getTime() / 86_400_000)
    return { onThisDay: false, items: [pool[dayNum % pool.length]] }
  }, [stories, today])

  const deceasedCount = members.filter(isDeceased).length
  const gens = new Set(members.map(m => m.generation ?? 0)).size
  const me = meId ? byId.get(meId) : undefined

  return (
    <div className="home-dash-wrap" style={wrap}>
      <div style={panel} className="home-dash-panel">
        <div aria-hidden style={glow} />
        <div style={{ position: 'relative' }}>
          <p style={eyebrow}>{today.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2 style={title}>{me ? `Hola, ${me.firstName}` : 'Tu familia hoy'}</h2>
        </div>

        {/* HOY */}
        {todayItems.length > 0 && (
          <section style={{ ...card, borderColor: 'rgba(212,175,55,0.55)', background: 'linear-gradient(160deg, rgba(212,175,55,0.18), rgba(212,175,55,0.04))' }}>
            <h3 style={sectionTitle}><Sparkles size={15} /> Hoy</h3>
            {todayItems.map(({ m, kind, years }) => (
              <div key={`${kind}-${m.id}`} style={row}>
                <Avatar m={m} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...rowTitle, whiteSpace: 'normal', lineHeight: 1.3 }}>
                    {kind === 'birthday' && <>¡Hoy cumple <strong>{m.firstName}</strong>! 🎂</>}
                    {kind === 'would' && <>Hoy {m.firstName} habría cumplido {years}</>}
                    {kind === 'passing' && <>Hoy recordamos a {m.firstName}</>}
                  </div>
                  <div style={rowSub}>
                    {kind === 'birthday' && `${years} años`}
                    {kind === 'would' && 'Comparte un recuerdo en su memoria'}
                    {kind === 'passing' && `Hace ${years} ${years === 1 ? 'año' : 'años'} que partió`}
                  </div>
                </div>
                {kind === 'birthday' && onOpenChat && (!canContact || canContact(m)) && m.id !== meId && (
                  <button onClick={() => onOpenChat(m)} style={pillBtn}><MessageCircle size={13} /> Felicitar</button>
                )}
                {kind !== 'birthday' && onOpenMemorial && (
                  <button onClick={onOpenMemorial} style={ghostPill}><Flame size={13} /> Recordar</button>
                )}
              </div>
            ))}
          </section>
        )}

        {/* PRÓXIMOS CUMPLEAÑOS */}
        <section style={card}>
          <h3 style={sectionTitle}><Cake size={15} /> Próximos cumpleaños</h3>
          {upcoming.length === 0 ? (
            <p style={empty}>No hay cumpleaños en los próximos 30 días{members.some(m => !m.dateOfBirth && !m.dateOfDeath) ? '. Agrega fechas de nacimiento para verlos aquí.' : '.'}</p>
          ) : upcoming.map(({ m, daysLeft, years, date }) => (
            <div key={m.id} style={row}>
              <Avatar m={m} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowTitle}>{m.firstName} {m.lastName}</div>
                <div style={rowSub}>{shortDate(date)} · cumple {years}</div>
              </div>
              <span style={daysBadge(daysLeft)}>{daysLeft === 1 ? 'Mañana' : `${daysLeft} días`}</span>
            </div>
          ))}
        </section>

        {/* UN DÍA COMO HOY */}
        {onThisDay && (
          <section style={card}>
            <h3 style={sectionTitle}><Sparkles size={15} /> {onThisDay.onThisDay ? 'Un día como hoy' : 'Un recuerdo de la familia'}</h3>
            {onThisDay.items.map(s => {
              const who = s.actor_member_id ? byId.get(s.actor_member_id) : undefined
              const yearsAgo = today.getFullYear() - new Date(s.created_at).getFullYear()
              return (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {s.image_url && (
                    <div style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '4 / 3', background: 'rgba(0,0,0,0.2)' }}>
                      <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div>
                    <div style={{ ...rowTitle, fontSize: 15, whiteSpace: 'normal' }}>{cleanTitle(s.title)}</div>
                    <div style={rowSub}>
                      {onThisDay.onThisDay
                        ? `Hace ${yearsAgo} ${yearsAgo === 1 ? 'año' : 'años'}`
                        : new Date(s.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {who ? ` · ${who.firstName}` : ''}
                    </div>
                    {s.description && (
                      <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, opacity: 0.85, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {s.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* RESUMEN */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <Stat icon={<Users size={15} />} value={members.length} label="Familiares" />
          <Stat icon={<Layers size={15} />} value={gens} label="Generaciones" />
          <button onClick={onOpenMemorial} disabled={!onOpenMemorial} style={{ ...statBox, cursor: onOpenMemorial ? 'pointer' : 'default' }}>
            <span style={statIcon}><Flame size={15} /></span>
            <span style={statValue}>{deceasedCount}</span>
            <span style={statLabel}>En memoria</span>
          </button>
        </div>

        <button onClick={onViewTree} style={primaryBtn}><TreePine size={18} /> Ver el árbol</button>
      </div>
    </div>
  )
}

export function MemberAvatar({ m, size = 40 }: { m: Member, size?: number }) {
  const initials = `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      border: '1.5px solid var(--accent-gold)', background: 'var(--accent-gold-soft)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      filter: m.dateOfDeath ? 'grayscale(0.55)' : 'none',
    }}>
      {m.avatarUrl
        ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: Math.round(size * 0.33), fontWeight: 700, color: 'var(--accent-gold)' }}>{initials}</span>}
    </div>
  )
}
const Avatar = ({ m }: { m: Member }) => <MemberAvatar m={m} />

function Stat({ icon, value, label }: { icon: React.ReactNode, value: number | string, label: string }) {
  return (
    <div style={statBox}>
      <span style={statIcon}>{icon}</span>
      <span style={statValue}>{value}</span>
      <span style={statLabel}>{label}</span>
    </div>
  )
}

const wrap: CSSProperties = {
  width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
  padding: '24px 0 24px 150px', pointerEvents: 'none',
}
const panel: CSSProperties = {
  position: 'relative', width: 420, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', pointerEvents: 'auto',
  display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRadius: 24,
  background: 'var(--glass-card-bg)', color: 'var(--menu-fg)', border: '1px solid var(--menu-border)',
  backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)',
  boxShadow: '0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
  animation: 'afModalIn 0.3s ease-out', scrollbarWidth: 'none',
}
const glow: CSSProperties = {
  position: 'absolute', top: -110, left: -40, width: 360, height: 200, pointerEvents: 'none',
  background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.2), transparent 70%)',
}
const eyebrow: CSSProperties = { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-gold)', opacity: 0.85 }
const title: CSSProperties = { margin: '4px 0 0', fontFamily: "'Playfair Display', 'Cormorant Garamond', serif", fontSize: 26, fontWeight: 600, color: 'var(--accent-gold)' }
const card: CSSProperties = {
  position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 18,
  background: 'var(--menu-input-bg)', border: '1px solid var(--menu-border)',
}
const sectionTitle: CSSProperties = {
  margin: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 800,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-gold)',
}
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 11 }
const rowTitle: CSSProperties = { fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const rowSub: CSSProperties = { fontSize: 12, opacity: 0.65, marginTop: 1 }
const empty: CSSProperties = { margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }
const pillBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(180deg, #E2C15A, #B08A2A)', color: '#1A1408', fontSize: 12, fontWeight: 800, flexShrink: 0,
}
const ghostPill: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
  background: 'transparent', border: '1px solid var(--menu-border)', color: 'var(--accent-gold)', fontSize: 12, fontWeight: 700, flexShrink: 0,
}
const daysBadge = (d: number): CSSProperties => ({
  padding: '4px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, flexShrink: 0,
  background: d <= 7 ? 'var(--accent-gold)' : 'var(--accent-gold-soft)', color: d <= 7 ? '#1A1408' : 'var(--accent-gold)',
})
const statBox: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 6px', borderRadius: 14,
  background: 'var(--menu-input-bg)', border: '1px solid var(--menu-border)', color: 'inherit', fontFamily: 'inherit',
}
const statIcon: CSSProperties = { color: 'var(--accent-gold)', display: 'flex' }
const statValue: CSSProperties = { fontSize: 20, fontWeight: 700, lineHeight: 1.1 }
const statLabel: CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }
const primaryBtn: CSSProperties = {
  height: 48, borderRadius: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  background: 'linear-gradient(180deg, #E2C15A 0%, #C9A23A 55%, #B08A2A 100%)', color: '#1A1408', fontSize: 15, fontWeight: 800,
  boxShadow: '0 10px 24px rgba(184,134,11,0.3), inset 0 1px 0 rgba(255,255,255,0.35)',
}
