'use client'

// Vista tipo "esfera de reloj inteligente" para celular.
// - Panal hexagonal de burbujas (foto de cada familiar).
// - El usuario queda al centro; los parientes más cercanos (pareja, padres,
//   hijos, hermanos…) en los anillos de alrededor, los lejanos afuera.
// - Efecto lupa: las burbujas cerca del centro se ven grandes y con nombre;
//   hacia la orilla se encogen y se "curvan" hacia adentro.
// - Arrastrar con el dedo para moverse (con inercia). Tocar una burbuja la
//   centra; tocar la burbuja ya centrada abre su perfil.
//
// Rendimiento: el movimiento NO re-renderiza React. Cada cuadro se escribe
// directo al style.transform de cada burbuja vía refs.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Member, Relationship } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface WatchTreeViewProps {
  members: Member[]
  relationships: Relationship[]
  onMemberTap: (member: Member) => void
}

const SPACING = 98          // distancia entre centros de manzanas (px)
const BUBBLE = 80           // tamaño base de la manzana (px)
const MEDALLION = 38        // diámetro de la foto dentro de la manzana (px)
const TAP_SLOP = 8          // px que puede moverse el dedo y seguir siendo "toque"
const FRICTION = 0.93       // inercia por cuadro
const CENTER_EPS = 14       // px para considerar que una burbuja ya está centrada

// Coordenadas de un panal en espiral: anillo 0 (centro), anillo 1 (6), anillo 2 (12)…
function hexSpiral(count: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }]
  // direcciones axiales (q, r)
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  let ring = 1
  while (out.length < count) {
    let q = -ring, r = ring   // empezar en la esquina inferior izquierda del anillo
    for (let side = 0; side < 6 && out.length < count; side++) {
      for (let step = 0; step < ring && out.length < count; step++) {
        out.push({
          x: SPACING * (q + r / 2),
          y: SPACING * (Math.sqrt(3) / 2) * r,
        })
        q += dirs[side][0]
        r += dirs[side][1]
      }
    }
    ring++
  }
  return out
}

function initials(m: Member) {
  return `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase()
}

export default function WatchTreeView({ members, relationships, onMemberTap }: WatchTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [size, setSize] = useState({ w: 360, h: 640 })
  const [centeredId, setCenteredId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null)).catch(() => {})
  }, [])

  // ── Orden por cercanía familiar (BFS desde "yo") ─────────────────
  const meId = useMemo(() => {
    const mine = myUserId ? members.find(m => m.userId === myUserId) : undefined
    if (mine) return mine.id
    return (members.find(m => (m.generation ?? 0) === 0) ?? members[0])?.id ?? null
  }, [members, myUserId])

  const layout = useMemo(() => {
    const byId = new Map(members.map(m => [m.id, m]))
    const adj = new Map<string, Set<string>>()
    const link = (a: string, b: string) => {
      if (!byId.has(a) || !byId.has(b) || a === b) return
      if (!adj.has(a)) adj.set(a, new Set())
      if (!adj.has(b)) adj.set(b, new Set())
      adj.get(a)!.add(b); adj.get(b)!.add(a)
    }
    for (const m of members) {
      for (const p of m.parents ?? []) link(m.id, p)
      for (const s of m.spouses ?? []) link(m.id, s)
    }
    for (const r of relationships) {
      if (r.isActive !== false) link(r.member1Id, r.member2Id)
    }
    // Orden: BFS desde "yo"; dentro del mismo nivel, pareja primero y luego por edad.
    const order: string[] = []
    const seen = new Set<string>()
    const bfs = (start: string) => {
      const queue = [start]; seen.add(start)
      while (queue.length) {
        const id = queue.shift()!
        order.push(id)
        const me = byId.get(id)!
        const next = Array.from(adj.get(id) ?? []).filter(n => !seen.has(n))
        next.sort((a, b) => {
          const A = byId.get(a)!, B = byId.get(b)!
          const aSp = (me.spouses ?? []).includes(a) ? 0 : 1
          const bSp = (me.spouses ?? []).includes(b) ? 0 : 1
          if (aSp !== bSp) return aSp - bSp
          return (A.dateOfBirth ?? '9999').localeCompare(B.dateOfBirth ?? '9999')
        })
        for (const n of next) { seen.add(n); queue.push(n) }
      }
    }
    if (meId && byId.has(meId)) bfs(meId)
    // Los que no estén conectados, al final (por generación).
    const rest = members.filter(m => !seen.has(m.id))
      .sort((a, b) => (a.generation ?? 0) - (b.generation ?? 0))
    for (const m of rest) { if (!seen.has(m.id)) bfs(m.id) }

    const pos = hexSpiral(order.length)
    const map = new Map<string, { x: number; y: number }>()
    order.forEach((id, i) => map.set(id, pos[i]))
    let maxR = 0
    for (const p of pos) maxR = Math.max(maxR, Math.hypot(p.x, p.y))
    return { order: order.map(id => byId.get(id)!), pos: map, maxR }
  }, [members, relationships, meId])

  // ── Estado de movimiento (fuera de React) ───────────────────────
  const pan = useRef({ x: 0, y: 0 })      // desplazamiento del mundo
  const vel = useRef({ x: 0, y: 0 })
  const target = useRef<{ x: number; y: number } | null>(null)
  const drag = useRef<{ id: number; sx: number; sy: number; lx: number; ly: number; lt: number; moved: boolean } | null>(null)
  const raf = useRef<number | null>(null)
  const lastDragEnd = useRef(0)           // cuándo terminó el último arrastre

  const clampPan = useCallback((p: { x: number; y: number }) => {
    const lim = Math.max(SPACING, layout.maxR * 0.8)
    const r = Math.hypot(p.x, p.y)
    if (r <= lim) return p
    return { x: (p.x / r) * lim, y: (p.y / r) * lim }
  }, [layout.maxR])

  // Escribe la posición/escala de cada burbuja con el efecto lupa.
  const paint = useCallback(() => {
    const { w, h } = size
    const cx = w / 2, cy = h / 2
    // La "esfera" es una elipse que llena la pantalla (los celulares son
    // altos); se deja espacio arriba para el selector y abajo para el pie.
    const ex = w / 2 - 6
    const ey = Math.max(ex, h / 2 - 70)
    const FLAT = 0.5                          // zona central sin deformar (0..1)
    let closest: { id: string; d: number } | null = null
    for (const m of layout.order) {
      const el = bubbleRefs.current.get(m.id)
      const p = layout.pos.get(m.id)
      if (!el || !p) continue
      let x = p.x - pan.current.x
      let y = p.y - pan.current.y
      const r = Math.hypot(x, y)
      const u = Math.hypot(x / ex, y / ey)    // distancia normalizada a la orilla
      let s = 1
      if (u > FLAT) {
        // Comprime la distancia (las orillas se curvan hacia adentro)…
        const over = u - FLAT
        const k = (FLAT + over * 0.7) / u
        x *= k
        y *= k
        // …y encoge la burbuja suavemente hacia la orilla.
        const t = Math.min(1, over / 0.75)
        s = 1 - t * t * (3 - 2 * t) * 0.8     // smoothstep → hasta 0.2
      }
      if (r < SPACING * 0.5) s *= 1.12        // la del centro un poco más grande
      const visible = s > 0.24
      el.style.transform = `translate3d(${cx + x - BUBBLE / 2}px, ${cy + y - BUBBLE / 2}px, 0) scale(${s.toFixed(3)})`
      el.style.opacity = visible ? String(Math.min(1, s * 1.4)) : '0'
      el.style.zIndex = String(Math.round(s * 100))
      const label = el.lastElementChild as HTMLElement | null
      if (label) label.style.opacity = s > 0.9 ? '1' : '0'
      if (!closest || r < closest.d) closest = { id: m.id, d: r }
    }
    return closest
  }, [layout, size])

  const loopRef = useRef<() => void>(() => {})
  const loop = useCallback(() => {
    raf.current = null
    let moving = false
    if (!drag.current) {
      if (target.current) {
        const dx = target.current.x - pan.current.x
        const dy = target.current.y - pan.current.y
        pan.current = { x: pan.current.x + dx * 0.18, y: pan.current.y + dy * 0.18 }
        if (Math.hypot(dx, dy) > 0.5) moving = true
        else { pan.current = target.current; target.current = null }
      } else if (Math.hypot(vel.current.x, vel.current.y) > 0.2) {
        pan.current = clampPan({ x: pan.current.x + vel.current.x, y: pan.current.y + vel.current.y })
        vel.current = { x: vel.current.x * FRICTION, y: vel.current.y * FRICTION }
        moving = true
      }
    }
    const closest = paint()
    if (moving) raf.current = requestAnimationFrame(() => loopRef.current())
    else if (closest) setCenteredId(closest.d < CENTER_EPS ? closest.id : null)
  }, [paint, clampPan])
  useEffect(() => { loopRef.current = loop }, [loop])

  const kick = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(() => loopRef.current())
  }, [])

  const centerOn = useCallback((id: string | null) => {
    if (!id) return
    const p = layout.pos.get(id)
    if (!p) return
    vel.current = { x: 0, y: 0 }
    target.current = { x: p.x, y: p.y }
    kick()
  }, [layout, kick])

  // Tamaño del contenedor
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Al cargar o cambiar de familia: centrar en "yo" sin animación.
  useEffect(() => {
    const p = meId ? layout.pos.get(meId) : undefined
    pan.current = p ? { x: p.x, y: p.y } : { x: 0, y: 0 }
    vel.current = { x: 0, y: 0 }
    target.current = null
    kick()
  }, [meId, layout, kick])

  useEffect(() => { kick() }, [size, kick])
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current) }, [])

  // ── Gestos ─────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (drag.current) return
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: false }
    vel.current = { x: 0, y: 0 }
    target.current = null
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > TAP_SLOP) {
      d.moved = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (!d.moved) return
    const dx = e.clientX - d.lx, dy = e.clientY - d.ly
    const now = performance.now()
    const dt = Math.max(1, now - d.lt)
    pan.current = clampPan({ x: pan.current.x - dx, y: pan.current.y - dy })
    vel.current = { x: (-dx / dt) * 16, y: (-dy / dt) * 16 }
    d.lx = e.clientX; d.ly = e.clientY; d.lt = now
    paint()
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    // Un toque sin arrastre se resuelve en onClick (ver abajo).
    if (!d.moved) return
    lastDragEnd.current = performance.now()
    if (performance.now() - d.lt > 80) vel.current = { x: 0, y: 0 }
    kick()
  }
  // El toque se maneja en 'click' y no en 'pointerup': en celulares, después
  // de levantar el dedo el navegador manda un "click" al elemento que quede
  // debajo. Si abríamos el panel en pointerup, ese click caía sobre el fondo
  // del panel recién abierto y lo cerraba al instante.
  const onClick = (e: React.MouseEvent) => {
    if (performance.now() - lastDragEnd.current < 350) return  // fue un arrastre
    const hit = (e.target as HTMLElement).closest('[data-mid]') as HTMLElement | null
    const id = hit?.dataset.mid
    if (!id) return
    const member = layout.order.find(m => m.id === id)
    if (!member) return
    // Un solo toque: centra la burbuja y abre sus opciones (chat, perfil…).
    centerOn(id)
    onMemberTap(member)
  }

  if (members.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(245,240,224,0.7)', fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          Todavía no hay familiares en este árbol.<br />
          Si esperabas ver a tu familia, revisa que entraste con el correo de tu invitación.
        </p>
      </div>
    )
  }

  const centered = centeredId ? layout.order.find(m => m.id === centeredId) : undefined

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        background: 'radial-gradient(circle at 50% 45%, #2C3B22 0%, #18200F 55%, #0E120A 100%)',
      }}
    >
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'url("/assets/arbol-base.png")', backgroundSize: 'cover',
        backgroundPosition: 'center bottom', opacity: 0.08,
      }} />

      {layout.order.map(m => {
        const isMe = m.id === meId
        const isBaby = !!m.isBaby
        return (
          <div
            key={m.id}
            data-mid={m.id}
            ref={el => { if (el) bubbleRefs.current.set(m.id, el); else bubbleRefs.current.delete(m.id) }}
            role="button"
            aria-label={`${m.firstName} ${m.lastName}`}
            style={{
              position: 'absolute', left: 0, top: 0, width: BUBBLE, height: BUBBLE,
              willChange: 'transform, opacity', cursor: 'pointer', opacity: 0,
            }}
          >
            {/* Manzana (misma imagen que el árbol de escritorio) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.appleType === 'green' ? '/assets/Manzana_verde.png' : '/assets/Manzana_roja.png'}
              alt="" draggable={false}
              style={{
                position: 'absolute', inset: 0, width: BUBBLE, height: BUBBLE, objectFit: 'contain',
                pointerEvents: 'none',
                opacity: m.dateOfDeath ? 0.5 : 1,
                filter: m.dateOfDeath
                  ? 'drop-shadow(0 0 8px rgba(212,175,55,0.7)) drop-shadow(0 4px 8px rgba(0,0,0,0.45))'
                  : isMe
                    ? 'drop-shadow(0 0 10px rgba(212,175,55,0.85)) drop-shadow(0 6px 10px rgba(0,0,0,0.5))'
                    : 'drop-shadow(0 6px 10px rgba(0,0,0,0.5))',
              }}
            />
            {/* Medallón con la foto, en el cuerpo de la manzana */}
            <div style={{
              position: 'absolute', left: '50%', top: '57%', transform: 'translate(-50%, -50%)',
              width: MEDALLION, height: MEDALLION, borderRadius: '50%', overflow: 'hidden',
              border: `2px solid ${isMe ? '#D4AF37' : 'rgba(255,255,255,0.92)'}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
              background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              {m.avatarUrl && !isBaby ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : isBaby ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.gender === 'female' ? '/assets/baby-girl.png' : '/assets/baby-boy.png'} alt="" draggable={false}
                  style={{ width: '72%', height: '72%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: '#5A3A22' }}>
                  {initials(m)}
                </span>
              )}
            </div>
            {m.dateOfDeath && (
              <span aria-hidden style={{
                position: 'absolute', top: '24%', left: '50%', transform: 'translateX(-50%)',
                color: '#D4AF37', fontSize: 12, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                pointerEvents: 'none',
              }}>✝</span>
            )}            <div style={{
              position: 'absolute', top: BUBBLE - 2, left: '50%', transform: 'translateX(-50%)',
              whiteSpace: 'nowrap', fontSize: 11, fontWeight: 600, color: '#F5E6C8',
              textShadow: '0 1px 3px rgba(0,0,0,0.95)', pointerEvents: 'none',
              transition: 'opacity 0.2s ease-out', opacity: 0,
            }}>
              {isMe ? 'Tú' : m.firstName}
            </div>
          </div>
        )
      })}

      {/* Pie: quién está al centro + ayuda */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: 16, color: '#F5E6C8',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)', minHeight: 20,
        }}>
          {centered ? `${centered.firstName} ${centered.lastName}` : ''}
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(245,230,200,0.6)', letterSpacing: '0.04em' }}>
          Desliza para explorar · toca una manzana
        </div>
      </div>

      {/* Volver a mí */}
      {meId && (
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => e.stopPropagation()}
          onClick={() => centerOn(meId)}
          aria-label="Volver a mi manzana"
          style={{
            position: 'absolute', right: 14, bottom: 14, height: 36, padding: '0 14px',
            borderRadius: 18, border: '1px solid rgba(212,175,55,0.55)',
            background: 'rgba(20,26,14,0.75)', color: '#D4AF37', fontSize: 12, fontWeight: 700,
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', cursor: 'pointer',
          }}
        >
          Yo
        </button>
      )}
    </div>
  )
}
