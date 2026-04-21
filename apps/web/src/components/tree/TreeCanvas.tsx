'use client'

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import AppleNode from './AppleNode'
import type { Member, Relationship } from '@/lib/types'
import { MousePointer2 } from 'lucide-react'
import { computeTreeLayout } from '@/lib/treeLayout'
import HoverMenu from './HoverMenu'

interface TreeCanvasProps {
  members: Member[]
  relationships: Relationship[]
}

export default function TreeCanvas({ members, relationships }: TreeCanvasProps) {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)
  
  const [offset, setOffset] = useState({ x: 0, y: -200 }) 
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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - lastMousePos.x
    const deltaY = e.clientY - lastMousePos.y
    setOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }, [isDragging, lastMousePos])

  const handleMouseUp = () => setIsDragging(false)

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove])

  const handleWheel = (e: React.WheelEvent) => {
    setOffset(prev => ({ ...prev, y: prev.y - e.deltaY * 0.5 }))
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#1B2E1B', 
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
    >
      {/* 1. BACKGROUND IMAGE LAYER - 30% Opacity & Full Cover */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url("/assets/arbol-base.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        opacity: 0.3,
        zIndex: 1,
        pointerEvents: 'none',
        transform: 'translateY(100px) scale(1.1)' 
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

          const x1 = midX + offset.x
          const y1 = midY + offset.y + 80 
          const x2 = (child.canvasX ?? 0) + offset.x
          const y2 = (child.canvasY ?? 0) + offset.y + 80 

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
        {relationships.map((rel) => {
          const m1 = positionedMembers.find(m => m.id === rel.member1Id)
          const m2 = positionedMembers.find(m => m.id === rel.member2Id)
          if (!m1 || !m2 || rel.relationship !== 'spouse') return null
          
          const x1 = (m1.canvasX ?? 0) + offset.x
          const y1 = (m1.canvasY ?? 0) + offset.y + 80
          const x2 = (m2.canvasX ?? 0) + offset.x
          const y2 = (m2.canvasY ?? 0) + offset.y + 80
          
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
        })}
      </svg>

      {/* Nodes Layer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
        {positionedMembers.map((member) => (
          <div
            key={member.id}
            className="apple-node-clickable"
            style={{
              position: 'absolute',
              left: (member.canvasX ?? 0) + offset.x - 100, 
              top: (member.canvasY ?? 0) + offset.y,
              zIndex: hoveredMemberId === member.id ? 2000 : 50,
              pointerEvents: 'auto'
            }}
          >
            <AppleNode
              member={member}
              isHovered={hoveredMemberId === member.id}
              onHover={() => setHoveredMemberId(member.id)}
              onLeave={() => setHoveredMemberId(null)}
            />

            {/* INTERACTIVE HOVER MENU */}
            {hoveredMemberId === member.id && (
              <HoverMenu 
                member={member} 
                onClose={() => setHoveredMemberId(null)} 
              />
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
