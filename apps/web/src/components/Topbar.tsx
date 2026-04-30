'use client'

import React from 'react'
import { Search, Bell, User, Plus, Share2, Settings, HelpCircle, Shield } from 'lucide-react'

interface TopbarProps {
  onAdd?: () => void
  viewFocus?: 'all' | 'paternal' | 'maternal'
  onViewFocusChange?: (focus: 'all' | 'paternal' | 'maternal') => void
  notificationCount?: number
  onStartMyTree?: () => void
  onShowTutorial?: () => void
  onShowTerms?: () => void
  onClearNotifications?: () => void
  userAvatarUrl?: string | null
  showStartTreeBtn?: boolean
}

export default function Topbar({ 
  onAdd, 
  viewFocus = 'all', 
  onViewFocusChange, 
  notificationCount = 1, 
  onStartMyTree, 
  onShowTutorial,
  onShowTerms,
  onClearNotifications,
  userAvatarUrl,
  showStartTreeBtn = false 
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = React.useState(false)

  const notifications = [
    { id: 1, text: '✨ ¡Bienvenido Francisco Jr! Tu legado familiar te espera.', time: 'Ahora' },
    { id: 2, text: '📸 Se ha añadido una nueva foto al álbum "Recuerdos 1990".', time: 'Hace 2h' },
    { id: 3, text: '🎂 Mañana es el cumpleaños de Francisco Elias.', time: 'Próximamente' }
  ]
  return (
    <header 
      className="topbar-container"
      style={{
        height: '140px',
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: '#0F1A0F',
        backgroundImage: 'linear-gradient(to right, #0F1A0F 0%, #1B2E1B 50%, #254025 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 30px', 
        zIndex: 2000,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        borderBottom: '3px solid #D4AF37'
      }}
    >
      {/* 1. ICON-FIRST BRANDING - LEFT ALIGNED & SYMMETRICAL */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        <div 
          className="brand-logo-container"
          style={{ 
            height: '70px',
            width: 'auto',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}
        >
          <img 
            src="/assets/logo.png" 
            alt="AppleTree Family Logo" 
            style={{ 
              height: '100%', 
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2px' }}>
          <h1 
            className="brand-title"
            style={{ 
              fontSize: '18px', 
              fontWeight: '900', 
              background: 'linear-gradient(180deg, #E8DAB2 0%, #C5A059 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Playfair Display, serif',
              margin: 0,
              letterSpacing: '0.04em',
              lineHeight: 1,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              textAlign: 'center',
              textTransform: 'uppercase'
            }}
          >
            AppleFamily Tree
          </h1>
        </div>
      </div>

      {/* 2. Global Navigation / Search & Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
        {/* Toggle Switch */}
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'rgba(232, 218, 183, 0.1)', 
          borderRadius: '12px', 
          padding: '4px',
          border: '1px solid rgba(212, 175, 55, 0.3)'
        }}>
          {[
            { id: 'paternal', label: 'Paterna' },
            { id: 'all', label: 'Ambas' },
            { id: 'maternal', label: 'Materna' }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => onViewFocusChange?.(opt.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: viewFocus === opt.id ? '#D4AF37' : 'transparent',
                color: viewFocus === opt.id ? '#0F1A0F' : '#E8DAB2',
                fontSize: '11px',
                fontWeight: '900',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div 
          className="mobile-hide"
          style={{ 
            width: '400px', 
            height: '48px',
            backgroundColor: 'rgba(232, 218, 183, 0.12)',
            backdropFilter: 'blur(20px)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            border: '2px solid rgba(212, 175, 55, 0.25)'
          }}
        >
          <Search size={18} color="#F5E6C8" style={{ opacity: 0.6 }} />
          <input 
            type="text" 
            placeholder="Search family..." 
            style={{
              background: 'none', border: 'none', outline: 'none', color: '#F5E6C8',
              fontSize: '14px', marginLeft: '12px', width: '100%', fontWeight: '700'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
        {showStartTreeBtn && (
          <button 
            onClick={onStartMyTree}
            style={{ 
              padding: '12px 24px', 
              backgroundColor: '#D4AF37', 
              color: '#0F1A0F', 
              borderRadius: '12px', 
              border: 'none', 
              fontWeight: '900', 
              fontSize: '14px', 
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)'
            }}
          >
            Empezar Mi Árbol
          </button>
        )}
        <button 
          className="topbar-btn" 
          onClick={onAdd}
          title="Añadir Familiar"
          style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={28} color="#F5E6C8" />
        </button>
        <button 
          className="topbar-btn" 
          onClick={onShowTutorial}
          title="Ver Tutorial"
          style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
        >
          <HelpCircle size={28} color="#F5E6C8" />
        </button>
        <button 
          className="topbar-btn" 
          onClick={onShowTerms}
          title="Términos y Condiciones"
          style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
        >
          <Shield size={28} color="#F5E6C8" />
        </button>
        <button 
          className="topbar-btn" 
          title="Perfil de Usuario"
          style={{ 
            width: '50px', height: '50px', 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            borderRadius: '15px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            border: 'none', cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <UserIconWrapper url={userAvatarUrl} />
        </button>
        <div style={{ position: 'relative' }}>
          <button 
            className="topbar-btn"
            onClick={() => {
              setShowNotifications(!showNotifications)
              if (notificationCount > 0) onClearNotifications?.()
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Bell size={32} color="#D4AF37" />
            {notificationCount > 0 && (
              <div style={{ 
                position: 'absolute', top: '-5px', right: '-5px', 
                width: '18px', height: '18px', background: '#FF4B2B', 
                borderRadius: '50%', color: 'white', fontSize: '10px', 
                fontWeight: '950', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #0F1A0F'
              }}>{notificationCount}</div>
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute', top: '50px', right: '0', width: '300px',
              backgroundColor: '#FAEFBC', borderRadius: '16px', border: '2px solid #D4AF37',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 3000, overflow: 'hidden',
              animation: 'modalFadeIn 0.2s ease-out'
            }}>
              <div style={{ padding: '15px', borderBottom: '1px solid rgba(212,175,55,0.2)', backgroundColor: '#D4AF37', color: '#0F1A0F', fontWeight: 'bold', fontSize: '14px' }}>
                Notificaciones Familiares
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div key={n.id} style={{ padding: '12px 15px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#2C1810', lineHeight: '1.4' }}>{n.text}</p>
                    <span style={{ fontSize: '10px', color: '#8B4513', opacity: 0.6 }}>{n.time}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '12px', color: '#8B4513', backgroundColor: 'rgba(212,175,55,0.05)' }}>
                Ver toda la actividad
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function UserIconWrapper({ url }: { url?: string | null }) {
  const [error, setError] = React.useState(false)
  if (url && !error) {
    return (
      <img 
        src={url} 
        alt="User" 
        onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
      />
    )
  }
  return <User size={28} color="#F5E6C8" />
}
