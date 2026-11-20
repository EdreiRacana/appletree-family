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

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Member, Relationship } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { computeKinship, kinshipPhrase } from '@/lib/kinship'

interface WatchTreeViewProps {
  members: Member[]
  relationships: Relationship[]
  onMemberTap: (member: Member) => void
}

const BUBBLE = 104          // tamaño base de la manzana (px, a escala 1)
const MEDALLION = 36        // foto ≈ un tercio de la manzana: se ve el cuerpo de la fruta
// Lupa
const SMAX = 1.45           // escala de la manzana del centro (≈150px)
const SMIN = 0.3            // escala mínima (orilla)
const SIGMA = 1.45          // en casillas: qué tan rápido se encogen (1er anillo ≈105px)
const GAP = 0.8             // separación entre manzanas vecinas (1 = se tocan las cajas)
const HALF_SQRT_PI = Math.sqrt(Math.PI) / 2
// Distancia entre casillas del panal "en el centro" (para arrastrar 1:1).
const SPACING = BUBBLE * GAP * SMAX

// Función de error (aprox. Abramowitz–Stegun 7.1.26), para la integral de la lupa.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
  return sign * y
}
const TAP_SLOP = 8          // px que puede moverse el dedo y seguir siendo "toque"
const FRICTION = 0.93       // inercia por cuadro
const CENTER_ZONE = 0.55    // en casillas: la manzana más cercana dentro de esta zona es "la del centro"

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
  const centeredRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null)).catch(() => {})
  }, [])

  // ── Orden por cercanía familiar (BFS desde "yo") ─────────────────
  const meId = useMemo(() => {
    const mine = myUserId ? members.find(m => m.userId === myUserId) : undefined
    if (mine) return mine.id
    return (members.find(m => (m.generation ?? 0) === 0) ?? members[0])?.id ?? null
  }, [members, myUserId])

  // Parentesco de cada familiar visto desde MI manzana ("Tu abuela", "Tu tío"…).
  // Solo si la cuenta tiene manzana enlazada (si no, no hay "yo" desde dónde medir).
  const kinship = useMemo(() => {
    const mine = myUserId ? members.find(m => m.userId === myUserId) : undefined
    return computeKinship(members, relationships, mine?.id ?? null)
  }, [members, relationships, myUserId])

  // La ayuda "Desliza para explorar…" solo las primeras 3 visitas.
  const [showHint] = useState(() => {
    try {
      if (typeof window === 'undefined') return true
      return Number(window.localStorage.getItem('apple_esfera_visits') || '0') < 3
    } catch { return true }
  })
  useEffect(() => {
    try {
      const n = Number(window.localStorage.getItem('apple_esfera_visits') || '0')
      window.localStorage.setItem('apple_esfera_visits', String(n + 1))
    } catch { /* sin almacenamiento */ }
  }, [])

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
    // Se puede llevar al centro CUALQUIER manzana, incluso las de la orilla
    // (antes el límite era 80% del radio y las últimas no se alcanzaban).
    const lim = Math.max(SPACING, layout.maxR + SPACING * 0.25)
    const r = Math.hypot(p.x, p.y)
    if (r <= lim) return p
    return { x: (p.x / r) * lim, y: (p.y / r) * lim }
  }, [layout.maxR])

  // Escribe la posición/escala de cada burbuja con el efecto lupa.
  const paint = useCallback(() => {
    const { w, h } = size
    const cx = w / 2, cy = h / 2 - 28   // un poco arriba: abajo va el nombre
    // Lupa tipo reloj inteligente (igual en todas direcciones):
    //  - la escala depende de la distancia al centro, medida en "casillas"
    //    del panal (rg): centro SMAX, se encoge suave hasta SMIN.
    //  - la posición en pantalla es la suma (integral) de esas escalas, así
    //    cada manzana ocupa justo el espacio de su tamaño: quedan juntas, sin
    //    huecos, y las de la orilla se curvan hacia adentro solas.
    let closest: { id: string; d: number } | null = null
    for (const m of layout.order) {
      const el = bubbleRefs.current.get(m.id)
      const p = layout.pos.get(m.id)
      if (!el || !p) continue
      const dx = p.x - pan.current.x
      const dy = p.y - pan.current.y
      const r = Math.hypot(dx, dy)
      const rg = r / SPACING                              // distancia en casillas
      const g = Math.exp(-((rg / SIGMA) ** 2))
      const s = SMIN + (SMAX - SMIN) * g
      const R = BUBBLE * GAP * (SMIN * rg + (SMAX - SMIN) * SIGMA * HALF_SQRT_PI * erf(rg / SIGMA))
      const x = r > 0 ? (dx / r) * R : 0
      const y = r > 0 ? (dy / r) * R : 0
      const fade = Math.max(0, Math.min(1, (s - SMIN) / 0.16))
      el.style.transform = `translate3d(${cx + x - BUBBLE / 2}px, ${cy + y - BUBBLE / 2}px, 0) scale(${s.toFixed(3)})`
      el.style.opacity = fade.toFixed(2)
      el.style.pointerEvents = fade > 0.15 ? 'auto' : 'none'
      el.style.zIndex = String(Math.round(s * 100))
      if (!closest || r < closest.d) closest = { id: m.id, d: r }
    }
    // "La del centro" = la más cercana si está en la zona central. Se actualiza
    // en cada cuadro (también al deslizar), solo cuando cambia.
    const cid = closest && closest.d < SPACING * CENTER_ZONE ? closest.id : null
    if (cid !== centeredRef.current) { centeredRef.current = cid; setCenteredId(cid) }
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
    paint()
    if (moving) raf.current = requestAnimationFrame(() => loopRef.current())
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

  // Pintar de inmediato (sin esperar al siguiente cuadro) al cambiar tamaño o
  // familia: evita un instante en blanco al abrir la vista.
  useLayoutEffect(() => { paint() }, [paint])
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
            {/* Medallón con la foto, en el cuerpo de la manzana. Fallecidos:
                aro dorado + crucecita discreta en el aro (no junto al tallo). */}
            <div style={{
              position: 'absolute', left: '50%', top: '57%', transform: 'translate(-50%, -50%)',
              width: MEDALLION, height: MEDALLION, pointerEvents: 'none',
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box',
                border: m.dateOfDeath ? '2px solid #D4AF37' : `1.5px solid ${isMe ? '#D4AF37' : 'rgba(255,255,255,0.9)'}`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
                background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: '#5A3A22' }}>
                    {initials(m)}
                  </span>
                )}
              </div>
              {m.dateOfDeath && (
                <span aria-hidden style={{
                  position: 'absolute', right: -3, top: -3, width: 14, height: 14, borderRadius: '50%',
                  background: '#1B2414', border: '1px solid #D4AF37', color: '#D4AF37',
                  fontSize: 8, fontWeight: 700, lineHeight: '12px', textAlign: 'center',
                }}>✝</span>
              )}
            </div>
          </div>
        )
      })}

      {/* Pie: quién está al centro, su parentesco contigo y (las primeras
          veces) la ayuda de uso. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 3, pointerEvents: 'none', padding: '0 70px',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: 17, color: '#F5E6C8', textAlign: 'center',
          textShadow: '0 1px 4px rgba(0,0,0,0.9)', minHeight: 22, lineHeight: 1.25,
        }}>
          {centered ? `${centered.firstName} ${centered.lastName}` : ''}
        </div>
        {centered && kinship.get(centered.id) && (
          <div style={{ fontSize: 12, fontWeight: 700, color: '#D4AF37', letterSpacing: '0.04em' }}>
            {kinshipPhrase(kinship.get(centered.id))}
          </div>
        )}
        {showHint && (
          <div style={{ fontSize: 10.5, color: 'rgba(245,230,200,0.55)', letterSpacing: '0.04em', marginTop: 2 }}>
            Desliza para explorar · toca una manzana
          </div>
        )}
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
