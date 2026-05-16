'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
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

// ── Apple image (visual skin) ─────────────────────────────────────
function AppleImage({ src, alt, className }: { src: string; alt: string; className: string }) {
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
        <AppleImage src={getAvatarUrl(member)} alt={member.firstName} className="mobile-apple-img" />
      </div>
      <span className="mobile-apple-name">{shortName(member)}</span>
    </div>
  )
}

// ── Core logic: derive the 3 generations around a focus member ────
interface GenerationView {
  parents:  Member[]   // row displayed BELOW (bottom)
  siblings: Member[]   // row in the MIDDLE (focus row)
  children: Member[]   // row displayed ABOVE (top)
  focusIndex: number   // index of the focused member in siblings[]
}

function deriveGenerations(
  members: Member[],
  focusMemberId: string,
): GenerationView {
  const focus = members.find(m => m.id === focusMemberId)
  if (!focus) {
    return { parents: [], siblings: [members[0] ?? null].filter(Boolean) as Member[], children: [], focusIndex: 0 }
  }

  const focusGen = focus.generation ?? 0

  // Parents: members whose IDs appear in focus.parents[]
  const parents: Member[] = (focus.parents ?? [])
    .map(pid => members.find(m => m.id === pid))
    .filter(Boolean) as Member[]

  // Children: members who list focus.id in their .parents[]
  const children: Member[] = members.filter(
    m => (m.parents ?? []).includes(focus.id)
  )

  // Siblings: same generation AND share at least one parent with focus
  // If no parent data exists, only include the focus itself to avoid showing
  // unrelated members as siblings.
  const parentSet = new Set(focus.parents ?? [])
  let siblings = members.filter(m => {
    if ((m.generation ?? 0) !== focusGen) return false
    // Always include focus itself
    if (m.id === focus.id) return true
    // Share a parent?
    if (parentSet.size > 0) {
      return (m.parents ?? []).some(pid => parentSet.has(pid))
    }
    // No parent data → don't assume membership, only show the focus
    return false
  })

  // Sort siblings by first name for stable ordering
  siblings = siblings.sort((a, b) => a.firstName.localeCompare(b.firstName))

  const focusIndex = Math.max(0, siblings.findIndex(m => m.id === focus.id))

  return { parents, siblings, children, focusIndex }
}

// ── Main component ────────────────────────────────────────────────
export default function MobileTreeView({
  members,
  relationships,
  onMemberTap,
  onDeleteMember,
}: MobileTreeViewProps) {
  // Determine the initial focus: generation 0 member, or first
  const initialFocus = members.find(m => (m.generation ?? 0) === 0) ?? members[0]
  const [focusMemberId, setFocusMemberId] = useState<string>(initialFocus?.id ?? '')

  // Update focus when members list changes (e.g. after refresh)
  useEffect(() => {
    if (!members.find(m => m.id === focusMemberId)) {
      const fallback = members.find(m => (m.generation ?? 0) === 0) ?? members[0]
      if (fallback) setFocusMemberId(fallback.id)
    }
  }, [members, focusMemberId])

  // Swipe state
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  const { parents, siblings, children, focusIndex } = deriveGenerations(members, focusMemberId)

  // ── Navigate to adjacent sibling ────────────────────────────────
  const goToSibling = useCallback((direction: 'left' | 'right') => {
    const nextIdx =
      direction === 'left'
        ? (focusIndex - 1 + siblings.length) % siblings.length
        : (focusIndex + 1) % siblings.length
    if (siblings[nextIdx]) setFocusMemberId(siblings[nextIdx].id)
  }, [focusIndex, siblings])

  // ── Touch handlers for swipe ─────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    // Only trigger swipe if horizontal movement dominates
    if (Math.abs(deltaX) > 50 && deltaY < 60) {
      goToSibling(deltaX < 0 ? 'right' : 'left')
    }
  }

  // ── Handle tapping a member ──────────────────────────────────────
  const handleMemberTap = (member: Member) => {
    if (member.id === focusMemberId) {
      // Second tap on the focused member → open bottom sheet
      onMemberTap(member)
    } else {
      // First tap on any other member → re-focus
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
  const siblingCount = siblings.length

  // How many siblings to show on each side of the focus (max 2 per side).
  // We use plain array slicing (no circular wrapping) so members never repeat.
  const MAX_SIDE = 2
  const visibleSiblings: { member: Member; variant: 'focus' | 'sibling' }[] = []

  const startIdx = Math.max(0, focusIndex - MAX_SIDE)
  const endIdx   = Math.min(siblingCount - 1, focusIndex + MAX_SIDE)

  for (let i = startIdx; i <= endIdx; i++) {
    visibleSiblings.push({
      member: siblings[i],
      variant: i === focusIndex ? 'focus' : 'sibling',
    })
  }

  // Limit parents to 4 for readability
  const visibleParents = parents.slice(0, 4)
  // Limit children to 5
  const visibleChildren = children.slice(0, 5)

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

          {/* Connector: children → focus */}
          <svg className="mobile-gen-connector" viewBox="0 0 320 32" preserveAspectRatio="none">
            <line x1="160" y1="0" x2="160" y2="32"
              stroke="#D4AF37" strokeWidth="1.5" strokeOpacity="0.4"
              strokeDasharray="3,3" />
          </svg>
        </>
      )}

      {/* ── ROW: SIBLINGS / FOCUS (MEDIO) ── */}
      <div
        className="mobile-gen-row"
        style={{ gap: '8px', padding: '6px 12px' }}
      >
        {visibleSiblings.map(({ member, variant }) => (
          <MobileApple
            key={member.id}
            member={member}
            variant={variant}
            onClick={() => handleMemberTap(member)}
          />
        ))}
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

      {/* Hint: tap the focused apple to open menu */}
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
