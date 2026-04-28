'use client'

import React, { useState } from 'react'
import { X, Send, Mail, Shield, TreePine, Info, MessageCircle } from 'lucide-react'
import type { Member } from '@/lib/types'

interface InviteMemberModalProps {
  member: Member
  onClose: () => void
  onSend: (email: string, side: string, message: string) => void
}

export default function InviteMemberModal({ member, onClose, onSend }: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(`¡Hola! Te invito a unirte a nuestro árbol genealógico familiar en AppleTree para que nos ayudes a documentar nuestra historia.`)
  const [isSending, setIsSending] = useState(false)
  const [success, setSuccess] = useState(false)

  // Automatic side detection based on some logic (mocked for now)
  // In a real app, we'd check the lineage relationship
  const suggestedSide = member.lastName === 'Racana' ? 'materna' : 'paterna'
  const [side, setSide] = useState<'paternal' | 'maternal' | 'both'>('both')

  const handleSend = async () => {
    if (!email) return
    setIsSending(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    onSend(email, side, message)
    setIsSending(false)
    setSuccess(true)
    
    setTimeout(onClose, 2000)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 26, 15, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5000,
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '550px',
        width: '100%',
        backgroundColor: '#FAEFBC',
        borderRadius: '32px',
        border: '3px solid #2C1810',
        boxShadow: '0 30px 100px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Success Overlay */}
        {success && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#FAEFBC',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px'
          }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#2C1810', 
              display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              <Send color="#FAEFBC" size={40} />
            </div>
            <h2 style={{ fontFamily: 'serif', color: '#2C1810', margin: 0 }}>¡Invitación Enviada!</h2>
            <p style={{ color: '#2C1810', opacity: 0.6, fontWeight: '700' }}>Redireccionando...</p>
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '30px', backgroundColor: '#2C1810', color: '#FAEFBC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'serif', fontSize: '24px' }}>Invitar a la Familia</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.7, fontWeight: '700' }}>
              Enviando acceso para: <span style={{ color: '#D4AF37' }}>{member.firstName} {member.lastName}</span>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#FAEFBC', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* Email Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '900', color: '#2C1810', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Correo Electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '15px', top: '15px', opacity: 0.4 }} size={20} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                style={{
                  width: '100%',
                  padding: '15px 15px 15px 50px',
                  borderRadius: '16px',
                  border: '2px solid rgba(44, 24, 16, 0.1)',
                  backgroundColor: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  outline: 'none',
                  color: '#2C1810'
                }}
              />
            </div>
          </div>

          {/* Lineage Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '900', color: '#2C1810', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Acceso de Linaje <Info size={14} />
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { id: 'paternal', label: 'Paterno' },
                { id: 'both', label: 'Ambos' },
                { id: 'maternal', label: 'Materno' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSide(opt.id as any)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: side === opt.id ? '#2C1810' : 'rgba(44, 24, 16, 0.1)',
                    backgroundColor: side === opt.id ? '#2C1810' : 'transparent',
                    color: side === opt.id ? '#FAEFBC' : '#2C1810',
                    fontSize: '13px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#7A6558', fontStyle: 'italic' }}>
              * Al seleccionar un linaje, el familiar verá ese árbol por defecto al entrar.
            </p>
          </div>

          {/* Message */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '900', color: '#2C1810', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mensaje Personal (Opcional)
            </label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '16px',
                border: '2px solid rgba(44, 24, 16, 0.1)',
                backgroundColor: 'rgba(255,255,255,0.5)',
                fontSize: '14px',
                fontWeight: '600',
                outline: 'none',
                color: '#2C1810',
                minHeight: '100px',
                resize: 'none'
              }}
            />
          </div>

          {/* Security Note */}
          <div style={{ 
            display: 'flex', gap: '15px', alignItems: 'center', padding: '15px', 
            backgroundColor: 'rgba(44, 24, 16, 0.05)', borderRadius: '16px' 
          }}>
            <Shield size={20} color="#D4822A" />
            <p style={{ margin: 0, fontSize: '12px', color: '#7A6558', fontWeight: '600', lineHeight: '1.4' }}>
              Las invitaciones son privadas. Solo este familiar podrá ver los datos que compartas en este árbol.
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={handleSend}
              disabled={!email || isSending}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#D4822A',
                color: 'white',
                borderRadius: '16px',
                border: 'none',
                fontSize: '15px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                opacity: (!email || isSending) ? 0.6 : 1,
                boxShadow: '0 8px 25px rgba(212, 130, 42, 0.3)'
              }}
            >
              {isSending ? (
                <div className="animate-spin" style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
              ) : (
                <>
                  <Send size={18} />
                  Enviar por Correo
                </>
              )}
            </button>
            
            <button 
              onClick={() => {
                const encodedMessage = encodeURIComponent(`${message}\n\nEntra aquí: https://appletree.family/invite/token123`);
                window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
                onClose();
              }}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#25D366',
                color: 'white',
                borderRadius: '16px',
                border: 'none',
                fontSize: '15px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 8px 25px rgba(37, 211, 102, 0.3)'
              }}
            >
              <MessageCircle size={18} />
              Enviar por WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
