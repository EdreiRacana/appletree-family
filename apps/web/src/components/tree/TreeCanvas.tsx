'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import AppleNode from './AppleNode'
import type { Member, Relationship } from '@/lib/types'
import { computeTreeLayout, NODE_SIZE } from '@/lib/treeLayout'
import { supabase } from '@/lib/supabase'
import HoverMenu from './HoverMenu'
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
  // When the side profile drawer is mounted (~450px on the right) the minimap
  // slides left so the drawer never covers it.
  profilePanelOpen?: boolean
}

export default function TreeCanvas({ members, relationships, onRefresh, onViewProfile, onEditMember, onAddStory, bgOpacity, profilePanelOpen = false }: TreeCanvasProps) {
  const isMobile = useIsMobile()
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)
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

  // ── FIT TO VIEW: scale + center so the WHOLE tree is visible ──
  const fitToView = useCallback(() => {
    if (!treeBounds || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const PAD = 70
    const treeW = treeBounds.maxX - treeBounds.minX
    const treeH = treeBounds.maxY - treeBounds.minY
    const fitScale = Math.min(
      (rect.width - PAD * 2) / treeW,
      (rect.height - PAD * 2) / treeH,
      1 // never zoom IN beyond 100% automatically
    )
    const newScale = Math.max(fitScale, MIN_SCALE)
    setScale(newScale)
    setOffset({
      x: (rect.width - treeW * newScale) / 2 - treeBounds.minX * newScale,
      y: (rect.height - treeH * newScale) / 2 - treeBounds.minY * newScale
    })
  }, [treeBounds])

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
    zoomAt(rect.width / 2, rect.height / 2, factor)
  }

  // ── FOCUS EFFECT: animate camera so the focused member lands centered ──
  useEffect(() => {
    if (!focusedMemberId || !containerRef.current) return
    const focused = positionedMembers.find(m => m.id === focusedMemberId)
    if (!focused) return
    const rect = containerRef.current.getBoundingClientRect()
    const targetScale = Math.max(scaleRef.current, 0.9)
    const nodeCenterX = focused.canvasX ?? 0
    const nodeCenterY = (focused.canvasY ?? 0) + NODE_SIZE / 2
    setAnimatingTransform(true)
    setScale(targetScale)
    setOffset({
      x: rect.width / 2 - nodeCenterX * targetScale,
      y: rect.height / 2 - nodeCenterY * targetScale
    })
    const t = setTimeout(() => setAnimatingTransform(false), 600)
    return () => clearTimeout(t)
  }, [focusedMemberId, positionedMembers])

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
    setAnimatingTransform(true)
    setOffset({
      x: containerRect.width / 2 - treeX * scaleRef.current,
      y: containerRect.height / 2 - treeY * scaleRef.current
    })
    setTimeout(() => setAnimatingTransform(false), 600)
  }, [treeBounds, miniMapInfo, containerRect])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.apple-node-clickable')) return
    setIsDragging(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
  }

  useEffect(() => {
    const handleOpenModal = (e: any) => {
      if (e.detail) setAddingToMember(e.detail)
    }
    window.addEventListener('open-add-modal', handleOpenModal)
    return () => window.removeEventListener('open-add-modal', handleOpenModal)
  }, [])

  // INITIAL VIEW: classic 100% centered framing (fit-to-view stays
  // available on the ⊡ button for when the user wants the full overview)
  const didInitialFit = useRef(false)
  useEffect(() => {
    if (positionedMembers.length > 0 && containerRef.current && !didInitialFit.current) {
      didInitialFit.current = true
      const minX = Math.min(...positionedMembers.map(m => m.canvasX ?? 0))
      const maxX = Math.max(...positionedMembers.map(m => m.canvasX ?? 0))
      const treeCenterX = (minX + maxX) / 2

      const root = positionedMembers.find(m => m.generation === 0) || positionedMembers[0]
      const rect = containerRef.current.getBoundingClientRect()

      setScale(1)
      setOffset({
        x: (rect.width / 2) - treeCenterX,
        y: (rect.height / 2) - root.canvasY + (positionedMembers.length === 1 ? 0 : 200)
      })
    }
  }, [positionedMembers])

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
      onTouchStart={handleTouchStart}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#1B2E1B', 
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        overscrollBehavior: 'none'
      }}
    >
      {/* 1. BACKGROUND IMAGE LAYER */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url("/assets/arbol-base.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        opacity: bgOpacity,
        zIndex: 1,
        pointerEvents: 'none',
        transform: 'translateY(120px) scale(1.5)' 
      }} />

      {/* Shadow Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,46,26,0.2)', pointerEvents: 'none', zIndex: 5 }} />

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

            // The visual fallback for single parents has been removed per user request.
            // If a child is only linked to one parent, the line will stem directly from that parent,
            // reflecting that it is a child from a different relationship.

            const midX = parents.reduce((sum, p) => sum + (p.canvasX ?? 0), 0) / parents.length
            const midY = parents.reduce((sum, p) => sum + (p.canvasY ?? 0), 0) / parents.length

            // SEGURIDAD: Solo dibujar si el hijo es de una generación superior (Y menor en canvas)
            if (child.canvasY >= midY) return null

            const x1 = midX
            const y1 = midY + NODE_SIZE / 2 // Exactamente desde la línea de la pareja
            const x2 = (child.canvasX ?? 0)
            const y2 = (child.canvasY ?? 0) + NODE_SIZE // Hasta la base del hijo

            const lineIsKin = kinIds
              ? kinIds.has(child.id) && parents.some(p => kinIds.has(p.id))
              : true
            const lineOpacity = kinIds ? (lineIsKin ? 0.9 : 0.12) : 0.5
            return (
              <path
                key={`path-trunk-${child.id}`}
                d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                fill="none"
                stroke="#D4AF37"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={lineOpacity}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)' }}
              />
            )
          })}

          {/* Spouse Lines (Direct) */}
          {positionedMembers.map((m1) => {
            return relationships
              .filter(rel => rel.relationship === 'spouse' && (rel.member1Id === m1.id || rel.member2Id === m1.id))
              .map(rel => {
                const otherId = rel.member1Id === m1.id ? rel.member2Id : rel.member1Id
                const m2 = positionedMembers.find(m => m.id === otherId)
                if (!m2 || m1.id > m2.id) return null // Draw once per pair
                if (hiddenIds.has(m1.id) || hiddenIds.has(m2.id)) return null
                
                const x1 = m1.canvasX
                const y1 = m1.canvasY + NODE_SIZE / 2 // Center of node
                const x2 = m2.canvasX
                const y2 = m2.canvasY + NODE_SIZE / 2 // Center of node
                
                const spouseLineOpacity = kinIds
                  ? (kinIds.has(m1.id) && kinIds.has(m2.id) ? 0.85 : 0.12)
                  : 0.6
                return (
                  <line
                    key={`spouse-line-${rel.id}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#D4AF37"
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
          {positionedMembers.map((member) => {
            if (hiddenIds.has(member.id)) return null
            const isKin = !kinIds || kinIds.has(member.id)
            const isFocused = focusedMemberId === member.id
            const isCollapsed = collapsedIds.has(member.id)
            const collapsedCount = descendantCounts.get(member.id) ?? 0
            const memberHasDescendants = hasDescendantsMap.get(member.id) ?? false
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
                left: member.canvasX - NODE_SIZE / 2,
                top: member.canvasY,
                zIndex: isFocused ? 3000 : hoveredMemberId === member.id ? 2000 : 50,
                pointerEvents: 'auto',
                padding: '20px',
                margin: '-20px',
                opacity: isKin ? 1 : 0.28,
                transform: isKin ? 'scale(1)' : 'scale(0.92)',
                transformOrigin: 'center center',
                transition: 'opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)',
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

            {/* INTERACTIVE HOVER MENU */}
            {hoveredMemberId === member.id && (
              <HoverMenu
                member={member}
                onClose={() => setHoveredMemberId(null)}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                  setHoveredMemberId(member.id)
                }}
                onEdit={(m) => {
                  onEditMember(m)
                  setHoveredMemberId(null)
                }}
                onAdd={(m) => {
                  setAddingToMember(m)
                  setHoveredMemberId(null)
                }}
                onDelete={(m) => handleDeleteMember(m)}
                onViewProfile={(m) => {
                  onViewProfile(m)
                  setHoveredMemberId(null)
                }}
                onAddStory={(m) => {
                  onAddStory(m)
                  setHoveredMemberId(null)
                }}
                hasDescendants={memberHasDescendants}
                isCollapsed={isCollapsed}
                onToggleCollapse={(m) => {
                  toggleCollapsed(m.id)
                  setHoveredMemberId(null)
                }}
              />
            )}

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
                  border: '1px solid rgba(212, 175, 55, 0.7)',
                  backgroundColor: 'rgba(20, 35, 20, 0.9)',
                  color: '#D4AF37',
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
        backgroundColor: 'rgba(20, 35, 20, 0.85)',
        border: '1px solid rgba(212, 175, 55, 0.35)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
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
              color: '#D4AF37',
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
          color: 'rgba(212,175,55,0.7)',
          fontSize: '11px',
          minWidth: '38px',
          textAlign: 'center',
          letterSpacing: '0.5px',
          userSelect: 'none'
        }}>
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* MINI-MAP · overview of the whole tree with a viewport indicator.
         Slides left when the profile drawer is open so it stays visible. */}
      {treeBounds && miniMapInfo && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: profilePanelOpen ? '474px' : '24px',
            width: `${MINIMAP_W}px`,
            height: `${MINIMAP_H}px`,
            backgroundColor: 'rgba(20, 35, 20, 0.85)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            borderRadius: '10px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            zIndex: 500,
            transition: 'right 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
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
                      : isKin ? '#D4AF37'
                      : 'rgba(212, 175, 55, 0.35)'
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
                  fill="rgba(212, 175, 55, 0.10)"
                  stroke="#D4AF37"
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
            border: '1px solid rgba(212, 175, 55, 0.35)',
            backgroundColor: 'rgba(20, 35, 20, 0.85)',
            color: '#D4AF37',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            zIndex: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>✕</span>
          Salir del enfoque
          <span style={{ opacity: 0.55, fontSize: '10px', border: '1px solid rgba(212,175,55,0.4)', padding: '1px 5px', borderRadius: '4px' }}>Esc</span>
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
