'use client'

import { useState, useCallback } from 'react'
import AppleNode from './AppleNode'
import HoverMenu from './HoverMenu'
import type { Member, Relationship } from '@/lib/types'
import { ChevronUp, ChevronDown, SlidersHorizontal, Grid2x2 } from 'lucide-react'

interface TreeCanvasProps {
  members: Member[]
  relationships: Relationship[]
}

export default function TreeCanvas({ members, relationships }: TreeCanvasProps) {
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)
  const [scrollY, setScrollY] = useState(0)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    setScrollY(prev => Math.max(-400, Math.min(400, prev - e.deltaY * 0.5)))
  }, [])

  const hoveredMember = members.find(m => m.id === hoveredMemberId) ?? null

  // Group members by generation for layout
  const byGen: Record<number, Member[]> = {}
  members.forEach(m => {
    const g = m.generation ?? 0
    if (!byGen[g]) byGen[g] = []
    byGen[g].push(m)
  })
  const generations = Object.keys(byGen).map(Number).sort((a, b) => b - a) // newest first

  return (
    <div
      className="tree-canvas-area"
      style={{ position: 'relative', overflow: 'hidden', cursor: 'grab' }}
      onWheel={handleWheel}
    >
      {/* Top label */}
      <div className="tree-label top">↑ New Horizons</div>

      {/* Controls */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, zIndex: 50 }}>
        <button className="canvas-arrow" style={{ position: 'static', transform: 'none', width: 32, height: 32 }}>
          <SlidersHorizontal size={14} />
        </button>
        <button className="canvas-arrow" style={{ position: 'static', transform: 'none', width: 32, height: 32 }}>
          <Grid2x2 size={14} />
        </button>
      </div>

      {/* Scroll arrows */}
      <button className="canvas-arrow top" onClick={() => setScrollY(s => s + 80)}>
        <ChevronUp size={18} />
      </button>
      <button className="canvas-arrow bottom" onClick={() => setScrollY(s => s - 80)}>
        <ChevronDown size={18} />
      </button>

      {/* Tree SVG connections */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
      >
        {relationships.map((rel) => {
          const m1 = members.find(m => m.id === rel.member1Id)
          const m2 = members.find(m => m.id === rel.member2Id)
          if (!m1 || !m2 || !m1.canvasX || !m2.canvasX) return null
          const x1 = m1.canvasX
          const y1 = (m1.canvasY ?? 0) + scrollY + 40
          const x2 = m2.canvasX
          const y2 = (m2.canvasY ?? 0) + scrollY + 40
          const midY = (y1 + y2) / 2
          return (
            <path
              key={rel.id}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              className="tree-connector"
            />
          )
        })}
      </svg>

      {/* Apple Nodes */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        {members.map((member) => (
          <div
            key={member.id}
            style={{
              position: 'absolute',
              left: (member.canvasX ?? 0) - 40,
              top: (member.canvasY ?? 0) + scrollY,
              zIndex: hoveredMemberId === member.id ? 100 : 2,
            }}
          >
            <AppleNode
              member={member}
              isHovered={hoveredMemberId === member.id}
              onHover={() => setHoveredMemberId(member.id)}
              onLeave={() => setHoveredMemberId(null)}
            />
            {hoveredMemberId === member.id && (
              <HoverMenu member={member} onClose={() => setHoveredMemberId(null)} />
            )}
          </div>
        ))}
      </div>

      {/* Bottom label */}
      <div className="tree-label bottom">Ancient Roots ↓</div>
    </div>
  )
}
