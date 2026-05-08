'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member, FamilyEvent, FamilyEventType } from '@/lib/types'
import { Calendar, Plus, X, Gift, Heart, Star, Users, Sparkles, ChevronRight } from 'lucide-react'

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

// ── helpers ──────────────────────────────────────────────────────────────────

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
  const diff = date.getTime() - today.getTime()
  return Math.round(diff / 86_400_000)
}

function formatShortDate(isoDate: string): string {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const [, m, d] = isoDate.split('-').map(Number)
  return `${months[m - 1]} ${d}`
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EventCard({ event, onDelete }: { event: FamilyEvent; onDelete?: (id: string) => void }) {
  const cfg = EVENT_COLORS[event.eventType]
  const nextDate = nextOccurrence(event.eventDate)
  const days = daysUntil(nextDate)
  const isToday = days === 0

  return (
    <div style={{
      backgroundColor: cfg.bg,
      borderRadius: '16px',
      padding: '14px 16px',
      border: `1.5px solid ${cfg.accent}30`,
      display: 'flex',
      gap: '14px',
      alignItems: 'center',
      position: 'relative',
      boxShadow: isToday ? `0 0 0 2px ${cfg.accent}60` : 'none',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* Date badge */}
      <div style={{
        minWidth: '52px', height: '52px',
        borderRadius: '12px',
        backgroundColor: cfg.accent,
        color: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: '900',
        textTransform: 'uppercase', letterSpacing: '0.04em',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '9px', opacity: 0.8 }}>{formatShortDate(event.eventDate).split(' ')[0]}</span>
        <span style={{ fontSize: '20px', lineHeight: 1 }}>{formatShortDate(event.eventDate).split(' ')[1]}</span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <span style={{ color: cfg.accent }}>{cfg.icon}</span>
          <span style={{ fontSize: '9px', fontWeight: '900', color: cfg.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cfg.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#2C1810', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </p>
        {event.description && (
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#2C1810', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {event.description}
          </p>
        )}
      </div>

      {/* Days counter */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        minWidth: '40px', flexShrink: 0,
      }}>
        {isToday ? (
          <span style={{ fontSize: '10px', fontWeight: '900', color: cfg.accent, textAlign: 'center' }}>HOY 🎉</span>
        ) : (
          <>
            <span style={{ fontSize: '16px', fontWeight: '900', color: cfg.accent }}>{days}</span>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#2C1810', opacity: 0.5 }}>días</span>
          </>
        )}
      </div>

      {/* Delete (custom events only) */}
      {onDelete && !event.id.startsWith('auto-') && (
        <button
          onClick={() => onDelete(event.id)}
          style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.4 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
        >
          <X size={12} color="#2C1810" />
        </button>
      )}
    </div>
  )
}

// ── Create Event Modal ────────────────────────────────────────────────────────

interface CreateEventModalProps {
  treeId: string
  members: Member[]
  onClose: () => void
  onSave: () => void
}

function CreateEventModal({ treeId, members, onClose, onSave }: CreateEventModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState<FamilyEventType>('custom')
  const [eventDate, setEventDate] = useState(todayISO())
  const [memberId, setMemberId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!title.trim()) { setError('El título es requerido.'); return }
    if (!eventDate) { setError('La fecha es requerida.'); return }

    setSaving(true)
    try {
      // Encode eventDate + memberId into description since 'metadata' column doesn't exist
      // Format: [EVDATE:YYYY-MM-DD][EVTYPE:type][EVMEM:memberId] Optional note
      const prefix = `[EVDATE:${eventDate}][EVTYPE:${eventType}]${memberId ? `[EVMEM:${memberId}]` : ''}`
      const fullDescription = description.trim()
        ? `${prefix} ${description.trim()}`
        : prefix

      const { error: dbErr } = await supabase.from('activities').insert({
        tree_id: treeId,
        type: eventType,
        title: title.trim(),
        description: fullDescription,
        privacy: 'family',
      })
      if (dbErr) throw dbErr
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
      position: 'fixed', inset: 0, zIndex: 9000,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: '#FAEFBC', borderRadius: '28px', padding: '36px',
        border: '2px solid #2C1810', width: '360px', maxWidth: '90vw',
        boxShadow: '0 30px 70px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: '18px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '950', color: '#2C1810', fontFamily: 'Playfair Display, serif' }}>
            Nuevo Evento
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={22} color="#2C1810" />
          </button>
        </div>

        {/* Type selector */}
        <div>
          <label style={labelStyle}>Tipo de evento</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {(Object.entries(EVENT_COLORS) as [FamilyEventType, typeof EVENT_COLORS[FamilyEventType]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setEventType(key)} style={{
                padding: '10px 6px',
                backgroundColor: eventType === key ? cfg.accent : 'rgba(44,24,16,0.06)',
                color: eventType === key ? '#fff' : '#2C1810',
                borderRadius: '12px', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: '900',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                transition: 'all 0.2s',
              }}>
                <span style={{ opacity: eventType === key ? 1 : 0.7 }}>{cfg.icon}</span>
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

        {/* Member (optional) */}
        <div>
          <label style={labelStyle}>Miembro relacionado (opcional)</label>
          <select value={memberId} onChange={e => setMemberId(e.target.value)} style={inputStyle}>
            <option value="">— Ninguno —</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Nota (opcional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Agrega un detalle o recordatorio..."
            style={{ ...inputStyle, resize: 'none', height: 'auto' }}
          />
        </div>

        {error && <p style={{ margin: 0, fontSize: '12px', color: '#c62828', fontWeight: '700' }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: '100%', padding: '15px',
            backgroundColor: '#2C1810', color: '#FAEFBC',
            borderRadius: '14px', border: 'none',
            fontSize: '14px', fontWeight: '950',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            boxShadow: '0 8px 20px rgba(44,24,16,0.2)',
          }}
        >
          {saving ? 'Guardando...' : '✨ Guardar Evento'}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EventsPanel({ members, treeId }: EventsPanelProps) {
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<FamilyEventType | 'all'>('all')

  // Derive auto-birthday events from members
  const autoEvents = React.useMemo<FamilyEvent[]>(() => {
    return members
      .filter(m => m.dateOfBirth && !m.dateOfDeath)
      .map(m => ({
        id: `auto-birthday-${m.id}`,
        treeId,
        title: `${m.firstName} ${m.lastName}`,
        description: m.occupation || undefined,
        eventType: 'birthday' as FamilyEventType,
        eventDate: m.dateOfBirth!.substring(0, 10),
        memberId: m.id,
        privacy: 'core' as const,
      }))
  }, [members, treeId])

  const fetchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('tree_id', treeId)
        .in('type', ['birthday', 'anniversary', 'memorial', 'reunion', 'custom'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Parse encoded fields from description: [EVDATE:YYYY-MM-DD][EVTYPE:type][EVMEM:id] note
      const mapped: FamilyEvent[] = (data || [])
        .filter((a: any) => {
          const desc = a.description || ''
          return desc.includes('[EVDATE:')
        })
        .map((a: any) => {
          const desc = a.description || ''
          const dateMatch = desc.match(/\[EVDATE:(\d{4}-\d{2}-\d{2})\]/)
          const typeMatch = desc.match(/\[EVTYPE:([a-z]+)\]/)
          const memMatch  = desc.match(/\[EVMEM:([^\]]+)\]/)
          // Strip encoded prefix to get user's note
          const note = desc.replace(/\[EV[A-Z]+:[^\]]*\]/g, '').trim() || null
          return {
            id: a.id,
            treeId: a.tree_id,
            title: a.title,
            description: note,
            eventType: ((typeMatch?.[1] || a.type) as FamilyEventType),
            eventDate: dateMatch?.[1] ?? a.created_at.substring(0, 10),
            memberId: memMatch?.[1] || null,
            imageUrl: a.image_url || null,
            privacy: a.privacy || 'family',
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
    if (!confirm('¿Eliminar este evento?')) return
    await supabase.from('activities').delete().eq('id', id)
    fetchEvents()
  }

  // Merge auto-birthdays + custom events, then sort by next occurrence
  const allEvents = React.useMemo(() => {
    const merged = [...autoEvents, ...events]
    // Remove duplicates (custom birthday that matches an auto-birthday)
    const seen = new Set<string>()
    const unique = merged.filter(e => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })
    return unique
      .filter(e => filter === 'all' || e.eventType === filter)
      .sort((a, b) => daysUntil(nextOccurrence(a.eventDate)) - daysUntil(nextOccurrence(b.eventDate)))
  }, [autoEvents, events, filter])

  const upcoming30 = allEvents.filter(e => daysUntil(nextOccurrence(e.eventDate)) <= 30)
  const later = allEvents.filter(e => daysUntil(nextOccurrence(e.eventDate)) > 30)

  return (
    <>
      {/* Filter strip */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {(['all', 'birthday', 'anniversary', 'memorial', 'reunion', 'custom'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em',
              backgroundColor: filter === f ? '#2C1810' : 'rgba(44,24,16,0.08)',
              color: filter === f ? '#FAEFBC' : '#2C1810',
              transition: 'all 0.2s',
            }}
          >
            {f === 'all' ? 'Todos' : EVENT_COLORS[f as FamilyEventType].label}
          </button>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          width: '100%', padding: '12px',
          backgroundColor: '#2C1810', color: '#FAEFBC',
          borderRadius: '14px', border: 'none', cursor: 'pointer',
          fontSize: '13px', fontWeight: '950',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginBottom: '18px',
          boxShadow: '0 6px 16px rgba(44,24,16,0.2)',
        }}
      >
        <Plus size={16} /> Agregar Evento
      </button>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid rgba(44,24,16,0.1)', borderTopColor: '#2C1810', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : allEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 16px', color: '#2C1810', opacity: 0.5 }}>
          <Calendar size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700' }}>Sin eventos registrados</p>
          <p style={{ margin: '6px 0 0', fontSize: '11px' }}>Agrega el primer evento familiar</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {upcoming30.length > 0 && (
            <section>
              <SectionHeader icon={<ChevronRight size={12} />} label="Próximos 30 días" count={upcoming30.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming30.map(e => <EventCard key={e.id} event={e} onDelete={handleDelete} />)}
              </div>
            </section>
          )}
          {later.length > 0 && (
            <section>
              <SectionHeader icon={<Calendar size={12} />} label="Más adelante" count={later.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {later.map(e => <EventCard key={e.id} event={e} onDelete={handleDelete} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {showModal && (
        <CreateEventModal
          treeId={treeId}
          members={members}
          onClose={() => setShowModal(false)}
          onSave={fetchEvents}
        />
      )}
    </>
  )
}

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      <span style={{ color: '#2C1810', opacity: 0.5 }}>{icon}</span>
      <span style={{ fontSize: '10px', fontWeight: '900', color: '#2C1810', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', fontWeight: '900', backgroundColor: '#2C1810', color: '#FAEFBC', borderRadius: '10px', padding: '1px 7px' }}>
        {count}
      </span>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '10px', fontWeight: '900',
  color: '#2C1810', opacity: 0.6, textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  backgroundColor: 'rgba(255,255,255,0.6)',
  border: '1.5px solid rgba(44,24,16,0.2)',
  borderRadius: '12px', fontSize: '14px',
  color: '#2C1810', fontWeight: '700',
  outline: 'none', boxSizing: 'border-box',
}
