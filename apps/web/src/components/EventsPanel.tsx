'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member, FamilyEvent, FamilyEventType } from '@/lib/types'
import { Calendar, Plus, X, Gift, Heart, Star, Users, Sparkles, ChevronRight, Pencil, Trash2 } from 'lucide-react'

interface EventsPanelProps {
  members: Member[]
  treeId: string
}

const EVENT_COLORS: Record<FamilyEventType, { bg: string; accent: string; icon: React.ReactNode; label: string }> = {
  birthday:    { bg: '#FFF3E0', accent: '#E65100', icon: <Gift size={14} />,     label: 'Cumpleaños' },
  anniversary: { bg: '#FCE4EC', accent: '#AD1457', icon: <Heart size={14} />,    label: 'Aniversario' },
  memorial:    { bg: '#EDE7F6', accent: '#4527A0', icon: <Star size={14} />,     label: 'Memorial' },
  reunion:     { bg: '#E8F5E9', accent: '#2E7D32', icon: <Users size={14} />,    label: 'Reunión' },
  custom:      { bg: '#E3F2FD', accent: '#1565C0', icon: <Sparkles size={14} />, label: 'Evento' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextOccurrence(isoDate: string): Date {
  const today = new Date()
  const [, m, d] = isoDate.split('-').map(Number)
  let candidate = new Date(today.getFullYear(), m - 1, d)
  if (candidate < today) candidate.setFullYear(today.getFullYear() + 1)
  return candidate
}

function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((date.getTime() - today.getTime()) / 86_400_000)
}

function formatShortDate(isoDate: string): string {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const [, m, d] = isoDate.split('-').map(Number)
  return `${months[m - 1]} ${d}`
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// Encode/decode helpers — avoids needing a 'metadata' column in Supabase
function encodeDesc(eventDate: string, eventType: FamilyEventType, memberId: string, note: string): string {
  const parts = `[EVDATE:${eventDate}][EVTYPE:${eventType}]${memberId ? `[EVMEM:${memberId}]` : ''}`
  return note.trim() ? `${parts} ${note.trim()}` : parts
}

interface DecodedDesc {
  eventDate: string | null
  eventType: FamilyEventType | null
  memberId: string | null
  note: string | null
}

function decodeDesc(desc: string): DecodedDesc {
  const dateMatch = desc.match(/\[EVDATE:(\d{4}-\d{2}-\d{2})\]/)
  const typeMatch = desc.match(/\[EVTYPE:([a-z]+)\]/)
  const memMatch  = desc.match(/\[EVMEM:([^\]]+)\]/)
  const note = desc.replace(/\[EV[A-Z]+:[^\]]*\]/g, '').trim() || null
  return {
    eventDate: dateMatch?.[1] ?? null,
    eventType: (typeMatch?.[1] as FamilyEventType) ?? null,
    memberId:  memMatch?.[1] ?? null,
    note,
  }
}

// Maps our UI event types to valid Supabase activity_type enum values
// Valid: birthday | anniversary | achievement | greeting | photo_upload | new_member | memorial
const TYPE_TO_DB: Record<FamilyEventType, string> = {
  birthday:    'birthday',
  anniversary: 'anniversary',
  memorial:    'memorial',
  reunion:     'achievement',  // closest valid enum
  custom:      'greeting',     // closest valid enum
}

// ── EventCard ─────────────────────────────────────────────────────────────────

interface EventCardProps {
  event: FamilyEvent
  onDelete?: (id: string) => void
  onEdit?: (event: FamilyEvent) => void
}

function EventCard({ event, onDelete, onEdit }: EventCardProps) {
  const cfg = EVENT_COLORS[event.eventType]
  const days = daysUntil(nextOccurrence(event.eventDate))
  const isToday = days === 0
  const isCustom = !event.id.startsWith('auto-')

  return (
    <div
      style={{
        backgroundColor: cfg.bg,
        borderRadius: '16px',
        padding: '14px 16px',
        border: `1.5px solid ${cfg.accent}30`,
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        position: 'relative',
        boxShadow: isToday ? `0 0 0 2px ${cfg.accent}60` : 'none',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* Date badge */}
      <div style={{
        minWidth: '50px', height: '50px', borderRadius: '12px',
        backgroundColor: cfg.accent, color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '9px', opacity: 0.8 }}>{formatShortDate(event.eventDate).split(' ')[0]}</span>
        <span style={{ fontSize: '20px', lineHeight: 1, fontWeight: 900 }}>{formatShortDate(event.eventDate).split(' ')[1]}</span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
          <span style={{ color: cfg.accent }}>{cfg.icon}</span>
          <span style={{ fontSize: '9px', fontWeight: 900, color: cfg.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cfg.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 900, color: '#2C1810', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </p>
        {event.description && (
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#2C1810', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {event.description}
          </p>
        )}
      </div>

      {/* Days counter */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '38px', flexShrink: 0 }}>
        {isToday ? (
          <span style={{ fontSize: '10px', fontWeight: 900, color: cfg.accent, textAlign: 'center' }}>HOY 🎉</span>
        ) : (
          <>
            <span style={{ fontSize: '16px', fontWeight: 900, color: cfg.accent }}>{days}</span>
            <span style={{ fontSize: '9px', color: '#2C1810', opacity: 0.5 }}>días</span>
          </>
        )}
      </div>

      {/* Edit & Delete buttons — only for manually created events */}
      {isCustom && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          {onEdit && (
            <button
              onClick={() => onEdit(event)}
              title="Editar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', opacity: 0.45, color: '#2C1810' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}
            >
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(event.id)}
              title="Eliminar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', opacity: 0.45, color: '#c62828' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.45')}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

interface EventModalProps {
  treeId: string
  members: Member[]
  editingEvent?: FamilyEvent | null
  onClose: () => void
  onSave: () => void
}

function EventModal({ treeId, members, editingEvent, onClose, onSave }: EventModalProps) {
  const isEditing = !!editingEvent

  const [title, setTitle]         = useState(editingEvent?.title ?? '')
  const [note, setNote]           = useState(editingEvent?.description ?? '')
  const [eventType, setEventType] = useState<FamilyEventType>(editingEvent?.eventType ?? 'custom')
  const [eventDate, setEventDate] = useState(editingEvent?.eventDate ?? todayISO())
  const [memberId, setMemberId]   = useState(editingEvent?.memberId ?? '')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = async () => {
    if (!title.trim()) { setError('El título es requerido.'); return }
    if (!eventDate)    { setError('La fecha es requerida.');  return }

    setSaving(true)
    setError('')
    try {
      // Store everything inside 'description' using encoded tags (no metadata column needed)
      const fullDescription = encodeDesc(eventDate, eventType, memberId, note)

      if (isEditing && editingEvent) {
        const { error: dbErr } = await supabase
          .from('activities')
          .update({
            type: TYPE_TO_DB[eventType],
            title: title.trim(),
            description: fullDescription,
          })
          .eq('id', editingEvent.id)
        if (dbErr) throw dbErr
      } else {
        const { error: dbErr } = await supabase.from('activities').insert({
          tree_id: treeId,
          type: TYPE_TO_DB[eventType],
          title: title.trim(),
          description: fullDescription,
          privacy: 'core',
        })
        if (dbErr) throw dbErr
      }

      onSave()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Error al guardar el evento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: '#FAEFBC', borderRadius: '24px', padding: '24px 24px 20px',
        border: '2px solid #2C1810', width: '100%', maxWidth: '370px',
        boxShadow: '0 30px 70px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: '12px',
        maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 950, color: '#2C1810', fontFamily: 'Playfair Display, serif' }}>
            {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={22} color="#2C1810" />
          </button>
        </div>

        {/* Type selector */}
        <div>
          <label style={labelStyle}>Tipo de evento</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {(Object.entries(EVENT_COLORS) as [FamilyEventType, typeof EVENT_COLORS[FamilyEventType]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setEventType(key)} style={{
                padding: '8px 4px',
                backgroundColor: eventType === key ? cfg.accent : 'rgba(44,24,16,0.07)',
                color: eventType === key ? '#fff' : '#2C1810',
                borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontSize: '10px', fontWeight: 900,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                transition: 'all 0.18s',
              }}>
                <span>{cfg.icon}</span>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={labelStyle}>Título *</label>
          <input
            type="text" value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Cumpleaños de Abuela María"
            style={inputStyle}
          />
        </div>

        {/* Date */}
        <div>
          <label style={labelStyle}>Fecha *</label>
          <input
            type="date" value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Member */}
        <div>
          <label style={labelStyle}>Miembro relacionado (opcional)</label>
          <select value={memberId} onChange={e => setMemberId(e.target.value)} style={inputStyle}>
            <option value="">— Ninguno —</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div>
          <label style={labelStyle}>Nota (opcional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Agrega un detalle o recordatorio..."
            style={{ ...inputStyle, resize: 'none', height: '56px' }}
          />
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: '12px', color: '#c62828', fontWeight: 700, backgroundColor: 'rgba(198,40,40,0.08)', padding: '8px 12px', borderRadius: '10px' }}>
            ⚠ {error}
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px',
              backgroundColor: 'transparent',
              color: '#2C1810',
              borderRadius: '14px',
              border: '2px solid rgba(44,24,16,0.25)',
              fontSize: '14px', fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex: 2, padding: '13px',
              backgroundColor: '#2C1810', color: '#FAEFBC',
              borderRadius: '14px', border: 'none',
              fontSize: '14px', fontWeight: 950,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 8px 20px rgba(44,24,16,0.2)',
            }}
          >
            {saving ? 'Guardando...' : isEditing ? '✏️ Guardar Cambios' : '✨ Guardar Evento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function EventsPanel({ members, treeId }: EventsPanelProps) {
  const [events, setEvents]         = useState<FamilyEvent[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null)
  const [filter, setFilter]         = useState<FamilyEventType | 'all'>('all')

  // Auto-generated birthdays from members
  const autoEvents = React.useMemo<FamilyEvent[]>(() =>
    members
      .filter(m => m.dateOfBirth && !m.dateOfDeath)
      .map(m => ({
        id: `auto-birthday-${m.id}`,
        treeId,
        title: `${m.firstName} ${m.lastName}`,
        description: m.occupation ?? null,
        eventType: 'birthday' as FamilyEventType,
        eventDate: m.dateOfBirth!.substring(0, 10),
        memberId: m.id,
        privacy: 'core' as const,
      })),
  [members, treeId])

  const fetchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('tree_id', treeId)
        .in('type', ['birthday', 'anniversary', 'memorial', 'achievement', 'greeting'])
        .order('created_at', { ascending: false })
        .limit(60)

      if (error) throw error

      const mapped: FamilyEvent[] = (data || [])
        .filter((a: any) => (a.description || '').includes('[EVDATE:'))
        .map((a: any) => {
          const decoded = decodeDesc(a.description || '')
          return {
            id: a.id,
            treeId: a.tree_id,
            title: a.title,
            description: decoded.note,
            eventType: decoded.eventType ?? (a.type as FamilyEventType),
            eventDate: decoded.eventDate ?? a.created_at.substring(0, 10),
            memberId: decoded.memberId,
            imageUrl: a.image_url ?? null,
            privacy: a.privacy ?? 'family',
            createdAt: a.created_at,
          } as FamilyEvent
        })

      setEvents(mapped)
    } catch (e) {
      console.error('EventsPanel fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [treeId])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este evento permanentemente?')) return
    await supabase.from('activities').delete().eq('id', id)
    fetchEvents()
  }

  const allEvents = React.useMemo(() => {
    const merged = [...autoEvents, ...events]
    const seen = new Set<string>()
    return merged
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
      .filter(e => filter === 'all' || e.eventType === filter)
      .sort((a, b) => daysUntil(nextOccurrence(a.eventDate)) - daysUntil(nextOccurrence(b.eventDate)))
  }, [autoEvents, events, filter])

  const upcoming30 = allEvents.filter(e => daysUntil(nextOccurrence(e.eventDate)) <= 30)
  const later      = allEvents.filter(e => daysUntil(nextOccurrence(e.eventDate)) > 30)

  return (
    <>
      {/* Filter strip */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {(['all', 'birthday', 'anniversary', 'memorial', 'reunion', 'custom'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 9px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em',
            backgroundColor: filter === f ? '#2C1810' : 'rgba(44,24,16,0.08)',
            color: filter === f ? '#FAEFBC' : '#2C1810',
            transition: 'all 0.2s',
          }}>
            {f === 'all' ? 'Todos' : EVENT_COLORS[f as FamilyEventType].label}
          </button>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => { setEditingEvent(null); setShowModal(true) }}
        style={{
          width: '100%', padding: '12px',
          backgroundColor: '#2C1810', color: '#FAEFBC',
          borderRadius: '14px', border: 'none', cursor: 'pointer',
          fontSize: '13px', fontWeight: 950,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginBottom: '16px',
          boxShadow: '0 6px 16px rgba(44,24,16,0.2)',
        }}
      >
        <Plus size={16} /> Agregar Evento
      </button>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid rgba(44,24,16,0.1)', borderTopColor: '#2C1810', borderRadius: '50%', animation: 'evSpin 1s linear infinite' }} />
          <style>{`@keyframes evSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : allEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 16px', color: '#2C1810', opacity: 0.5 }}>
          <Calendar size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Sin eventos registrados</p>
          <p style={{ margin: '6px 0 0', fontSize: '11px' }}>Agrega el primer evento familiar</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {upcoming30.length > 0 && (
            <section>
              <SectionHeader icon={<ChevronRight size={12} />} label="Próximos 30 días" count={upcoming30.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {upcoming30.map(e => (
                  <EventCard key={e.id} event={e}
                    onDelete={handleDelete}
                    onEdit={ev => { setEditingEvent(ev); setShowModal(true) }}
                  />
                ))}
              </div>
            </section>
          )}
          {later.length > 0 && (
            <section>
              <SectionHeader icon={<Calendar size={12} />} label="Más adelante" count={later.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {later.map(e => (
                  <EventCard key={e.id} event={e}
                    onDelete={handleDelete}
                    onEdit={ev => { setEditingEvent(ev); setShowModal(true) }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {(showModal || editingEvent) && (
        <EventModal
          treeId={treeId}
          members={members}
          editingEvent={editingEvent}
          onClose={() => { setShowModal(false); setEditingEvent(null) }}
          onSave={fetchEvents}
        />
      )}
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '9px' }}>
      <span style={{ color: '#2C1810', opacity: 0.4 }}>{icon}</span>
      <span style={{ fontSize: '10px', fontWeight: 900, color: '#2C1810', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.55 }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', fontWeight: 900, backgroundColor: '#2C1810', color: '#FAEFBC', borderRadius: '10px', padding: '1px 7px' }}>
        {count}
      </span>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: 900,
  color: '#2C1810', opacity: 0.6, textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  backgroundColor: 'rgba(255,255,255,0.7)',
  border: '1.5px solid rgba(44,24,16,0.2)',
  borderRadius: '12px', fontSize: '14px',
  color: '#2C1810', fontWeight: 700,
  outline: 'none', boxSizing: 'border-box',
}
