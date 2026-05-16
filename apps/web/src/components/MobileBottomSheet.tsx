'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MessageCircle, Heart, UserPlus, Edit2, Trophy, User, Trash2 } from 'lucide-react'
import type { Member } from '@/lib/types'

interface MobileBottomSheetProps {
  member: Member | null
  focusMember: Member | null   // used to compute relation label
  onClose: () => void
  onEdit: (member: Member) => void
  onAdd: (member: Member) => void
  onDelete: (member: Member) => void
  onViewProfile: (member: Member) => void
  onAddStory: (member: Member) => void
}

// ── Relation label relative to the focus member ──────────────────
function getRelationLabel(member: Member, focus: Member | null): string {
  if (!focus || member.id === focus.id) return ''

  const focusGen = focus.generation ?? 0
  const memberGen = member.generation ?? 0
  const diff = memberGen - focusGen

  // Child?
  if (member.parents?.includes(focus.id)) return 'Hijo/a'
  // Parent?
  if (focus.parents?.includes(member.id)) return 'Padre/Madre'
  // Spouse?
  if (focus.spouses?.includes(member.id) || member.spouses?.includes(focus.id)) return 'Cónyuge'
  // Sibling?
  if (diff === 0) return 'Hermano/a'
  if (diff > 0) return 'Descendiente'
  return 'Antepasado'
}

function getAvatarSrc(member: Member): string {
  if (member.avatarUrl) return member.avatarUrl
  return `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}&backgroundColor=d4af37&fontFamily=Playfair%20Display`
}

function getBirthYear(member: Member): string {
  return member.dateOfBirth?.split('-')[0] ?? ''
}

// ── Check minor (same logic as HoverMenu) ─────────────────────────
function isMinor(member: Member): boolean {
  if (member.isBaby || member.generation === 3) return true
  if (!member.dateOfBirth) return false
  const birth = new Date(member.dateOfBirth)
  const today = new Date('2026-04-21')
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age < 18
}

export default function MobileBottomSheet({
  member, focusMember, onClose, onEdit, onAdd, onDelete, onViewProfile, onAddStory
}: MobileBottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [imgError, setImgError] = useState(false)

  // Reset image error state when member changes
  useEffect(() => { setImgError(false) }, [member?.id])

  // ── Swipe-down to close ─────────────────────────────────────────
  const touchStartY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 80) onClose()
  }

  if (!member) return null

  const protected_ = isMinor(member)
  const relation = getRelationLabel(member, focusMember)
  const birthYear = getBirthYear(member)
  const deathYear = member.dateOfDeath?.split('-')[0] ?? ''
  const dates = deathYear ? `${birthYear}–${deathYear}` : birthYear
  const avatarSrc = imgError
    ? `https://api.dicebear.com/7.x/initials/svg?seed=${member.firstName}&backgroundColor=d4af37&fontFamily=Playfair%20Display`
    : getAvatarSrc(member)

  const metaText = [relation, dates].filter(Boolean).join(' · ')

  return (
    <>
      {/* Dim overlay */}
      <div
        className="mobile-sheet-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="mobile-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Opciones para ${member.firstName}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Drag handle */}
        <div className="mobile-sheet-handle" />

        {/* Header: avatar + name + meta */}
        <div className="mobile-sheet-header">
          <img
            className="mobile-sheet-avatar"
            src={avatarSrc}
            alt={member.firstName}
            onError={() => setImgError(true)}
          />
          <div>
            <p className="mobile-sheet-name">
              {member.firstName} {member.lastName}
            </p>
            {metaText && (
              <p className="mobile-sheet-meta">{metaText}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mobile-sheet-actions">

          {/* Contact actions — hidden for minors */}
          {!protected_ && (
            <>
              <button className="mobile-sheet-action-btn" onClick={() => { onClose(); }}>
                <MessageCircle size={20} strokeWidth={1.8} />
                Chatear con {member.firstName}
              </button>
              <button className="mobile-sheet-action-btn" onClick={() => { onClose(); }}>
                <Heart size={20} strokeWidth={1.8} />
                Enviar Saludo
              </button>
              <div className="mobile-sheet-divider" />
            </>
          )}

          <button className="mobile-sheet-action-btn" onClick={() => { onAdd(member); onClose(); }}>
            <UserPlus size={20} strokeWidth={1.8} />
            Añadir Familiar
          </button>

          <button className="mobile-sheet-action-btn" onClick={() => { onEdit(member); onClose(); }}>
            <Edit2 size={20} strokeWidth={1.8} />
            Editar Detalles
          </button>

          <button className="mobile-sheet-action-btn" onClick={() => { onAddStory(member); onClose(); }}>
            <Trophy size={20} strokeWidth={1.8} />
            Publicar Logro
          </button>

          <button className="mobile-sheet-action-btn" onClick={() => { onViewProfile(member); onClose(); }}>
            <User size={20} strokeWidth={1.8} />
            Ver Perfil
          </button>

          <div className="mobile-sheet-divider" />

          {/* Destructive — always at the bottom */}
          <button
            className="mobile-sheet-action-btn critical"
            onClick={() => { onDelete(member); onClose(); }}
          >
            <Trash2 size={20} strokeWidth={1.8} />
            Eliminar Integrante
          </button>

        </div>
      </div>
    </>
  )
}
