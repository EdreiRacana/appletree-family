'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import AppleNode from './AppleNode'
import type { Member, Relationship } from '@/lib/types'
import { computeHoneycombLayout, NODE_SIZE } from '@/lib/treeLayout'
import { supabase } from '@/lib/supabase'
import HoverMenu from './HoverMenu'
import HoverPeek from './HoverPeek'
import EditMemberModal from './EditMemberModal'
import AddMemberModal from './AddMemberModal'
import MobileTreeView from './MobileTreeView'

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
  bgOpacity: number
  // When the profile drawer (~450px on the right) is mounted, the minimap
  // and fit-to-view math treat that band as reserved so the tree stays
  // visually centered in the remaining space.
  profilePanelOpen?: boolean
}

// Chrome insets — the fixed UI edges the canvas must avoid.
// Sidebar occupies left:28px + 76px width = 104px, +12px breathing room.
const SIDEBAR_INSET = 116
const DRAWER_WIDTH = 450

export default function TreeCanvas({ members, relationships, onRefresh, onViewProfile, onEditMember, onAddStory, bgOpacity, profilePanelOpen = false }: TreeCanvasProps) {
  const isMobile = useIsMobile()
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)
  // Two-stage hover: hover shows the compact HoverPeek pill; clicking its
  // "…" opens the full HoverMenu identified here.
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null)
  const [addingToMember, setAddingToMember] = useState<Member | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Starting at 0,0 since we calibrated BASE_Y in the layout engine
  const [offset, setOffset] = useState({ x: 0, y: 0 }) 
  const [scale, setScale] = useState(1)
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
    return computeHoneycombLayout(members, relationships)
  }, [members, relationships])

  // ── RADIAL SPHERE LENS ────────────────────────────────────────
  // Cada manzana se remapea con una distorsión barrel radial centrada en
  // el viewport: r' = r * (1 - K*(r/R)²). Es lo que da la ilusión de
  // esfera 3D — las filas rectas se curvan como si estuvieran sobre una
  // bola. Como calculo AQUÍ las posiciones lenseadas, las líneas SVG
  // (que se dibujan entre estas posiciones) siguen la curva automática-
  // mente, sin quedar despegadas de las manzanas.
  const spherizedMembers = useMemo(() => {
    if (!containerRect) {
      return positionedMembers.map(m => ({
        ...m,
        lensedX: m.canvasX,
        lensedY: m.canvasY,
        lensScale: 1,
      }))
    }
    const cx = containerRect.width / 2
    const cy = containerRect.height / 2
    const R = Math.min(containerRect.width, containerRect.height) * 0.6
    const PULL = 0.35     // fuerza del barrel (0 = plano, 0.5 = fisheye extremo)
    const S_CENTER = 1.28 // manzana central: +28%
    const S_EDGE = 0.62   // manzana en el borde: -38%
    return positionedMembers.map(m => {
      const sx = (m.canvasX ?? 0) * scale + offset.x
      const sy = ((m.canvasY ?? 0) + NODE_SIZE / 2) * scale + offset.y
      const dx = sx - cx
      const dy = sy - cy
      const d = Math.hypot(dx, dy)
      const t = Math.min(d / R, 1)          // 0 centro, 1 borde
      const compress = 1 - PULL * t * t     // barrel radial
      const newSx = cx + dx * compress
      const newSy = cy + dy * compress
      const lensedX = (newSx - offset.x) / scale
      const lensedY = (newSy - offset.y) / scale - NODE_SIZE / 2
      const closeness = 1 - t * t * (3 - 2 * t) // smoothstep
      const lensScale = S_EDGE + (S_CENTER - S_EDGE) * closeness
      return { ...m, lensedX, lensedY, lensScale }
    })
  }, [positionedMembers, containerRect, scale, offset.x, offset.y])

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
    const PAD = 40
    const leftInset = SIDEBAR_INSET
    const rightInset = profilePanelOpen ? DRAWER_WIDTH + 24 : 24
    const usableW = Math.max(rect.width - leftInset - rightInset, 200)
    const usableH = Math.max(rect.height - PAD * 2, 200)
    const treeW = treeBounds.maxX - treeBounds.minX
    const treeH = treeBounds.maxY - treeBounds.minY
    // ZOOM_BOOST: fit-to-view natural mostraría el árbol completo con aire
    // extra; multiplicamos por 1.2 para que las manzanas se vean más
    // grandes al arrancar. El sphere global se encarga de que las orillas
    // encogidas visualmente sigan cabiendo.
    const ZOOM_BOOST = 1.2
    const fitScale = Math.min(usableW / treeW, usableH / treeH, 1) * ZOOM_BOOST
    const newScale = Math.max(Math.min(fitScale, MAX_SCALE), MIN_SCALE)
    // Center on the usable band [leftInset, rect.width - rightInset]
    const usableCenterX = leftInset + usableW / 2
    const usableCenterY = rect.height / 2
    const treeCenterX = (treeBounds.minX + treeBounds.maxX) / 2
    const treeCenterY = (treeBounds.minY + treeBounds.maxY) / 2
    setScale(newScale)
    setOffset({
      x: usableCenterX - treeCenterX * newScale,
      y: usableCenterY - treeCenterY * newScale
    })
  }, [treeBounds, profilePanelOpen])

  // ── ZOOM AROUND A SCREEN POINT (cursor or viewport center) ──
  const zoomAt = useCallback((screenX: number, screenY: number, factor: number) => {
    const oldScale = scaleRef.current
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor))
    if (newScale === oldScale) return
    const ratio = newScale / oldScale
    const o = offsetRef.current
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
    window.addEventListener('open-add-modal', handleOpenModal)
    return () => window.removeEventListener('open-add-modal', handleOpenModal)
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
    // Solo re-fit si crecio o encogio significativamente (evita jitter)
    if (Math.abs(count - lastFittedCount.current) >= 1) {
      lastFittedCount.current = count
      requestAnimationFrame(() => fitToView())
    }
  }, [positionedMembers.length, containerRect?.width, containerRect?.height, fitToView])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - lastMousePos.x
    const deltaY = e.clientY - lastMousePos.y
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

  // ── MOBILE: delegate to dedicated mobile view ─────────────────
  if (isMobile) {
    return (
      <>
        <MobileTreeView
          members={members}
          relationships={relationships}
          onMemberTap={onViewProfile}
          onDeleteMember={async (member) => { await handleDeleteMember(member) }}
        />
        {addingToMember && (
          <AddMemberModal
            targetMember={addingToMember}
            relationships={relationships}
            onClose={() => { setAddingToMember(null) }}
            onSave={onRefresh}
          />
        )}
      </>
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

            // Honeycomb: posiciones NO son jerárquicas verticalmente.
            // Se dibuja un bezier suave del centro del padre-promedio al
            // centro del hijo. Las coords lenseadas hacen que la línea
            // siga la deformación de la esfera.
            const childLensed = lensedById.get(child.id)
            const childX = (childLensed ? childLensed.lensedX : (child.canvasX ?? 0)) + NODE_SIZE / 2
            const childY = (childLensed ? childLensed.lensedY : (child.canvasY ?? 0)) + NODE_SIZE / 2
            const midX = parents.reduce((sum, p) => sum + (lensedById.get(p.id)?.lensedX ?? p.canvasX ?? 0), 0) / parents.length + NODE_SIZE / 2
            const midY = parents.reduce((sum, p) => sum + (lensedById.get(p.id)?.lensedY ?? p.canvasY ?? 0), 0) / parents.length + NODE_SIZE / 2

            const x1 = midX
            const y1 = midY
            const x2 = childX
            const y2 = childY

            const lineIsKin = kinIds
              ? kinIds.has(child.id) && parents.some(p => kinIds.has(p.id))
              : true
            const lineOpacity = kinIds ? (lineIsKin ? 0.9 : 0.12) : 0.5
            // Bezier suave con curvatura perpendicular al vector padre→hijo
            // (dibuja un arco corto en vez de una S vertical fea)
            const dx = x2 - x1
            const dy = y2 - y1
            const midCX = (x1 + x2) / 2 + dy * 0.15
            const midCY = (y1 + y2) / 2 - dx * 0.15
            return (
              <path
                key={`path-trunk-${child.id}`}
                d={`M ${x1} ${y1} Q ${midCX} ${midCY} ${x2} ${y2}`}
                fill="none"
                stroke="var(--tree-line)"
                strokeWidth={1.5}
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
                
                const spouseLineOpacity = kinIds
                  ? (kinIds.has(m1.id) && kinIds.has(m2.id) ? 0.85 : 0.12)
                  : 0.6
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
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredMemberId(null)
                }, 400)
              }}
              onClick={(e) => {
                e.stopPropagation()
                setFocusedMemberId(prev => prev === member.id ? null : member.id)
              }}
              style={{
                position: 'absolute',
                left: member.lensedX - NODE_SIZE / 2,
                top: member.lensedY,
                zIndex: isFocused ? 3000 : hoveredMemberId === member.id ? 2000 : (fisheyeScale > 1.1 ? 70 : 50),
                pointerEvents: 'auto',
                padding: '20px',
                margin: '-20px',
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
            />

            {/* HOVER STAGE 1: pill compacto — nombre + contacto + expandir.
                Se renderiza con position:fixed en HoverPeek, escapa del
                pan/zoom transform y del stacking context — z:10000 lo pone
                sobre el topbar (z:2000). Auto-flip abajo si la manzana
                está en el top del viewport. */}
            {(() => {
              if (hoveredMemberId !== member.id || expandedMenuId === member.id) return null
              // Screen coords del centro de la manzana (respetando el
              // desplazamiento sphere y el scale compuesto).
              const appleScreenX = (member.lensedX ?? 0) * scale + offset.x
              const appleScreenY = (member.lensedY ?? 0) * scale + offset.y
              const appleH = NODE_SIZE * scale * composedScale
              const TOPBAR_H = 76
              const FLIP_MARGIN = 60
              const flipBelow = appleScreenY < TOPBAR_H + FLIP_MARGIN
              const peekY = flipBelow
                ? appleScreenY + appleH + 14
                : appleScreenY - 14
              const peekX = appleScreenX + (NODE_SIZE / 2) * scale
              return (
                <HoverPeek
                  member={member}
                  screenX={peekX}
                  screenY={peekY}
                  flipBelow={flipBelow}
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                    setHoveredMemberId(member.id)
                  }}
                  onMouseLeave={() => {
                    hoverTimeoutRef.current = setTimeout(() => {
                      setHoveredMemberId(null)
                    }, 300)
                  }}
                onQuickContact={() => {
                  // Abre el perfil (drawer) — desde ahí hay Chatear, Enviar
                  // saludo, Invitar. Es el flujo unificado de "contactar".
                  onViewProfile(member)
                  setHoveredMemberId(null)
                }}
                onExpand={() => setExpandedMenuId(member.id)}
              />
              )
            })()}

            {/* HOVER STAGE 2: menú completo — se posiciona con fixedStyle
                (position:fixed en screen coords) para escapar del pan/zoom
                container y del stacking context. Auto-flip abajo cuando la
                manzana está en la parte alta del viewport. */}
            {expandedMenuId === member.id && (() => {
              const appleScreenX = (member.lensedX ?? 0) * scale + offset.x
              const appleScreenY = (member.lensedY ?? 0) * scale + offset.y
              const appleH = NODE_SIZE * scale * composedScale
              const MENU_H_ESTIMATE = 300
              const TOPBAR_H = 76
              const flipBelow = appleScreenY - MENU_H_ESTIMATE < TOPBAR_H + 12
              const centerX = appleScreenX + (NODE_SIZE / 2) * scale
              const fixedStyle: React.CSSProperties = flipBelow
                ? {
                    position: 'fixed',
                    top: `${appleScreenY + appleH + 12}px`,
                    left: `${centerX}px`,
                    transform: 'translateX(-50%)',
                    zIndex: 10001,
                  }
                : {
                    position: 'fixed',
                    top: `${appleScreenY - 12}px`,
                    left: `${centerX}px`,
                    transform: 'translate(-50%, -100%)',
                    zIndex: 10001,
                  }
              return (
                <HoverMenu
                  member={member}
                  fixedStyle={fixedStyle}
                  onClose={() => { setExpandedMenuId(null); setHoveredMemberId(null) }}
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                  }}
                  onEdit={(m) => { onEditMember(m); setExpandedMenuId(null); setHoveredMemberId(null) }}
                  onAdd={(m) => { setAddingToMember(m); setExpandedMenuId(null); setHoveredMemberId(null) }}
                  onDelete={(m) => handleDeleteMember(m)}
                  onViewProfile={(m) => { onViewProfile(m); setExpandedMenuId(null); setHoveredMemberId(null) }}
                  onAddStory={(m) => { onAddStory(m); setExpandedMenuId(null); setHoveredMemberId(null) }}
                  hasDescendants={memberHasDescendants}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={(m) => { toggleCollapsed(m.id); setExpandedMenuId(null); setHoveredMemberId(null) }}
                />
              )
            })()}

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

      {/* MINI-MAP · bottom-LEFT past the sidebar (donde el owner lo señaló).
         Zona 100% segura: sidebar a la izquierda + zoom pill al centro +
         drawer/Stories a la derecha, nada lo cubre. Tamaño más compacto
         y muy translúcido para que sea guía, no obstáculo visual. */}
      {treeBounds && miniMapInfo && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '120px',
            width: `${MINIMAP_W}px`,
            height: `${MINIMAP_H}px`,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--panel-border)',
            borderRadius: '12px',
            backdropFilter: 'blur(14px) saturate(140%)',
            WebkitBackdropFilter: 'blur(14px) saturate(140%)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            zIndex: 500,
            opacity: 0.72,
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.72' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg
            width={MINIMAP_W}
            height={MINIMAP_H}
            onClick={handleMinimapClick}
            style={{ cursor: 'crosshair', display: 'block' }}
          >
            {positionedMembers.map(m => {
              if (hiddenIds.has(m.id)) return null
              const isKin = !kinIds || kinIds.has(m.id)
              const isFocused = focusedMemberId === m.id
              const dx = ((m.canvasX ?? 0) - treeBounds.minX) * miniMapInfo.s + miniMapInfo.offsetX
              const dy = ((m.canvasY ?? 0) - treeBounds.minY) * miniMapInfo.s + miniMapInfo.offsetY
              return (
                <circle
                  key={m.id}
                  cx={dx}
                  cy={dy}
                  r={isFocused ? 3.2 : isKin ? 2 : 1.4}
                  fill={
                    isFocused ? '#FFD873'
                      : isKin ? 'var(--accent-gold)'
                      : 'var(--accent-gold-soft)'
                  }
                />
              )
            })}
            {containerRect && (() => {
              const treeLeft = (0 - offset.x) / scale
              const treeTop = (0 - offset.y) / scale
              const treeRight = (containerRect.width - offset.x) / scale
              const treeBottom = (containerRect.height - offset.y) / scale
              return (
                <rect
                  x={(treeLeft - treeBounds.minX) * miniMapInfo.s + miniMapInfo.offsetX}
                  y={(treeTop - treeBounds.minY) * miniMapInfo.s + miniMapInfo.offsetY}
                  width={(treeRight - treeLeft) * miniMapInfo.s}
                  height={(treeBottom - treeTop) * miniMapInfo.s}
                  fill="var(--accent-gold-soft)"
                  stroke="var(--accent-gold)"
                  strokeWidth={1.2}
                  pointerEvents="none"
                />
              )
            })()}
          </svg>
        </div>
      )}

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
          relationships={relationships}
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
