'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import AppleNode from './AppleNode'
import type { Member, Relationship } from '@/lib/types'
import { computeTreeLayout } from '@/lib/treeLayout'
import { supabase } from '@/lib/supabase'
import HoverMenu from './HoverMenu'
import EditMemberModal from './EditMemberModal'
import AddMemberModal from './AddMemberModal'

interface TreeCanvasProps {
  members: Member[]
  relationships: Relationship[]
  onRefresh: () => void
  bgOpacity: number
}

export default function TreeCanvas({ members, relationships, onRefresh, bgOpacity }: TreeCanvasProps) {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [addingToMember, setAddingToMember] = useState<Member | null>(null)
  
  // Starting at 0,0 since we calibrated BASE_Y in the layout engine
  const [offset, setOffset] = useState({ x: 0, y: 0 }) 
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const positionedMembers = useMemo(() => {
    return computeTreeLayout(members, relationships)
  }, [members, relationships])

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

  const handleWheel = (e: React.WheelEvent) => {
    setOffset(prev => ({ ...prev, y: prev.y - e.deltaY * 0.5 }))
  }

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

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#1B2E1B', 
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none'
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

      {/* SVG CONNECTIONS */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
        {positionedMembers.map((child) => {
          const parentIds = child.parents || []
          if (parentIds.length === 0) return null

          const parents = positionedMembers.filter(p => parentIds.includes(p.id))
          if (parents.length === 0) return null

          const midX = parents.reduce((sum, p) => sum + (p.canvasX ?? 0), 0) / parents.length
          const midY = parents.reduce((sum, p) => sum + (p.canvasY ?? 0), 0) / parents.length

          // SEGURIDAD: Solo dibujar si el hijo es de una generación superior (Y menor en canvas)
          if (child.canvasY >= midY) return null

          const x1 = midX + offset.x
          const y1 = midY + offset.y + 100 // Exactamente desde la línea de la pareja
          const x2 = (child.canvasX ?? 0) + offset.x
          const y2 = (child.canvasY ?? 0) + offset.y + 200 // Hasta la base del hijo

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
              
              const x1 = m1.canvasX + offset.x
              const y1 = m1.canvasY + offset.y + 100 // Center of node
              const x2 = m2.canvasX + offset.x
              const y2 = m2.canvasY + offset.y + 100 // Center of node
              
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
      <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
        {positionedMembers.map((member) => (
          <div
            key={member.id}
            className="apple-node-clickable"
            onMouseEnter={() => setHoveredMemberId(member.id)}
            onMouseLeave={() => setHoveredMemberId(null)}
            style={{
              position: 'absolute',
              left: member.canvasX + offset.x - 100, 
              top: member.canvasY + offset.y,
              zIndex: hoveredMemberId === member.id ? 2000 : 50,
              pointerEvents: 'auto',
              padding: '20px',
              margin: '-20px'
            }}
          >
            <AppleNode
              member={member}
              isHovered={hoveredMemberId === member.id}
              onHover={() => {}}
              onLeave={() => {}}
            />

            {/* INTERACTIVE HOVER MENU */}
            {hoveredMemberId === member.id && (
              <HoverMenu 
                member={member} 
                onClose={() => setHoveredMemberId(null)} 
                onEdit={(m) => setEditingMember(m)}
                onAdd={(m) => setAddingToMember(m)}
                onDelete={(m) => handleDeleteMember(m)}
              />
            )}
          </div>
        ))}
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

      {/* EDITING MODAL LAYER */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => {
            setEditingMember(null)
            setHoveredMemberId(null)
          }}
          onSave={onRefresh}
        />
      )}

    </div>
  )
}
