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

// ── Core data derivation ──────────────────────────────────────────
// Uses member.parents[] and member.spouses[] (populated from DB)
// as the primary source of truth, supplemented by the relationships table.

interface GenerationView {
  parents:   Member[]
  siblings:  Member[]   // includes focus member itself
  spouses:   Member[]
  children:  Member[]
  focusIndex: number
}

function deriveView(
  focusId: string,
  members: Member[],
  relationships: Relationship[],
): GenerationView {
  const byId = new Map(members.map(m => [m.id, m]))
  const focus = byId.get(focusId)
  if (!focus) return { parents: [], siblings: [members[0]].filter(Boolean), spouses: [], children: [], focusIndex: 0 }

  // ── Parents: from member.parents[] field ──────────────────────
  const parents: Member[] = (focus.parents ?? [])
    .map(pid => byId.get(pid))
    .filter(Boolean) as Member[]

  // ── Children: members whose parents[] contains focusId ────────
  const children: Member[] = members.filter(m =>
    m.id !== focusId && (m.parents ?? []).includes(focusId)
  )

  // ── Spouses: from member.spouses[] field + relationships table ─
  const spouseIdsFromField = new Set<string>(focus.spouses ?? [])

  // Also check the relationships table for 'spouse' type
  for (const rel of relationships) {
    if (rel.relationship === 'spouse') {
      if (rel.member1Id === focusId) spouseIdsFromField.add(rel.member2Id)
      if (rel.member2Id === focusId) spouseIdsFromField.add(rel.member1Id)
    }
  }

  const spouses: Member[] = [...spouseIdsFromField]
    .map(sid => byId.get(sid))
    .filter(Boolean) as Member[]

  // ── Siblings: members who share ≥1 parent with focus ──────────
  const focusParentSet = new Set(focus.parents ?? [])

  let siblings: Member[] = []

  if (focusParentSet.size > 0) {
    // Proper sibling detection: share a parent via parents[] field
    siblings = members.filter(m => {
      if (m.id === focusId) return true  // always include focus
      return (m.parents ?? []).some(pid => focusParentSet.has(pid))
    })
  } else {
    // No parent info → focus is a root; show focus + spouses in "middle row"
    siblings = [focus]
  }

  // Also include anyone with a 'sibling' relationship in the relationships table
  for (const rel of relationships) {
    if (rel.relationship === 'sibling') {
      const sibId = rel.member1Id === focusId ? rel.member2Id
                  : rel.member2Id === focusId ? rel.member1Id
                  : null
      if (sibId) {
        const sib = byId.get(sibId)
        if (sib && !siblings.find(s => s.id === sibId)) {
          siblings.push(sib)
        }
      }
    }
  }

  // Sort by name for stable ordering
  siblings.sort((a, b) => a.firstName.localeCompare(b.firstName))

  const focusIndex = Math.max(0, siblings.findIndex(m => m.id === focusId))

  return { parents, siblings, spouses, children, focusIndex }
}

// ── Main component ────────────────────────────────────────────────
export default function MobileTreeView({
  members,
  relationships,
  onMemberTap,
}: MobileTreeViewProps) {
  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  // Initial focus: prefer generation 0, else member with most children, else first
  const initialFocusId = useMemo(() => {
    if (members.length === 0) return ''
    const gen0 = members.find(m => (m.generation ?? 0) === 0)
    if (gen0) return gen0.id
    const withKids = [...members].sort((a, b) => {
      const ac = members.filter(m => (m.parents ?? []).includes(a.id)).length
      const bc = members.filter(m => (m.parents ?? []).includes(b.id)).length
      return bc - ac
    })[0]
    return withKids?.id ?? members[0]?.id ?? ''
  }, [members])

  const [focusMemberId, setFocusMemberId] = useState<string>(initialFocusId)

  // Sync if members change and current focus no longer exists
  useEffect(() => {
    if (members.length === 0) return
    if (!byId.has(focusMemberId)) {
      setFocusMemberId(initialFocusId)
    }
  }, [members, byId, focusMemberId, initialFocusId])

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const { parents, siblings, spouses, children, focusIndex } = useMemo(
    () => deriveView(focusMemberId, members, relationships),
    [focusMemberId, members, relationships],
  )

  const siblingCount = siblings.length

  // Navigate to adjacent sibling — no circular wrap, so never repeats
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
      onMemberTap(member)   // second tap → open bottom sheet
    } else {
      setFocusMemberId(member.id)  // first tap → re-focus
    }
  }

  if (members.length === 0) {
    return (
      <div className="mobile-tree-container" style={{ justifyContent: 'center' }}>
        <p style={{ color: 'rgba(245,240,224,0.5)', fontSize: 13 }}>No hay integrantes aún.</p>
      </div>
    )
  }

  const focusMember = byId.get(focusMemberId)

  // Visible siblings: up to 2 on each side of focus, no circular wrapping → no repeats
  const MAX_SIDE = 2
  const startIdx = Math.max(0, focusIndex - MAX_SIDE)
  const endIdx   = Math.min(siblingCount - 1, focusIndex + MAX_SIDE)
  const visibleSiblings = siblings.slice(startIdx, endIdx + 1)

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
              <MobileApple key={child.id} member={child} variant="side" onClick={() => handleMemberTap(child)} />
            ))}
          </div>
          <svg className="mobile-gen-connector" viewBox="0 0 320 32" preserveAspectRatio="none">
            <line x1="160" y1="0" x2="160" y2="32" stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="3,3" />
          </svg>
        </>
      )}

      {/* ── ROW: FOCUS / SIBLINGS (MEDIO) ── */}
      <div className="mobile-gen-row" style={{ gap: '8px', padding: '6px 12px' }}>
        {visibleSiblings.map(member => (
          <MobileApple
            key={member.id}
            member={member}
            variant={member.id === focusMemberId ? 'focus' : 'sibling'}
            onClick={() => handleMemberTap(member)}
          />
        ))}

        {/* Spouse(s) next to focus */}
        {visibleSpouses.length > 0 && (
          <>
            <span style={{ color: '#D4AF37', alignSelf: 'center', fontSize: 14, opacity: 0.55, flexShrink: 0 }}>♡</span>
            {visibleSpouses.map(spouse => (
              <MobileApple key={spouse.id} member={spouse} variant="side" onClick={() => handleMemberTap(spouse)} />
            ))}
          </>
        )}
      </div>

      {/* Navigation dots */}
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
          <line x1="160" y1="0" x2="160" y2="32" stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="3,3" />
        </svg>
      )}

      {/* ── ROW: PARENTS (ABAJO) ── */}
      {visibleParents.length > 0 && (
        <>
          <div className="mobile-gen-row">
            {visibleParents.map(parent => (
              <MobileApple key={parent.id} member={parent} variant="side" onClick={() => handleMemberTap(parent)} />
            ))}
          </div>
          <p className="mobile-row-label" style={{ marginTop: 4 }}>Padres / Abuelos</p>
        </>
      )}

      {/* Hint */}
      {focusMember && (
        <p style={{
          position: 'absolute', bottom: 76, left: '50%',
          transform: 'translateX(-50%)', fontSize: 10,
          color: 'rgba(245,240,224,0.3)', whiteSpace: 'nowrap', pointerEvents: 'none'
        }}>
          Toca {focusMember.firstName} de nuevo para ver opciones
        </p>
      )}
    </div>
  )
}
