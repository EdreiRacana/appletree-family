'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import AppleNode from './AppleNode'
import type { Member, Relationship } from '@/lib/types'
import { computeTreeLayout, NODE_SIZE, SPOUSE_SPACING } from '@/lib/treeLayout'
import { kinshipPhrase } from '@/lib/kinship'
import { filterTreeView, AUTO_HIDE_FROM, type GenMode } from '@/lib/treeView'
import { supabase } from '@/lib/supabase'
import HoverMenu from './HoverMenu'
import HoverPeek from './HoverPeek'
import EditMemberModal from './EditMemberModal'
import AddMemberModal from './AddMemberModal'
import MobileTreeView from './MobileTreeView'
import WatchTreeView from './WatchTreeView'

// ── Mobile detection hook ────────────────────────────────────────
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

interface TreeCanvasProps {
  members: Member[]
  relationships: Relationship[]
  onRefresh: () => void
  onViewProfile: (member: Member) => void
  onEditMember: (member: Member) => void
  onAddStory: (member: Member) => void
  onOpenChat?: (member: Member) => void
  onConnectMember?: (member: Member) => void
  bgOpacity: number
  // When the profile drawer (~450px on the right) is mounted, the minimap
  // and fit-to-view math treat that band as reserved so the tree stays
  // visually centered in the remaining space.
  profilePanelOpen?: boolean
  // Parentesco de cada manzana visto desde quien mira (id -> "abuela"...).
  relationLabels?: Map<string, string>
  // Manzana de quien mira (para "Generaciones: desde mis abuelos")
  meId?: string | null
}

// Chrome insets — the fixed UI edges the canvas must avoid.
// Sidebar occupies left:28px + 76px width = 104px, +12px breathing room.
const SIDEBAR_INSET = 116
const DRAWER_WIDTH = 340

export default function TreeCanvas({ members: allMembers, relationships: allRelationships, onRefresh, onViewProfile, onEditMember, onAddStory, onOpenChat, onConnectMember, bgOpacity, profilePanelOpen = false, relationLabels, meId }: TreeCanvasProps) {
  const isMobile = useIsMobile()

  // ── QUÉ PARTE DEL ÁRBOL SE VE ──────────────────────────────────
  // Generaciones: la elección de la persona se recuerda; si no ha elegido,
  // una familia grande (100+ manzanas) abre "desde mis abuelos".
  const [genChoice, setGenChoice] = useState<GenMode | null>(() => {
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem('apple_gen_mode') : null
      return v === 'all' || v === 'grandparents' || v === 'parents' ? v : null
    } catch { return null }
  })
  const chooseGenMode = useCallback((m: GenMode) => {
    setGenChoice(m)
    try { window.localStorage.setItem('apple_gen_mode', m) } catch { /* sin almacenamiento */ }
  }, [])
  const genMode: GenMode = genChoice ?? (allMembers.length >= AUTO_HIDE_FROM ? 'grandparents' : 'all')
  const [genMenuOpen, setGenMenuOpen] = useState(false)
  // Rama: solo una persona con sus papás, pareja y descendientes.
  const [branchRootId, setBranchRootId] = useState<string | null>(null)
  const treeView = useMemo(
    () => filterTreeView(allMembers, allRelationships, { meId, genMode, branchRootId }),
    [allMembers, allRelationships, meId, genMode, branchRootId],
  )
  const members = treeView.members
  const relationships = treeView.relationships
  // Vista en celular: 'esfera' (panal tipo reloj) o 'ramas' (vista anterior).
  // (La vista móvil solo se pinta después de montar, así que leer localStorage
  // aquí no causa diferencias de hidratación.)
  const [mobileView, setMobileView] = useState<'esfera' | 'ramas'>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem('apple_mobile_view') === 'ramas') return 'ramas'
    } catch { /* sin almacenamiento: usar la predeterminada */ }
    return 'esfera'
  })
  const changeMobileView = (v: 'esfera' | 'ramas') => {
    setMobileView(v)
    try { window.localStorage.setItem('apple_mobile_view', v) } catch { /* ignore */ }
  }
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)
  // Two-stage hover: hover shows the compact HoverPeek pill; clicking its
  // "…" opens the full HoverMenu identified here.
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null)
  const [addingToMember, setAddingToMember] = useState<Member | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Starting at 0,0 since we calibrated BASE_Y in the layout engine
  const [offset, setOffset] = useState({ x: 0, y: 0 }) 
  const [scale, setScale] = useState(1)
  // true cuando el usuario mueve el zoom o arrastra: así el reencuadre
  // automático (al cambiar el espacio de la pantalla) no le quita su vista.
  const userMovedRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // ── FOCUS MODE ────────────────────────────────────────────────
  // When focusedMemberId is set: camera pans to that member, the "kin"
  // (parents, grandparents, siblings, spouse, children, grandchildren)
  // stay fully visible, the rest of the tree stays visible but dimmed.
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null)
  const [animatingTransform, setAnimatingTransform] = useState(false)
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)

  // Container dimensions (tracked live via ResizeObserver) so the mini-map
  // can compute the viewport rectangle without depending on a stale ref read.
  const [containerRect, setContainerRect] = useState<{ width: number; height: number } | null>(null)

  // ── FISHEYE LENS ──────────────────────────────────────────────
  // Apple-Watch honeycomb feel: whichever apple sits under the cursor grows,
  // its neighbors get a softer boost, and the rest of the tree stays at
  // baseline. cursorTreeXY is in TREE coordinates (pan+zoom already undone)
  // so the effect works at every zoom level.
  const [cursorTreeXY, setCursorTreeXY] = useState<{ x: number; y: number } | null>(null)
  const rafPending = useRef(false)

  // ── COLLAPSIBLE BRANCHES ─────────────────────────────────────
  // Members in collapsedIds hide their descendants from the canvas.
  // A golden "+N" badge appears on the collapsed apple; clicking it re-expands.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const toggleCollapsed = useCallback((memberId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }, [])

  // Zoom limits
  const MIN_SCALE = 0.25
  const MAX_SCALE = 2

  // Refs mirror state so native (non-React) listeners always read fresh values
  const offsetRef = useRef(offset)
  const scaleRef = useRef(scale)
  const focusedMemberIdRef = useRef<string | null>(null)
  useEffect(() => { offsetRef.current = offset }, [offset])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { focusedMemberIdRef.current = focusedMemberId }, [focusedMemberId])

  const positionedMembers = useMemo(() => {
    return computeTreeLayout(members, relationships)
  }, [members, relationships])

  // Sphere lens disabled — deformaba filas y confundía el layout jerárquico.
  // Passthrough: mantiene coords originales, escala neutra. El fisheye del
  // cursor (más abajo, per-apple) sigue funcionando para el efecto lente
  // local sobre la manzana que apuntas.
  const spherizedMembers = useMemo(() => {
    return positionedMembers.map(m => ({
      ...m,
      lensedX: m.canvasX,
      lensedY: m.canvasY,
      lensScale: 1,
    }))
  }, [positionedMembers])

  const lensedById = useMemo(() => {
    const map = new Map<string, { lensedX: number; lensedY: number; lensScale: number }>()
    spherizedMembers.forEach(m => map.set(m.id, { lensedX: m.lensedX, lensedY: m.lensedY, lensScale: m.lensScale }))
    return map
  }, [spherizedMembers])

  // Set of member IDs that count as "direct kin" of the focused member.
  // null → no focus active, all members render at full opacity.
  const kinIds = useMemo<Set<string> | null>(() => {
    if (!focusedMemberId) return null
    const set = new Set<string>()
    set.add(focusedMemberId)
    const focused = positionedMembers.find(m => m.id === focusedMemberId)
    if (!focused) return set
    const parentIds = focused.parents || []
    parentIds.forEach(id => set.add(id))
    // Grandparents
    parentIds.forEach(pid => {
      const parent = positionedMembers.find(m => m.id === pid)
      ;(parent?.parents || []).forEach(gpid => set.add(gpid))
    })
    // Siblings (share at least one parent)
    positionedMembers.forEach(m => {
      if (m.id === focused.id) return
      if ((m.parents || []).some(pid => parentIds.includes(pid))) {
        set.add(m.id)
      }
    })
    // Spouse
    relationships.forEach(rel => {
      if (rel.relationship !== 'spouse') return
      if (rel.member1Id === focused.id) set.add(rel.member2Id)
      if (rel.member2Id === focused.id) set.add(rel.member1Id)
    })
    // Children
    const children = positionedMembers.filter(m => (m.parents || []).includes(focused.id))
    children.forEach(c => set.add(c.id))
    // Grandchildren
    children.forEach(child => {
      positionedMembers
        .filter(m => (m.parents || []).includes(child.id))
        .forEach(gc => set.add(gc.id))
    })
    return set
  }, [focusedMemberId, positionedMembers, relationships])

  // Rama iluminada al pasar el mouse: la manzana, todos sus ancestros, todos
  // sus descendientes y sus parejas. Las líneas de esa rama se encienden y
  // el resto queda tenue (en vez de una telaraña dorada uniforme).
  const hoverLineage = useMemo<Set<string> | null>(() => {
    if (!hoveredMemberId || focusedMemberId) return null
    const byId = new Map(positionedMembers.map(m => [m.id, m]))
    const set = new Set<string>([hoveredMemberId])
    const up = (id: string) => {
      for (const p of byId.get(id)?.parents ?? []) if (!set.has(p) && byId.has(p)) { set.add(p); up(p) }
    }
    const down = (id: string) => {
      for (const m of positionedMembers) {
        if ((m.parents ?? []).includes(id) && !set.has(m.id)) { set.add(m.id); down(m.id) }
      }
    }
    up(hoveredMemberId)
    down(hoveredMemberId)
    for (const s of byId.get(hoveredMemberId)?.spouses ?? []) set.add(s)
    relationships.forEach(rel => {
      if (rel.relationship !== 'spouse') return
      if (rel.member1Id === hoveredMemberId) set.add(rel.member2Id)
      if (rel.member2Id === hoveredMemberId) set.add(rel.member1Id)
    })
    return set
  }, [hoveredMemberId, focusedMemberId, positionedMembers, relationships])

  // Adjacency: for each parent id → array of direct child members.
  // Computed once per tree change, reused by the derived collapse maps below.
  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof positionedMembers>()
    positionedMembers.forEach(m => {
      ;(m.parents || []).forEach(pid => {
        const arr = map.get(pid) || []
        arr.push(m)
        map.set(pid, arr)
      })
    })
    return map
  }, [positionedMembers])

  // hasDescendantsMap: id → true if member has at least one child.
  const hasDescendantsMap = useMemo(() => {
    const map = new Map<string, boolean>()
    positionedMembers.forEach(m => {
      map.set(m.id, (childrenByParent.get(m.id)?.length ?? 0) > 0)
    })
    return map
  }, [positionedMembers, childrenByParent])

  // hiddenIds: members currently hidden because an ancestor is collapsed
  // (manual toggle) OR because focus mode auto-collapsed a far lateral branch.
  //
  // Smart lateral compression: when the user focuses on a member, distant
  // uncle/aunt branches (>4×NODE_SIZE horizontally away from the kin cluster
  // and not part of it) collapse automatically so the family in focus reads
  // clearly. The badge counter still shows how many descendants were tucked
  // away; a click on it (or exiting focus mode) restores them.
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>()
    const visit = (id: string) => {
      const kids = childrenByParent.get(id) || []
      kids.forEach(k => {
        if (!hidden.has(k.id)) {
          hidden.add(k.id)
          visit(k.id)
        }
      })
    }
    collapsedIds.forEach(id => visit(id))

    if (focusedMemberId && kinIds) {
      const kinXs = positionedMembers
        .filter(m => kinIds.has(m.id))
        .map(m => m.canvasX ?? 0)
      if (kinXs.length > 0) {
        const kinMinX = Math.min(...kinXs)
        const kinMaxX = Math.max(...kinXs)
        const LATERAL_BUFFER = NODE_SIZE * 4
        positionedMembers.forEach(m => {
          if (kinIds.has(m.id)) return
          if (hidden.has(m.id)) return
          const x = m.canvasX ?? 0
          const beyondLeft = x < kinMinX - LATERAL_BUFFER
          const beyondRight = x > kinMaxX + LATERAL_BUFFER
          if (beyondLeft || beyondRight) {
            hidden.add(m.id)
            visit(m.id)
          }
        })
      }
    }
    return hidden
  }, [collapsedIds, childrenByParent, focusedMemberId, kinIds, positionedMembers])

  // descendantCount: id → total descendants (only computed for collapsed nodes).
  const descendantCounts = useMemo(() => {
    const counts = new Map<string, number>()
    collapsedIds.forEach(id => {
      let count = 0
      const visit = (nid: string) => {
        const kids = childrenByParent.get(nid) || []
        kids.forEach(k => {
          count++
          visit(k.id)
        })
      }
      visit(id)
      counts.set(id, count)
    })
    return counts
  }, [collapsedIds, childrenByParent])

  // Tree bounding box in canvas coordinates (includes node size + name labels)
  const treeBounds = useMemo(() => {
    if (positionedMembers.length === 0) return null
    const xs = positionedMembers.map(m => m.canvasX ?? 0)
    const ys = positionedMembers.map(m => m.canvasY ?? 0)
    return {
      minX: Math.min(...xs) - NODE_SIZE / 2,
      maxX: Math.max(...xs) + NODE_SIZE / 2,
      minY: Math.min(...ys),
      maxY: Math.max(...ys) + NODE_SIZE + 50 // room for name labels
    }
  }, [positionedMembers])

  // ── FIT TO VIEW: scale + center so the WHOLE tree is visible in the
  // area NOT covered by fixed chrome (sidebar + optional profile drawer).
  // Prior version centered on the raw container, which pushed the tree
  // under the sidebar and made the ⊡ button look "off-center".
  const fitToView = useCallback(() => {
    if (!treeBounds || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    // Encajar el árbol DENTRO DE LA COPA de la foto de fondo. La copa es una
    // CÚPULA (angosta arriba, ancha abajo), medida sobre la imagen original
    // (1536×1024). El fondo usa "cover" centrado, así que se convierte esa
    // cúpula a coordenadas de pantalla y se busca la escala más grande y la
    // posición en que TODAS las manzanas (con su nombre) caen dentro.
    const vw = window.innerWidth
    const vh = window.innerHeight
    const imgScale = Math.max(vw / 1536, vh / 1024)
    const imgLeft = (vw - 1536 * imgScale) / 2 - rect.left
    const imgTop = (vh - 1024 * imgScale) / 2 - rect.top
    const toImg = (sx: number, sy: number): [number, number] => [(sx - imgLeft) / imgScale, (sy - imgTop) / imgScale]
    // Cúpula en la imagen: centro x 757; la parte de arriba es media elipse
    // (radio 595 × 480, cima en y≈140); de y 620 a 700 conserva el ancho;
    // más abajo solo el tronco.
    const insideCanopy = (ix: number, iy: number) => {
      const dx = Math.abs(ix - 757)
      if (iy < 620) {
        const ex = dx / (595 * 0.93)
        const ey = (620 - iy) / (480 * 0.93)
        return ex * ex + ey * ey <= 1
      }
      if (iy <= 700) return dx <= 595 * 0.93
      return iy <= 860 && dx <= 150
    }
    const leftInset = SIDEBAR_INSET + 8
    const rightInset = profilePanelOpen ? DRAWER_WIDTH + 24 : 24
    // Puntos a revisar por manzana: las 4 esquinas de la manzana + su nombre.
    const pts: Array<[number, number]> = []
    for (const m of positionedMembers) {
      const x = m.canvasX ?? 0
      const y = m.canvasY ?? 0
      pts.push([x - NODE_SIZE * 0.42, y + NODE_SIZE * 0.1], [x + NODE_SIZE * 0.42, y + NODE_SIZE * 0.1],
        [x - NODE_SIZE * 0.42, y + NODE_SIZE * 1.3], [x + NODE_SIZE * 0.42, y + NODE_SIZE * 1.3])
    }
    const treeCenterX = (treeBounds.minX + treeBounds.maxX) / 2
    const treeH = treeBounds.maxY - treeBounds.minY
    // Centro horizontal de la copa en pantalla
    const canopyCX = imgLeft + 757 * imgScale
    const canopyTopY = imgTop + 140 * imgScale
    const canopyBotY = imgTop + 860 * imgScale
    const fits = (sc: number, ox: number, oy: number) => {
      for (const [px, py] of pts) {
        const sx = px * sc + ox
        const sy = py * sc + oy
        if (sx < leftInset || sx > rect.width - rightInset || sy < 4 || sy > rect.height - 70) return false
        const [ix, iy] = toImg(sx, sy)
        if (!insideCanopy(ix, iy)) return false
      }
      return true
    }
    let best: { sc: number, ox: number, oy: number } | null = null
    for (let sc = 1.1; sc >= MIN_SCALE && !best; sc -= 0.02) {
      const ox = canopyCX - treeCenterX * sc
      // Probar distintas alturas: de la cima de la copa hacia abajo
      const span = canopyBotY - canopyTopY - treeH * sc
      if (span < 0) continue
      for (let k = 0; k <= 24; k++) {
        const top = canopyTopY + (span * k) / 24
        const oy = top - treeBounds.minY * sc
        if (fits(sc, ox, oy)) { best = { sc, ox, oy }; break }
      }
    }
    // Si nada cabe (familia enorme o pantalla muy chica): todo a la vista.
    if (!best) {
      const usableW = Math.max(rect.width - leftInset - rightInset, 200)
      const usableH = Math.max(rect.height - 90, 200)
      const sc = Math.max(Math.min(usableW / (treeBounds.maxX - treeBounds.minX), usableH / treeH, 1.1), MIN_SCALE)
      best = {
        sc,
        ox: leftInset + usableW / 2 - treeCenterX * sc,
        oy: 10 + usableH / 2 - ((treeBounds.minY + treeBounds.maxY) / 2) * sc,
      }
    }
    const newScale = Math.max(Math.min(best.sc, MAX_SCALE), MIN_SCALE)
    userMovedRef.current = false
    setScale(newScale)
    setOffset({ x: best.ox, y: best.oy })
  }, [treeBounds, profilePanelOpen, positionedMembers])

  // ── ZOOM AROUND A SCREEN POINT (cursor or viewport center) ──
  const zoomAt = useCallback((screenX: number, screenY: number, factor: number) => {
    const oldScale = scaleRef.current
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor))
    if (newScale === oldScale) return
    const ratio = newScale / oldScale
    const o = offsetRef.current
    userMovedRef.current = true
    setScale(newScale)
    setOffset({
      x: screenX - (screenX - o.x) * ratio,
      y: screenY - (screenY - o.y) * ratio
    })
  }, [])

  const zoomFromCenter = (factor: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cx = SIDEBAR_INSET + (rect.width - SIDEBAR_INSET - (profilePanelOpen ? DRAWER_WIDTH + 24 : 24)) / 2
    zoomAt(cx, rect.height / 2, factor)
  }

  // ── FOCUS EFFECT: animate camera so the focused member lands in the
  // usable center (sidebar + drawer excluded), not the raw viewport middle.
  useEffect(() => {
    if (!focusedMemberId || !containerRef.current) return
    const focused = positionedMembers.find(m => m.id === focusedMemberId)
    if (!focused) return
    const rect = containerRef.current.getBoundingClientRect()
    const targetScale = Math.max(scaleRef.current, 0.9)
    const nodeCenterX = focused.canvasX ?? 0
    const nodeCenterY = (focused.canvasY ?? 0) + NODE_SIZE / 2
    const rightInset = profilePanelOpen ? DRAWER_WIDTH + 24 : 24
    const usableCenterX = SIDEBAR_INSET + (rect.width - SIDEBAR_INSET - rightInset) / 2
    setAnimatingTransform(true)
    setScale(targetScale)
    setOffset({
      x: usableCenterX - nodeCenterX * targetScale,
      y: rect.height / 2 - nodeCenterY * targetScale
    })
    const t = setTimeout(() => setAnimatingTransform(false), 600)
    return () => clearTimeout(t)
  }, [focusedMemberId, positionedMembers, profilePanelOpen])

  // ── ESC exits focus mode ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusedMemberId) setFocusedMemberId(null)
      if (e.key === 'Escape') setBranchRootId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedMemberId])

  // ── Keep containerRect in sync with the real viewport ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setContainerRect({ width: r.width, height: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── MINI-MAP layout: how tree coords map into the 200x140 mini-map area ──
  const MINIMAP_W = 200
  const MINIMAP_H = 140
  const MINIMAP_PAD = 10
  const miniMapInfo = useMemo(() => {
    if (!treeBounds) return null
    const innerW = MINIMAP_W - 2 * MINIMAP_PAD
    const innerH = MINIMAP_H - 2 * MINIMAP_PAD
    const treeW = Math.max(treeBounds.maxX - treeBounds.minX, 1)
    const treeH = Math.max(treeBounds.maxY - treeBounds.minY, 1)
    const s = Math.min(innerW / treeW, innerH / treeH)
    const contentW = treeW * s
    const contentH = treeH * s
    return {
      s,
      offsetX: MINIMAP_PAD + (innerW - contentW) / 2,
      offsetY: MINIMAP_PAD + (innerH - contentH) / 2
    }
  }, [treeBounds])

  const handleMinimapClick = useCallback((e: React.MouseEvent<SVGElement>) => {
    if (!treeBounds || !miniMapInfo || !containerRect) return
    const svgRect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - svgRect.left
    const my = e.clientY - svgRect.top
    const treeX = (mx - miniMapInfo.offsetX) / miniMapInfo.s + treeBounds.minX
    const treeY = (my - miniMapInfo.offsetY) / miniMapInfo.s + treeBounds.minY
    const rightInset = profilePanelOpen ? DRAWER_WIDTH + 24 : 24
    const usableCenterX = SIDEBAR_INSET + (containerRect.width - SIDEBAR_INSET - rightInset) / 2
    setAnimatingTransform(true)
    setOffset({
      x: usableCenterX - treeX * scaleRef.current,
      y: containerRect.height / 2 - treeY * scaleRef.current
    })
    setTimeout(() => setAnimatingTransform(false), 600)
  }, [treeBounds, miniMapInfo, containerRect, profilePanelOpen])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.apple-node-clickable')) return
    setIsDragging(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
  }

  // Track cursor in TREE coords for the fisheye lens. rAF-throttled so 20+
  // apples don't rebalance on every raw mousemove event.
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (rafPending.current) return
    const clientX = e.clientX
    const clientY = e.clientY
    rafPending.current = true
    requestAnimationFrame(() => {
      rafPending.current = false
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      const s = scaleRef.current
      const o = offsetRef.current
      setCursorTreeXY({ x: (sx - o.x) / s, y: (sy - o.y) / s })
    })
  }, [])

  const handleCanvasMouseLeave = useCallback(() => {
    setCursorTreeXY(null)
  }, [])

  useEffect(() => {
    const handleOpenModal = (e: any) => {
      if (e.detail) setAddingToMember(e.detail)
    }
    // "Ver su rama" (perfil o tarjeta): muestra SOLO esa rama, re-acomodada.
    const handleFocusBranch = (e: any) => {
      if (e.detail?.id) {
        setFocusedMemberId(null)
        userMovedRef.current = false
        setBranchRootId(e.detail.id)
      }
    }
    window.addEventListener('open-add-modal', handleOpenModal)
    window.addEventListener('focus-branch', handleFocusBranch)
    return () => {
      window.removeEventListener('open-add-modal', handleOpenModal)
      window.removeEventListener('focus-branch', handleFocusBranch)
    }
  }, [])

  // INITIAL VIEW: auto fit-to-view so the WHOLE tree fits the viewport on
  // load — a family that grows two more generations still frames itself
  // correctly without the user having to zoom or pan. Falls back to a
  // centered 100% only for a single-node tree where fit isn't meaningful.
  const didInitialFit = useRef(false)
  useEffect(() => {
    if (positionedMembers.length === 0 || !containerRef.current || didInitialFit.current) return
    didInitialFit.current = true

    if (positionedMembers.length === 1) {
      const only = positionedMembers[0]
      const rect = containerRef.current.getBoundingClientRect()
      setScale(1)
      setOffset({ x: rect.width / 2 - only.canvasX, y: rect.height / 2 - only.canvasY })
      return
    }
    requestAnimationFrame(() => fitToView())
  }, [positionedMembers, fitToView])

  // RESPONSIVE GROWTH: cuando la familia crece o el viewport cambia, el
  // árbol se re-encuadra solo. El usuario ya no tiene que ⊡ manualmente
  // al agregar generaciones nuevas.
  const lastFittedCount = useRef(0)
  useEffect(() => {
    if (!didInitialFit.current) return
    const count = positionedMembers.length
    if (count === 0) return
    // Re-encuadrar si cambió el número de manzanas, o si cambió el tamaño
    // del lienzo y el usuario no ha movido la vista.
    if (Math.abs(count - lastFittedCount.current) >= 1 || !userMovedRef.current) {
      lastFittedCount.current = count
      requestAnimationFrame(() => fitToView())
    }
  }, [positionedMembers.length, containerRect?.width, containerRect?.height, fitToView])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - lastMousePos.x
    const deltaY = e.clientY - lastMousePos.y
    userMovedRef.current = true
    setOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }, [isDragging, lastMousePos])

  const handleMouseUp = (e: MouseEvent) => {
    setIsDragging(false)
    // If the pointer barely moved between mouseDown and mouseUp, treat it
    // as a background click and exit focus mode when active.
    if (mouseDownPosRef.current && focusedMemberIdRef.current) {
      const dx = e.clientX - mouseDownPosRef.current.x
      const dy = e.clientY - mouseDownPosRef.current.y
      if (Math.hypot(dx, dy) < 4) setFocusedMemberId(null)
    }
    mouseDownPosRef.current = null
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.apple-node-clickable')) return
    const touch = e.touches[0]
    setIsDragging(true)
    setLastMousePos({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - lastMousePos.x
    const deltaY = touch.clientY - lastMousePos.y
    userMovedRef.current = true
    setOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
    setLastMousePos({ x: touch.clientX, y: touch.clientY })
  }, [isDragging, lastMousePos])

  const handleTouchEnd = () => setIsDragging(false)

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleTouchEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, handleMouseMove, handleTouchMove])

  // Premium Wheel Handler: Must be native non-passive to call preventDefault()
  // This physically blocks the browser from interpreting trackpad swipes as "go back" gestures.
  // Pinch gesture / Ctrl+wheel → ZOOM toward the cursor. Plain wheel → PAN.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault() // Stop browser history swipe / page zoom

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch fires wheel events with ctrlKey=true
        const rect = el.getBoundingClientRect()
        const factor = Math.exp(-e.deltaY * 0.0022)
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor)
        return
      }

      userMovedRef.current = true
      setOffset(prev => ({
        x: prev.x - e.deltaX * 0.8,
        y: prev.y - e.deltaY * 0.8 
      }))
    }

    // passive: false allows preventDefault to work
    el.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleNativeWheel)
  }, [zoomAt])

  const handleDeleteMember = async (member: Member) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar a ${member.firstName} ${member.lastName}? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      // 1. Eliminar relaciones primero (para evitar errores de clave foránea)
      await supabase
        .from('relationships')
        .delete()
        .or(`member1_id.eq.${member.id},member2_id.eq.${member.id}`)

      // 2. Eliminar al integrante
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', member.id)

      if (error) throw error
      
      onRefresh()
      setHoveredMemberId(null)
    } catch (err) {
      console.error('Error deleting member:', err)
      alert('No se pudo eliminar al integrante.')
    }
  }

  // ── CONTROLES DE VISTA: generaciones ocultas, rama y menú ─────────
  const pickGenMode = useCallback((m: GenMode) => {
    userMovedRef.current = false
    setGenMenuOpen(false)
    chooseGenMode(m)
  }, [chooseGenMode])
  const showAll = useCallback(() => pickGenMode('all'), [pickGenMode])
  const exitBranch = useCallback(() => {
    userMovedRef.current = false
    setBranchRootId(null)
  }, [])
  const renderViewChrome = (mobile: boolean) => {
    const hidden = treeView.hiddenAncestors
    const names = hidden.slice(0, 3).map(m => m.firstName)
    const extra = hidden.length - names.length
    const pill: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 10, padding: mobile ? '7px 8px 7px 14px' : '8px 8px 8px 16px',
      borderRadius: 999, background: 'var(--menu-bg)', color: 'var(--menu-fg)',
      border: '1px solid var(--menu-border)', boxShadow: 'var(--panel-shadow)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', fontSize: mobile ? 12 : 13,
      maxWidth: mobile ? 'calc(100vw - 24px)' : 640, whiteSpace: 'nowrap',
    }
    const goldBtn: React.CSSProperties = {
      border: 'none', borderRadius: 999, padding: mobile ? '6px 12px' : '7px 14px', cursor: 'pointer',
      background: 'var(--accent-gold)', color: '#16201A', fontWeight: 800, fontSize: mobile ? 11.5 : 12, flexShrink: 0,
    }
    const genOptions: Array<{ id: GenMode, label: string, sub: string }> = [
      { id: 'all', label: 'Todas', sub: 'Todo el árbol, desde las raíces' },
      { id: 'grandparents', label: 'Desde mis abuelos', sub: 'Oculta bisabuelos y anteriores' },
      { id: 'parents', label: 'Desde mis papás', sub: 'Oculta abuelos y anteriores' },
    ]
    return (
      <>
        {/* Rama: barra arriba para volver al árbol completo */}
        {treeView.branchRoot && (
          <div style={{ position: 'absolute', top: mobile ? 54 : 22, left: '50%', transform: 'translateX(-50%)', zIndex: 650 }}
            onMouseDown={e => e.stopPropagation()}>
            <div style={pill}>
              <span aria-hidden>🌿</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Rama de <strong>{treeView.branchRoot.firstName}</strong> · {members.length} {members.length === 1 ? 'persona' : 'personas'}
              </span>
              <button onClick={exitBranch} style={goldBtn}>Ver todo el árbol</button>
            </div>
          </div>
        )}

        {/* Raíces ocultas: marca en el tronco */}
        {!treeView.branchRoot && hidden.length > 0 && (
          <div style={{ position: 'absolute', bottom: mobile ? 84 : 84, left: '50%', transform: 'translateX(-50%)', zIndex: 620 }}
            onMouseDown={e => e.stopPropagation()}>
            <div style={pill}>
              <span aria-hidden>🌱</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {treeView.hiddenGenerations} {treeView.hiddenGenerations === 1 ? 'generación anterior' : 'generaciones anteriores'}
                {!mobile && <> · {names.join(', ')}{extra > 0 ? ` y ${extra} más` : ''}</>}
              </span>
              <button onClick={showAll} style={goldBtn}>Mostrar</button>
            </div>
          </div>
        )}

        {/* Menú Generaciones */}
        {!treeView.branchRoot && treeView.canHideGenerations && (
          <div style={mobile
            ? { position: 'absolute', top: 54, right: 12, zIndex: 640 }
            : { position: 'absolute', bottom: 24, left: 'calc(50% + 120px)', zIndex: 640 }}
            onMouseDown={e => e.stopPropagation()}>
            <button onClick={() => setGenMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={genMenuOpen}
              style={{
                height: mobile ? 34 : 48, padding: '0 14px', borderRadius: mobile ? 999 : 14, cursor: 'pointer',
                background: 'var(--panel-bg)', color: 'var(--accent-gold)', border: '1px solid var(--panel-border)',
                boxShadow: 'var(--panel-shadow)', backdropFilter: 'blur(8px)', fontWeight: 700, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <span aria-hidden style={{ fontSize: 14 }}>☰</span> Generaciones
            </button>
            {genMenuOpen && (
              <div role="menu" style={{
                position: 'absolute', [mobile ? 'top' : 'bottom']: mobile ? 40 : 56, [mobile ? 'right' : 'left']: 0,
                width: 250, padding: 6, borderRadius: 14, background: 'var(--menu-bg)', color: 'var(--menu-fg)',
                border: '1px solid var(--menu-border)', boxShadow: 'var(--panel-shadow)',
              }}>
                {genOptions.map(o => (
                  <button key={o.id} role="menuitemradio" aria-checked={genMode === o.id}
                    onClick={() => pickGenMode(o.id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: genMode === o.id ? 'var(--menu-active)' : 'transparent', color: 'inherit',
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                    }}>
                    <span style={{ width: 14, color: 'var(--accent-gold)', fontWeight: 800 }}>{genMode === o.id ? '✓' : ''}</span>
                    <span>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{o.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, opacity: 0.65 }}>{o.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  // ── MOBILE: delegate to dedicated mobile view ─────────────────
  if (isMobile) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {mobileView === 'esfera' ? (
          <WatchTreeView
            members={members}
            relationships={relationships}
            onMemberTap={onViewProfile}
          />
        ) : (
          <MobileTreeView
            members={members}
            relationships={relationships}
            onMemberTap={onViewProfile}
            onDeleteMember={async (member) => { await handleDeleteMember(member) }}
          />
        )}
        {/* Selector de vista */}
        <div role="tablist" aria-label="Vista del árbol" style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 5,
          display: 'flex', padding: 3, borderRadius: 20, gap: 2,
          background: 'rgba(20,26,14,0.72)', border: '1px solid rgba(212,175,55,0.35)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          {(['esfera', 'ramas'] as const).map(v => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={mobileView === v}
              onClick={() => changeMobileView(v)}
              style={{
                border: 'none', borderRadius: 16, padding: '6px 14px', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                background: mobileView === v ? '#D4AF37' : 'transparent',
                color: mobileView === v ? '#1B2414' : 'rgba(245,230,200,0.75)',
              }}
            >
              {v === 'esfera' ? 'Esfera' : 'Ramas'}
            </button>
          ))}
        </div>
        {renderViewChrome(true)}
        {addingToMember && (
          <AddMemberModal
            targetMember={addingToMember}
            relationships={allRelationships}
            allMembers={allMembers}
            onClose={() => { setAddingToMember(null) }}
            onSave={onRefresh}
          />
        )}
      </div>
    )
  }

  // ── DESKTOP: original render (zero changes below) ─────────────
  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleCanvasMouseLeave}
      onTouchStart={handleTouchStart}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        overscrollBehavior: 'none'
      }}
    >
      {/* Tree background lives on <main> now (fixed, full viewport), so every
         glass panel above can blur it. Overlay tint stays per-canvas so the
         apple cluster reads against a slightly softened band. */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--canvas-overlay)',
        opacity: bgOpacity,
        pointerEvents: 'none',
        zIndex: 5
      }} />

      {/* Premium radial vignette — draws the eye to the family cluster in
         the visible band (past sidebar, before drawer), so the canvas
         reads as an intentional composition rather than an infinite grid.
         Class-based mix-blend-mode so light/dark can swap it. */}
      <div
        className="tree-canvas-vignette"
        style={{
          position: 'absolute',
          inset: 0,
          background: profilePanelOpen
            ? 'radial-gradient(ellipse at 42% 55%, var(--canvas-vignette-in) 40%, var(--canvas-vignette-out) 100%)'
            : 'radial-gradient(ellipse at 55% 55%, var(--canvas-vignette-in) 45%, var(--canvas-vignette-out) 100%)',
          pointerEvents: 'none',
          zIndex: 6
        }}
      />

      {/* Orillas un poco más oscuras: las manzanas resaltan sobre el atardecer. */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 7,
        background: 'radial-gradient(ellipse 75% 70% at 52% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.38) 100%)',
      }} />
      {/* PAN + ZOOM WRAPPER (For performance during dragging) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: '0 0',
        transition: animatingTransform ? 'transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
        pointerEvents: 'none', // Let dragging work on the container behind it
        zIndex: 50 // Creates stacking context ABOVE the background
      }}>
        {/* SVG CONNECTIONS */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 10 }}>
          {positionedMembers.map((child) => {
            const parentIds = child.parents || []
            if (parentIds.length === 0) return null
            if (hiddenIds.has(child.id)) return null

            let parents = positionedMembers.filter(p => parentIds.includes(p.id))
            if (parents.length === 0) return null

            // Usar posiciones lenseadas para que las líneas sigan la
            // deformación radial del sphere lens.
            const childLensed = lensedById.get(child.id)
            const childX = childLensed ? childLensed.lensedX : (child.canvasX ?? 0)
            const childY = childLensed ? childLensed.lensedY : (child.canvasY ?? 0)
            const midX = parents.reduce((sum, p) => sum + (lensedById.get(p.id)?.lensedX ?? p.canvasX ?? 0), 0) / parents.length
            const midY = parents.reduce((sum, p) => sum + (lensedById.get(p.id)?.lensedY ?? p.canvasY ?? 0), 0) / parents.length

            if (childY >= midY) return null

            const x1 = midX
            const y1 = midY + NODE_SIZE / 2
            const x2 = childX
            const y2 = childY + NODE_SIZE

            const lineIsKin = kinIds
              ? kinIds.has(child.id) && parents.some(p => kinIds.has(p.id))
              : true
            const inLineage = !!hoverLineage && hoverLineage.has(child.id) && parents.some(p => hoverLineage.has(p.id))
            const lineOpacity = kinIds
              ? (lineIsKin ? 0.9 : 0.12)
              : hoverLineage ? (inLineage ? 0.95 : 0.08) : 0.22
            return (
              <path
                key={`path-trunk-${child.id}`}
                d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                fill="none"
                stroke={inLineage ? 'var(--accent-gold)' : 'var(--tree-line)'}
                strokeWidth={inLineage ? 2.6 : 1.3}
                strokeLinecap="round"
                opacity={lineOpacity}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)' }}
              />
            )
          })}

          {/* Spouse Lines (Direct) — también sobre posiciones lenseadas */}
          {positionedMembers.map((m1) => {
            return relationships
              .filter(rel => rel.relationship === 'spouse' && (rel.member1Id === m1.id || rel.member2Id === m1.id))
              .map(rel => {
                const otherId = rel.member1Id === m1.id ? rel.member2Id : rel.member1Id
                const m2 = positionedMembers.find(m => m.id === otherId)
                if (!m2 || m1.id > m2.id) return null
                if (hiddenIds.has(m1.id) || hiddenIds.has(m2.id)) return null

                const l1 = lensedById.get(m1.id)
                const l2 = lensedById.get(m2.id)
                const x1 = l1 ? l1.lensedX : m1.canvasX
                const y1 = (l1 ? l1.lensedY : m1.canvasY) + NODE_SIZE / 2
                const x2 = l2 ? l2.lensedX : m2.canvasX
                const y2 = (l2 ? l2.lensedY : m2.canvasY) + NODE_SIZE / 2
                
                const spouseInLineage = !!hoverLineage && hoverLineage.has(m1.id) && hoverLineage.has(m2.id)
                const spouseLineOpacity = kinIds
                  ? (kinIds.has(m1.id) && kinIds.has(m2.id) ? 0.85 : 0.12)
                  : hoverLineage ? (spouseInLineage ? 0.9 : 0.08) : 0.3
                return (
                  <line
                    key={`spouse-line-${rel.id}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="var(--tree-line)"
                    strokeWidth={1.5}
                    strokeDasharray="4, 4"
                    strokeLinecap="round"
                    opacity={spouseLineOpacity}
                    style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)' }}
                  />
                )
              })
          })}
        </svg>

        {/* Nodes Layer */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none' }}>
          {spherizedMembers.map((member) => {
            if (hiddenIds.has(member.id)) return null
            const isKin = !kinIds || kinIds.has(member.id)
            const isFocused = focusedMemberId === member.id
            const isCollapsed = collapsedIds.has(member.id)
            const collapsedCount = descendantCounts.get(member.id) ?? 0
            const memberHasDescendants = hasDescendantsMap.get(member.id) ?? false

            // La lente radial ya remapeó posición Y escala. Solo agrego
            // encima el cursor-fisheye local.
            let cursorFisheye = 1
            if (cursorTreeXY && !isDragging) {
              const SPHERE_R = NODE_SIZE * 5
              const PEAK = 1.85
              const dx = (member.canvasX ?? 0) - cursorTreeXY.x
              const dy = ((member.canvasY ?? 0) + NODE_SIZE / 2) - cursorTreeXY.y
              const d = Math.hypot(dx, dy)
              if (d < SPHERE_R) {
                const t = 1 - d / SPHERE_R
                const eased = t * t * (3 - 2 * t)
                cursorFisheye = 1 + (PEAK - 1) * eased
              }
            }
            const fisheyeScale = member.lensScale * cursorFisheye
            const kinScale = isKin ? 1 : 0.92
            const composedScale = fisheyeScale * kinScale

            return (
            <div
              key={member.id}
              className="apple-node-clickable"
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                setHoveredMemberId(member.id)
              }}
              onMouseLeave={() => {
                // 1200ms para dar tiempo de sobra a mover el cursor al peek.
                // El peek entra a 8px de la manzana pero por escala fisheye
                // o zoom bajo esa distancia puede sentirse más.
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredMemberId(null)
                }, 1200)
              }}
              onClick={(e) => {
                e.stopPropagation()
                // Click abre el perfil (drawer). El focus mode se activa
                // desde el menú expandido si el usuario lo quiere.
                onViewProfile(member)
                setHoveredMemberId(null)
              }}
              style={{
                position: 'absolute',
                left: member.lensedX - NODE_SIZE / 2,
                top: member.lensedY,
                zIndex: isFocused ? 3000 : hoveredMemberId === member.id ? 2000 : (fisheyeScale > 1.1 ? 70 : 50),
                pointerEvents: 'auto',
                width: `${NODE_SIZE}px`,
                height: `${NODE_SIZE}px`,
                opacity: isKin ? 1 : 0.28,
                transform: `scale(${composedScale})`,
                transformOrigin: 'center center',
                transition: cursorTreeXY
                  ? 'opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1)'
                  : 'opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)',
                filter: isFocused ? 'drop-shadow(0 0 22px rgba(212,175,55,0.75))' : 'none'
              }}
            >
            <AppleNode
              member={member}
              size={NODE_SIZE}
              isHovered={hoveredMemberId === member.id}
              onHover={() => {}}
              onLeave={() => {}}
              viewportScale={scale}
              hideText
            />
            {/* Nombre debajo, siempre ~11px en pantalla (compensa el zoom);
                se oculta cuando el árbol está muy alejado. */}
            {scale >= 0.42 && (
              <div style={{
                position: 'absolute', left: '50%', top: NODE_SIZE - 6,
                transform: `translateX(-50%) scale(${1 / (scale * composedScale)})`, transformOrigin: 'top center',
                maxWidth: (SPOUSE_SPACING - 4) * scale * composedScale, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontSize: 11, fontWeight: 600, color: '#F5E6C8', letterSpacing: '0.02em',
                textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.6)', pointerEvents: 'none',
              }}>
                {member.nickname || member.firstName}
              </div>
            )}

            {/* HoverPeek eliminado — el click directo en la manzana abre el
                ProfilePanel con todas las acciones (Añadir, Conectar, Chatear,
                Editar). El pill con "..." solo confundía porque parecía otro
                menú aparte cuando en realidad el flujo unificado es 1 tap. */}

            {/* HoverMenu también eliminado — mismo motivo. Todas las acciones
                viven ahora en el ProfilePanel. */}

            {/* COLLAPSED BRANCH BADGE · click to expand */}
            {isCollapsed && collapsedCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleCollapsed(member.id)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                title={`Expandir rama (${collapsedCount} descendientes)`}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: `${NODE_SIZE + 8}px`,
                  transform: 'translateX(-50%)',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid var(--panel-border)',
                  backgroundColor: 'var(--panel-bg)',
                  color: 'var(--accent-gold)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'auto',
                  zIndex: 60,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                +{collapsedCount}
              </button>
            )}
          </div>
          )
        })}
        </div>
      </div>

      {/* TARJETA AL PASAR EL MOUSE: nombre completo, parentesco contigo y años.
          Va en coordenadas de pantalla (fuera del zoom) para leerse siempre igual. */}
      {hoveredMemberId && !isDragging && !focusedMemberId && (() => {
        const hm = spherizedMembers.find(m => m.id === hoveredMemberId)
        if (!hm || hiddenIds.has(hm.id)) return null
        const sx = offset.x + hm.lensedX * scale
        const sy = offset.y + hm.lensedY * scale
        const phrase = kinshipPhrase(relationLabels?.get(hm.id))
        const by = hm.dateOfBirth?.split('-')[0]
        const dy = hm.dateOfDeath?.split('-')[0]
        const years = dy ? `${by || '?'} – ${dy}` : by ? `Nació en ${by}` : ''
        return (
          <div style={{
            position: 'absolute', left: sx, top: sy - 10, transform: 'translate(-50%, -100%)',
            zIndex: 600, pointerEvents: 'none', textAlign: 'center', whiteSpace: 'nowrap',
            padding: '8px 14px', borderRadius: 12,
            background: 'rgba(20,26,14,0.88)', border: '1px solid rgba(212,175,55,0.45)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: '#F5E6C8' }}>
              {hm.firstName} {hm.lastName}
            </div>
            {(phrase || years) && (
              <div style={{ marginTop: 2, fontSize: 11.5, color: 'rgba(245,230,200,0.75)' }}>
                {phrase && <strong style={{ color: '#D4AF37', fontWeight: 700 }}>{phrase}</strong>}
                {phrase && years ? ' · ' : ''}{years}
              </div>
            )}
          </div>
        )
      })()}
      {/* ZOOM CONTROLS · floating, bottom center */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px',
        borderRadius: '14px',
        backgroundColor: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
        backdropFilter: 'blur(8px)',
        zIndex: 500
      }}>
        {([
          { label: '−', title: 'Alejar', action: () => zoomFromCenter(1 / 1.25) },
          { label: '⊡', title: 'Ver todo el árbol', action: fitToView },
          { label: '+', title: 'Acercar', action: () => zoomFromCenter(1.25) }
        ] as const).map(btn => (
          <button
            key={btn.title}
            title={btn.title}
            onClick={btn.action}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--accent-gold)',
              fontSize: btn.label === '⊡' ? '18px' : '20px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(212,175,55,0.15)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
          >
            {btn.label}
          </button>
        ))}
        <span style={{
          color: 'var(--text-lo)',
          fontSize: '11px',
          minWidth: '38px',
          textAlign: 'center',
          letterSpacing: '0.5px',
          userSelect: 'none'
        }}>
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* (Minimapa retirado: con el encuadre automático en la copa ya no hace falta.) */}

      {renderViewChrome(false)}

      {/* EXIT FOCUS BUTTON · appears only while focus mode is active */}
      {focusedMemberId && (
        <button
          onClick={(e) => { e.stopPropagation(); setFocusedMemberId(null) }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Salir del enfoque (Esc)"
          style={{
            position: 'absolute',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 18px',
            borderRadius: '999px',
            border: '1px solid var(--panel-border)',
            backgroundColor: 'var(--panel-bg)',
            color: 'var(--accent-gold)',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: 'var(--panel-shadow)',
            zIndex: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>✕</span>
          Salir del enfoque
          <span style={{ opacity: 0.7, fontSize: '10px', border: '1px solid var(--panel-border)', padding: '1px 5px', borderRadius: '4px' }}>Esc</span>
        </button>
      )}

      {/* ADD MEMBER MODAL LAYER */}
      {addingToMember && (
        <AddMemberModal
          targetMember={addingToMember}
          relationships={allRelationships}
          allMembers={allMembers}
          onClose={() => {
            setAddingToMember(null)
            setHoveredMemberId(null)
          }}
          onSave={onRefresh}
        />
      )}
    </div>
  )
}
