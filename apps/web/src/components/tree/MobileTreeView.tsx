'use client'

import React, { useState, useMemo, useEffect } from 'react'
import type { Member, Relationship } from '@/lib/types'
import AppleNode from './AppleNode'

interface MobileTreeViewProps {
  members: Member[]
  relationships: Relationship[]
  onMemberTap: (member: Member) => void
  onDeleteMember: (member: Member) => void
}

export default function MobileTreeView({
  members,
  relationships,
  onMemberTap,
}: MobileTreeViewProps) {
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  // Foco inicial: buscar alguien de la generación 0 o al primer integrante
  const initialFocusId = useMemo(() => {
    if (members.length === 0) return ''
    const gen0 = members.find(m => (m.generation ?? 0) === 0)
    if (gen0) return gen0.id
    return members[0].id
  }, [members])

  const [focusMemberId, setFocusMemberId] = useState<string>(initialFocusId)

  // Sincronización de seguridad
  useEffect(() => {
    if (members.length === 0) return
    if (!byId.has(focusMemberId)) {
      setFocusMemberId(initialFocusId)
    }
  }, [members, byId, focusMemberId, initialFocusId])

  if (members.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(245,240,224,0.5)', fontSize: 13 }}>No hay integrantes aún.</p>
      </div>
    )
  }

  const focusMember = byId.get(focusMemberId)
  if (!focusMember) return null

  // Utilidad para extraer cónyuges
  const getSpouses = (memberId: string): Member[] => {
    const m = byId.get(memberId)
    if (!m) return []
    const spouseIds = new Set<string>(m.spouses || [])
    for (const rel of relationships) {
      if (rel.relationship === 'spouse' && rel.isActive !== false) {
        if (rel.member1Id === memberId) spouseIds.add(rel.member2Id)
        if (rel.member2Id === memberId) spouseIds.add(rel.member1Id)
      }
    }
    return Array.from(spouseIds).map(id => byId.get(id)).filter(Boolean) as Member[]
  }

  // ── REGLA 1: ORDEN FIJO Y DATOS ──

  // 1. FILA CENTRAL (Nodo Focus + sus cónyuges)
  const middleRowSpouses = getSpouses(focusMemberId)

  // 2. FILA SUPERIOR (Hijos directos + sus cónyuges)
  let bloodChildren = members.filter(m => (m.parents || []).includes(focusMemberId))
  
  // BUG 2 RESUELTO: Excluir explícitamente de los hijos a cualquier cónyuge que ya esté en la fila central
  bloodChildren = bloodChildren.filter(m => !middleRowSpouses.some(sp => sp.id === m.id))
  
  bloodChildren.sort((a, b) => {
    if (!a.dateOfBirth) return 1
    if (!b.dateOfBirth) return -1
    return new Date(a.dateOfBirth).getTime() - new Date(b.dateOfBirth).getTime()
  })

  const childrenRow: Member[] = []
  for (const child of bloodChildren) {
    childrenRow.push(child)
    const childSpouses = getSpouses(child.id)
    for (const sp of childSpouses) {
      // Evitar que el cónyuge de un hijo se duplique si por error también fue detectado como hijo
      if (!childrenRow.find(x => x.id === sp.id)) {
        childrenRow.push(sp)
      }
    }
  }

  // 3. FILA INFERIOR (Padres)
  const parentsRow = (focusMember.parents || []).map(id => byId.get(id)).filter(Boolean) as Member[]
  parentsRow.sort((a, b) => {
    if (a.gender === 'male' && b.gender !== 'male') return -1
    if (b.gender === 'male' && a.gender !== 'male') return 1
    return 0
  })

  // 4. LÓGICA DE HERMANOS PARA DOTS
  const focusParentSet = new Set(focusMember.parents || [])
  let siblings = members.filter(m => {
    if (m.id === focusMemberId) return true
    return (m.parents || []).some(pid => focusParentSet.has(pid))
  })
  if (focusParentSet.size === 0) siblings = [focusMember]
  siblings.sort((a, b) => a.firstName.localeCompare(b.firstName))
  const focusIndex = siblings.findIndex(m => m.id === focusMemberId)


  // ── NAVEGACIÓN ──
  const handleTap = (member: Member) => {
    if (member.id === focusMemberId) {
      onMemberTap(member)
    } else {
      setFocusMemberId(member.id)
    }
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    overflowX: 'auto',
    padding: '10px 20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '9px',
    color: '#D4AF37',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    margin: '8px 0',
    fontWeight: '600',
    zIndex: 1
  }

  const Connector = () => (
    <svg width="2" height="32" style={{ margin: '4px 0', opacity: 0.4, zIndex: 1 }}>
      <line x1="1" y1="0" x2="1" y2="32" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="3,3" />
    </svg>
  )

  return (
    <div 
      className="mobile-tree-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: '20px',
        paddingBottom: '20px'
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url("/assets/arbol-base.png")',
        backgroundSize: 'cover', backgroundPosition: 'center bottom',
        opacity: 0.12, pointerEvents: 'none', zIndex: 0
      }} />

      {/* ARRIBA: Hijos */}
      {childrenRow.length > 0 && (
        <>
          <p style={labelStyle}>Hijos</p>
          <div style={{ ...rowStyle, zIndex: 1, justifyContent: childrenRow.length > 4 ? 'flex-start' : 'center' }}>
            {childrenRow.map(m => (
              <AppleNode 
                key={`child-${m.id}`} 
                member={m} 
                isHovered={false} 
                size={40} 
                hideText={true} 
                showNameBelow={true} 
                onClick={() => handleTap(m)} 
              />
            ))}
          </div>
          <Connector />
        </>
      )}

      {/* CENTRO: Nodo Central + Parejas y Puntos de Navegación */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <AppleNode 
            member={focusMember} 
            isHovered={false} 
            size={52} 
            hideText={true} 
            showNameBelow={true} 
            onClick={() => handleTap(focusMember)} 
          />
          {middleRowSpouses.map(sp => (
            <AppleNode 
              key={`spouse-${sp.id}`} 
              member={sp} 
              isHovered={false} 
              size={52} 
              hideText={true} 
              showNameBelow={true} 
              onClick={() => handleTap(sp)} 
            />
          ))}
        </div>

        {siblings.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
            {siblings.map((sib, i) => (
              <div
                key={sib.id}
                onClick={() => setFocusMemberId(sib.id)}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: i === focusIndex ? '#D4AF37' : 'rgba(212, 175, 55, 0.3)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ABAJO: Padres */}
      {parentsRow.length > 0 && (
        <>
          <Connector />
          <p style={labelStyle}>Padres / Abuelos</p>
          <div style={{ ...rowStyle, zIndex: 1, justifyContent: 'center' }}>
            {parentsRow.map(p => (
              <AppleNode 
                key={`parent-${p.id}`} 
                member={p} 
                isHovered={false} 
                size={40} 
                hideText={true} 
                showNameBelow={true} 
                onClick={() => handleTap(p)} 
              />
            ))}
          </div>
        </>
      )}
      
      <style>{`
        .mobile-tree-container::-webkit-scrollbar { display: none; }
        .mobile-tree-container > div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
