'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { Member, Relationship } from '@/lib/types'

interface MobileTreeViewProps {
  members: Member[]
  relationships: Relationship[]
  onMemberTap: (member: Member) => void
  onDeleteMember: (member: Member) => void
}

// ── Avatar helper ─────────────────────────────────────────────────
function getAvatarUrl(member: Member): string {
  if (member.avatarUrl) return member.avatarUrl
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.firstName)}&backgroundColor=d4af37&fontFamily=Playfair%20Display`
}

// ── Derive first name (truncated) ─────────────────────────────────
function shortName(member: Member): string {
  return member.firstName.length > 8
    ? member.firstName.slice(0, 7) + '…'
    : member.firstName
}

// ── Image with error fallback ─────────────────────────────────────
function AppleImage({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false)
  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(alt)}&backgroundColor=d4af37`
  return (
    <img
      src={err ? fallback : src}
      alt={alt}
      className="mobile-apple-img"
      onError={() => setErr(true)}
    />
  )
}

// ── Single apple node ─────────────────────────────────────────────
function MobileApple({
  member,
  variant,
  onClick,
}: {
  member: Member
  variant: 'focus' | 'sibling' | 'side'
  onClick: () => void
}) {
  const containerClass =
    variant === 'focus'
      ? 'mobile-apple-focus'
      : variant === 'sibling'
      ? 'mobile-apple-sibling'
      : 'mobile-apple-side'

  return (
    <div className="mobile-apple-wrapper" onClick={onClick}>
      <div className={containerClass}>
        <AppleImage src={getAvatarUrl(member)} alt={member.firstName} />
      </div>
      <span className="mobile-apple-name">{shortName(member)}</span>
    </div>
  )
}

// ── Build adjacency maps from the relationships array ────────────
interface AdjacencyMaps {
  parentOf: Map<string, Set<string>>   // parentId → Set of childIds
  childOf:  Map<string, Set<string>>   // childId  → Set of parentIds
  spouseOf: Map<string, Set<string>>   // memberId → Set of spouseIds
  siblingOf: Map<string, Set<string>>  // memberId → Set of siblingIds (share ≥1 parent)
}

function buildAdjacency(relationships: Relationship[]): AdjacencyMaps {
  const parentOf  = new Map<string, Set<string>>()
  const childOf   = new Map<string, Set<string>>()
  const spouseOf  = new Map<string, Set<string>>()

  const ensure = (map: Map<string, Set<string>>, key: string) => {
    if (!map.has(key)) map.set(key, new Set())
    return map.get(key)!
  }

  for (const rel of relationships) {
    const { member1Id: m1, member2Id: m2, relationship: type } = rel

    if (type === 'parent') {
      // m1 is parent of m2
      ensure(parentOf, m1).add(m2)
      ensure(childOf,  m2).add(m1)
    } else if (type === 'child') {
      // m1 is child of m2
      ensure(parentOf, m2).add(m1)
      ensure(childOf,  m1).add(m2)
    } else if (type === 'spouse') {
      ensure(spouseOf, m1).add(m2)
      ensure(spouseOf, m2).add(m1)
    }
  }

  // Build sibling map: members who share ≥1 parent
  const siblingOf = new Map<string, Set<string>>()
  for (const [parentId, children] of parentOf.entries()) {
    const childArr = [...children]
    for (const c1 of childArr) {
      for (const c2 of childArr) {
        if (c1 !== c2) {
          ensure(siblingOf, c1).add(c2)
        }
      }
    }
  }

  return { parentOf, childOf, spouseOf, siblingOf }
}

// ── Derive what to show given a focused member ───────────────────
interface GenerationView {
  parents:   Member[]
  siblings:  Member[]   // includes the focus member itself
  children:  Member[]
  spouses:   Member[]
  focusIndex: number
}

function deriveView(
  focusId: string,
  members: Member[],
  adj: AdjacencyMaps,
): GenerationView {
  const byId = new Map(members.map(m => [m.id, m]))

  const resolve = (ids: Set<string> | undefined): Member[] =>
    [...(ids ?? [])].map(id => byId.get(id)).filter(Boolean) as Member[]

  const parents  = resolve(adj.childOf.get(focusId))
  const children = resolve(adj.parentOf.get(focusId))
  const spouses  = resolve(adj.spouseOf.get(focusId))

  // Siblings = members who share ≥1 parent with focus AND are not the focus itself
  const siblingIds = adj.siblingOf.get(focusId) ?? new Set<string>()
  const siblingsRaw = resolve(siblingIds)

  // Build the sibling row: [focus] + siblings, sorted by name, deduplicated
  const seen = new Set<string>([focusId])
  const focusMember = byId.get(focusId)
  const siblings: Member[] = focusMember ? [focusMember] : []
  for (const s of siblingsRaw.sort((a, b) => a.firstName.localeCompare(b.firstName))) {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      siblings.push(s)
    }
  }
  // Sort the whole row by name
  siblings.sort((a, b) => a.firstName.localeCompare(b.firstName))
  const focusIndex = Math.max(0, siblings.findIndex(m => m.id === focusId))

  return { parents, siblings, children, spouses, focusIndex }
}

// ── Main component ────────────────────────────────────────────────
export default function MobileTreeView({
  members,
  relationships,
  onMemberTap,
  onDeleteMember,
}: MobileTreeViewProps) {
  // Build adjacency once when data changes
  const adj = useMemo(() => buildAdjacency(relationships), [relationships])

  // Choose initial focus: prefer generation=0, then first member with children, then first
  const initialFocus = useMemo(() => {
    if (members.length === 0) return null
    // Try generation 0
    const gen0 = members.find(m => (m.generation ?? 0) === 0)
    if (gen0) return gen0
    // Try member that has children
    const withChildren = members.find(m => (adj.parentOf.get(m.id)?.size ?? 0) > 0)
    if (withChildren) return withChildren
    return members[0]
  }, [members, adj])

  const [focusMemberId, setFocusMemberId] = useState<string>(initialFocus?.id ?? '')

  // Sync if members list changes and current focus is gone
  useEffect(() => {
    if (members.length === 0) return
    if (!members.find(m => m.id === focusMemberId)) {
      const fallback = members.find(m => (m.generation ?? 0) === 0) ?? members[0]
      if (fallback) setFocusMemberId(fallback.id)
    }
  }, [members, focusMemberId])

  // Swipe state
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const { parents, siblings, children, spouses, focusIndex } = useMemo(
    () => deriveView(focusMemberId, members, adj),
    [focusMemberId, members, adj],
  )

  const siblingCount = siblings.length

  // Navigate to adjacent sibling (no wrap)
  const goToSibling = useCallback((direction: 'left' | 'right') => {
    const nextIdx = direction === 'left'
      ? Math.max(0, focusIndex - 1)
      : Math.min(siblingCount - 1, focusIndex + 1)
    if (siblings[nextIdx]) setFocusMemberId(siblings[nextIdx].id)
  }, [focusIndex, siblingCount, siblings])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (Math.abs(deltaX) > 50 && deltaY < 60) {
      goToSibling(deltaX < 0 ? 'right' : 'left')
    }
  }

  const handleMemberTap = (member: Member) => {
    if (member.id === focusMemberId) {
      onMemberTap(member)
    } else {
      setFocusMemberId(member.id)
    }
  }

  if (members.length === 0) {
    return (
      <div className="mobile-tree-container" style={{ justifyContent: 'center' }}>
        <p style={{ color: 'rgba(245,240,224,0.5)', fontSize: 13 }}>No hay integrantes aún.</p>
      </div>
    )
  }

  const focusMember = members.find(m => m.id === focusMemberId)

  // Visible siblings: up to 2 on each side of focus (no circular wrap → no repeats)
  const MAX_SIDE = 2
  const startIdx = Math.max(0, focusIndex - MAX_SIDE)
  const endIdx   = Math.min(siblingCount - 1, focusIndex + MAX_SIDE)
  const visibleSiblings = siblings.slice(startIdx, endIdx + 1)

  // Limit rows for readability
  const visibleParents  = parents.slice(0, 6)
  const visibleChildren = children.slice(0, 6)
  const visibleSpouses  = spouses.slice(0, 3)

  return (
    <div
      className="mobile-tree-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Background tree image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url("/assets/arbol-base.png")',
        backgroundSize: 'cover', backgroundPosition: 'center bottom',
        opacity: 0.12, pointerEvents: 'none'
      }} />

      {/* ── ROW: CHILDREN (ARRIBA) ── */}
      {visibleChildren.length > 0 && (
        <>
          <p className="mobile-row-label">Hijos</p>
          <div className="mobile-gen-row">
            {visibleChildren.map(child => (
              <MobileApple
                key={child.id}
                member={child}
                variant="side"
                onClick={() => handleMemberTap(child)}
              />
            ))}
          </div>
          <svg className="mobile-gen-connector" viewBox="0 0 320 32" preserveAspectRatio="none">
            <line x1="160" y1="0" x2="160" y2="32"
              stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.4"
              strokeDasharray="3,3" />
          </svg>
        </>
      )}

      {/* ── ROW: SIBLINGS / FOCUS (MEDIO) ── */}
      <div className="mobile-gen-row" style={{ gap: '8px', padding: '6px 12px' }}>
        {visibleSiblings.map(member => (
          <MobileApple
            key={member.id}
            member={member}
            variant={member.id === focusMemberId ? 'focus' : 'sibling'}
            onClick={() => handleMemberTap(member)}
          />
        ))}

        {/* Spouse(s) shown next to focus with a small heart separator */}
        {visibleSpouses.length > 0 && (
          <>
            <span style={{ color: '#D4AF37', alignSelf: 'center', fontSize: 16, opacity: 0.6 }}>♡</span>
            {visibleSpouses.map(spouse => (
              <MobileApple
                key={spouse.id}
                member={spouse}
                variant="side"
                onClick={() => handleMemberTap(spouse)}
              />
            ))}
          </>
        )}
      </div>

      {/* Navigation dots (swipe indicator) */}
      {siblingCount > 1 && (
        <div className="mobile-nav-dots">
          {siblings.map((_, i) => (
            <div
              key={i}
              className={`mobile-nav-dot-item${i === focusIndex ? ' active' : ''}`}
              onClick={() => setFocusMemberId(siblings[i].id)}
            />
          ))}
        </div>
      )}

      {/* Connector: focus → parents */}
      {visibleParents.length > 0 && (
        <svg className="mobile-gen-connector" viewBox="0 0 320 32" preserveAspectRatio="none">
          <line x1="160" y1="0" x2="160" y2="32"
            stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.4"
            strokeDasharray="3,3" />
        </svg>
      )}

      {/* ── ROW: PARENTS (ABAJO) ── */}
      {visibleParents.length > 0 && (
        <>
          <div className="mobile-gen-row">
            {visibleParents.map(parent => (
              <MobileApple
                key={parent.id}
                member={parent}
                variant="side"
                onClick={() => handleMemberTap(parent)}
              />
            ))}
          </div>
          <p className="mobile-row-label" style={{ marginTop: 4 }}>Padres / Abuelos</p>
        </>
      )}

      {/* Hint */}
      {focusMember && (
        <p style={{
          position: 'absolute',
          bottom: 76,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10,
          color: 'rgba(245,240,224,0.3)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}>
          Toca {focusMember.firstName} de nuevo para ver opciones
        </p>
      )}
    </div>
  )
}
