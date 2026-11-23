'use client'

import React, { useState, type CSSProperties } from 'react'
import { X, Send, Mail, Shield, MessageCircle, Link as LinkIcon, Check } from 'lucide-react'
import type { Member } from '@/lib/types'

// Invitar a un familiar a su manzana: por correo, WhatsApp o enlace.
// Diseño "vidrio" como el resto de la app (fondo translúcido, letras doradas)
// y con los colores del tema (claro / oscuro).

interface InviteMemberModalProps {
  member: Member
  onClose: () => void
  onSend: (email: string, side: string, message: string) => void | Promise<void>
  // Genera el link con token de invitación y lo devuelve. Para WhatsApp/copiar.
  onCreateLink?: (side: string, message: string) => Promise<string | null>
}

// Ya no hay "linaje": cada familia es su propio árbol (lista de familias).
const SIDE = 'both'

export default function InviteMemberModal({ member, onClose, onSend, onCreateLink }: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(`¡Hola! Te invito a unirte a nuestro árbol familiar en AppleFamily Tree. Tu manzana ya te está esperando.`)
  const [isSending, setIsSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false)
  const [copyingLink, setCopyingLink] = useState(false)
  const [copiedOk, setCopiedOk] = useState(false)

  const fullName = `${member.firstName}${member.lastName ? ' ' + member.lastName : ''}`
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const handleSend = async () => {
    if (!validEmail) return
    setIsSending(true)
    try {
      await onSend(email.trim(), SIDE, message)
      setSuccess(true)
      setTimeout(onClose, 1800)
    } catch {
      // el padre ya mostró el aviso; solo quitar el "enviando"
    } finally {
      setIsSending(false)
    }
  }

  const shareWhatsApp = async () => {
    if (!onCreateLink || sharingWhatsApp) return
    setSharingWhatsApp(true)
    try {
      const url = await onCreateLink(SIDE, message)
      if (!url) return
      const text = `${message}\n\nEstás invitado como *${fullName}* a nuestro árbol familiar.\nEntra aquí: ${url}`
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      onClose()
    } finally {
      setSharingWhatsApp(false)
    }
  }

  const copyLink = async () => {
    if (!onCreateLink || copyingLink) return
    setCopyingLink(true)
    try {
      const url = await onCreateLink(SIDE, message)
      if (!url) return
      await navigator.clipboard.writeText(url)
      setCopiedOk(true)
      setTimeout(() => setCopiedOk(false), 2200)
    } catch {
      alert('No se pudo copiar. Intenta de nuevo.')
    } finally {
      setCopyingLink(false)
    }
  }

  const initials = `${member.firstName?.[0] ?? ''}${member.lastName?.[0] ?? ''}`.toUpperCase()

  return (
    <div role="dialog" aria-modal="true" aria-label={`Invitar a ${fullName}`} onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={card}>
        {/* Brillo dorado sutil arriba */}
        <div aria-hidden style={glow} />

        {success && (
          <div style={successLayer}>
            <div style={successIcon}><Check size={38} color="#16201A" strokeWidth={3} /></div>
            <h2 style={{ ...title, fontSize: 24, margin: 0 }}>¡Invitación enviada!</h2>
            <p style={{ margin: 0, color: 'var(--menu-fg)', opacity: 0.7, fontSize: 13 }}>
              Le llegará un correo a {email.trim()}
            </p>
          </div>
        )}

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '22px 22px 6px', position: 'relative' }}>
          <div style={avatar}>
            {member.avatarUrl
              ? <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: 'var(--accent-gold)' }}>{initials}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={title}>Invitar a la familia</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--menu-fg)', opacity: 0.75 }}>
              Su manzana: <strong style={{ color: 'var(--accent-gold)' }}>{fullName}</strong>
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={closeBtn}><X size={20} /></button>
        </div>

        <div style={{ padding: '14px 22px 22px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {/* Correo */}
          <label style={fieldLabel}>
            Correo electrónico
            <div style={{ position: 'relative', marginTop: 7 }}>
              <Mail size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-gold)', opacity: 0.8 }} />
              <input type="email" inputMode="email" autoComplete="off" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSend() }}
                placeholder="ejemplo@correo.com" style={{ ...input, paddingLeft: 42 }} />
            </div>
          </label>

          {/* Mensaje */}
          <label style={fieldLabel}>
            Mensaje personal <span style={{ opacity: 0.6, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
            <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500}
              style={{ ...input, marginTop: 7, minHeight: 92, resize: 'none', lineHeight: 1.5, padding: '12px 14px' }} />
          </label>

          {/* Privacidad */}
          <div style={note}>
            <Shield size={17} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
            <span>La invitación es privada: el enlace solo sirve para <strong>{member.firstName}</strong> y su manzana.</span>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
            <button onClick={handleSend} disabled={!validEmail || isSending}
              style={{ ...primaryBtn, opacity: !validEmail || isSending ? 0.55 : 1, cursor: !validEmail ? 'not-allowed' : 'pointer' }}>
              {isSending ? <span style={spinner} /> : <><Send size={17} /> Enviar por correo</>}
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={shareWhatsApp} disabled={!onCreateLink || sharingWhatsApp} style={{ ...ghostBtn, flex: 1, color: '#25D366', borderColor: 'rgba(37,211,102,0.55)' }}>
                <MessageCircle size={17} /> {sharingWhatsApp ? 'Generando…' : 'WhatsApp'}
              </button>
              <button onClick={copyLink} disabled={!onCreateLink || copyingLink}
                style={{ ...ghostBtn, flex: 1, ...(copiedOk ? { background: 'rgba(46,125,50,0.18)', borderColor: '#2E7D32', color: '#3FA34D' } : {}) }}>
                {copiedOk ? <><Check size={17} /> ¡Copiado!</> : <><LinkIcon size={17} /> {copyingLink ? 'Generando…' : 'Copiar enlace'}</>}
              </button>
            </div>
            <button onClick={onClose} style={cancelBtn}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 5000, padding: 16,
  background: 'var(--glass-overlay)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const card: CSSProperties = {
  position: 'relative', width: '100%', maxWidth: 480, maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
  borderRadius: 24, overflow: 'hidden', color: 'var(--menu-fg)',
  background: 'var(--glass-card-bg)', border: '1px solid var(--menu-border)',
  backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
  animation: 'afModalIn 0.28s ease-out',
}
const glow: CSSProperties = {
  position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 380, height: 200,
  background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.22), transparent 70%)', pointerEvents: 'none',
}
const title: CSSProperties = {
  margin: 0, fontFamily: "'Playfair Display', 'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600,
  color: 'var(--accent-gold)', letterSpacing: '0.01em',
}
const avatar: CSSProperties = {
  width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '2px solid var(--accent-gold)', background: 'var(--accent-gold-soft)',
  boxShadow: '0 0 0 4px var(--accent-gold-soft)',
}
const closeBtn: CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: '1px solid var(--menu-border)', background: 'transparent',
  color: 'var(--menu-fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const fieldLabel: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-gold)',
}
const input: CSSProperties = {
  width: '100%', height: 46, padding: '0 14px', borderRadius: 13, outline: 'none',
  border: '1px solid var(--menu-border)', background: 'var(--menu-input-bg)', color: 'var(--menu-fg)',
  fontSize: 15, fontWeight: 500, fontFamily: 'inherit', textTransform: 'none', letterSpacing: 0,
}
const note: CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'center', padding: '11px 13px', borderRadius: 13,
  background: 'var(--accent-gold-soft)', border: '1px solid var(--menu-border)', fontSize: 12.5, lineHeight: 1.45,
}
const primaryBtn: CSSProperties = {
  width: '100%', height: 50, borderRadius: 14, border: 'none',
  background: 'linear-gradient(180deg, #E2C15A 0%, #C9A23A 55%, #B08A2A 100%)', color: '#1A1408',
  fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  boxShadow: '0 10px 24px rgba(184,134,11,0.32), inset 0 1px 0 rgba(255,255,255,0.35)',
}
const ghostBtn: CSSProperties = {
  height: 46, borderRadius: 13, border: '1px solid var(--menu-border)', background: 'transparent',
  color: 'var(--accent-gold)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s ease',
}
const cancelBtn: CSSProperties = {
  height: 38, border: 'none', background: 'transparent', color: 'var(--menu-fg)', opacity: 0.65,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const successLayer: CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 14, background: 'var(--glass-card-bg)', backdropFilter: 'blur(22px)',
}
const successIcon: CSSProperties = {
  width: 76, height: 76, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(180deg, #E2C15A, #B08A2A)', boxShadow: '0 12px 30px rgba(184,134,11,0.4)',
}
const spinner: CSSProperties = {
  width: 20, height: 20, borderRadius: '50%', border: '2px solid #1A1408', borderTopColor: 'transparent',
  animation: 'afSpin 0.8s linear infinite',
}
