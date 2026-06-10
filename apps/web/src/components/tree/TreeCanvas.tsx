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
}

export default function TreeCanvas({ members, relationships, onRefresh, onViewProfile, onEditMember, onAddStory, bgOpacity }: TreeCanvasProps) {
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

  // Zoom limits
  const MIN_SCALE = 0.25
  const MAX_SCALE = 2

  // Refs mirror state so native (non-React) listeners always read fresh values
  const offsetRef = useRef(offset)
  const scaleRef = useRef(scale)
  useEffect(() => { offsetRef.current = offset }, [offset])
  useEffect(() => { scaleRef.current = scale }, [scale])

  const positionedMembers = useMemo(() => {
    return computeTreeLayout(members, relationships)
  }, [members, relationships])

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.apple-node-clickable')) return
    setIsDragging(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
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

  const handleMouseUp = () => setIsDragging(false)

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
        pointerEvents: 'none', // Let dragging work on the container behind it
        zIndex: 50 // Creates stacking context ABOVE the background
      }}>
        {/* SVG CONNECTIONS */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 10 }}>
          {positionedMembers.map((child) => {
            const parentIds = child.parents || []
            if (parentIds.length === 0) return null

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

            return (
              <path
                key={`path-trunk-${child.id}`}
                d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                fill="none"
                stroke="#D4AF37"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.5}
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
                
                const x1 = m1.canvasX
                const y1 = m1.canvasY + NODE_SIZE / 2 // Center of node
                const x2 = m2.canvasX
                const y2 = m2.canvasY + NODE_SIZE / 2 // Center of node
                
                return (
                  <line
                    key={`spouse-line-${rel.id}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#D4AF37"
                    strokeWidth={1.5}
                    strokeDasharray="4, 4"
                    strokeLinecap="round"
                    opacity={0.6}
                  />
                )
              })
          })}
        </svg>

        {/* Nodes Layer */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none' }}>
          {positionedMembers.map((member) => (
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
              style={{
                position: 'absolute',
                left: member.canvasX - NODE_SIZE / 2, 
                top: member.canvasY,
                zIndex: hoveredMemberId === member.id ? 2000 : 50,
                pointerEvents: 'auto',
                padding: '20px',
                margin: '-20px'
              }}
            >
            <AppleNode
              member={member}
              size={NODE_SIZE}
              isHovered={hoveredMemberId === member.id}
              onHover={() => {}}
              onLeave={() => {}}
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
              />
            )}
          </div>
        ))}
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
