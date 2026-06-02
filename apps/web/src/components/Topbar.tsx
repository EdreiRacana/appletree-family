'use client'

import React from 'react'
import { Search, Bell, User, Plus, Share2, Settings, HelpCircle, Shield, LogOut } from 'lucide-react'
import type { AppNotification } from '@/lib/useNotifications'

interface TopbarProps {
  onAdd?: () => void
  viewFocus?: 'all' | 'paternal' | 'maternal'
  onViewFocusChange?: (focus: 'all' | 'paternal' | 'maternal') => void
  notificationCount?: number
  notifications?: AppNotification[]
  onStartMyTree?: () => void
  onShowTutorial?: () => void
  onShowTerms?: () => void
  onClearNotifications?: () => void
  onNotificationClick?: (action: AppNotification['action']) => void
  userAvatarUrl?: string | null
  currentUser?: string
  onLogout?: () => void
  showStartTreeBtn?: boolean
}

export default function Topbar({ 
  onAdd, 
  viewFocus = 'all', 
  onViewFocusChange, 
  notificationCount = 0,
  notifications = [],
  onStartMyTree, 
  onShowTutorial,
  onShowTerms,
  onClearNotifications,
  onNotificationClick,
  userAvatarUrl,
  currentUser,
  onLogout,
  showStartTreeBtn = false 
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = React.useState(false)
  const [showUserMenu, setShowUserMenu] = React.useState(false)
  return (
    <header 
      className="topbar-container"
      style={{
        height: '76px',
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: '#0F1A0F',
        backgroundImage: 'linear-gradient(to right, #0F1A0F 0%, #1B2E1B 50%, #254025 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px',
        zIndex: 2000,
        boxShadow: '0 6px 28px rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(212,175,55,0.3)'
      }}
    >
      {/* 1. ICON-FIRST BRANDING - LEFT ALIGNED & SYMMETRICAL */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
        <div 
          className="brand-logo-container"
          style={{ 
            height: '56px',
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
              fontSize: '21px', 
              fontWeight: '600', 
              background: 'linear-gradient(180deg, #E8DAB2 0%, #C5A059 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Cormorant Garamond, serif',
              margin: 0,
              letterSpacing: '0.04em',
              lineHeight: 1,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              textAlign: 'center',
              textTransform: 'none'
            }}
          >
            AppleFamily Tree
          </h1>
        </div>
      </div>

      {/* 2. Global Navigation / Search & Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: viewFocus === opt.id ? '#D4AF37' : 'transparent',
                color: viewFocus === opt.id ? '#0F1A0F' : '#E8DAB2',
                fontSize: '10px',
                fontWeight: '700',
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
            width: '300px', 
            height: '38px',
            backgroundColor: 'rgba(232, 218, 183, 0.12)',
            backdropFilter: 'blur(20px)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            border: '1px solid rgba(212,175,55,0.22)'
          }}
        >
          <Search size={18} color="#F5E6C8" style={{ opacity: 0.6 }} />
          <input 
            type="text" 
            placeholder="Search family..." 
            style={{
              background: 'none', border: 'none', outline: 'none', color: '#F5E6C8',
              fontSize: '13px', marginLeft: '12px', width: '100%', fontWeight: '600'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {showStartTreeBtn && (
          <button 
            onClick={onStartMyTree}
            style={{ 
              padding: '9px 18px', 
              backgroundColor: '#D4AF37', 
              color: '#0F1A0F', 
              borderRadius: '10px', 
              border: 'none', 
              fontWeight: '700', 
              fontSize: '12px', 
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
          style={{ width: '38px', height: '38px', backgroundColor: 'rgba(232,218,183,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212,175,55,0.18)', cursor: 'pointer' }}
        >
          <Plus size={18} color="#F5E6C8" />
        </button>
        <button 
          className="topbar-btn" 
          onClick={onShowTutorial}
          title="Ver Tutorial"
          style={{ width: '38px', height: '38px', backgroundColor: 'rgba(232,218,183,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212,175,55,0.18)', cursor: 'pointer' }}
        >
          <HelpCircle size={18} color="#F5E6C8" />
        </button>
        <button 
          className="topbar-btn" 
          onClick={onShowTerms}
          title="Términos y Condiciones"
          style={{ width: '38px', height: '38px', backgroundColor: 'rgba(232,218,183,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212,175,55,0.18)', cursor: 'pointer' }}
        >
          <Shield size={18} color="#F5E6C8" />
        </button>
        <div style={{ position: 'relative' }}>
          <button 
            className="topbar-btn" 
            title="Perfil de Usuario"
            onClick={() => setShowUserMenu(v => !v)}
            style={{ 
              width: '38px', height: '38px', 
              backgroundColor: showUserMenu ? 'rgba(212,175,55,0.22)' : 'rgba(232,218,183,0.08)', 
              borderRadius: '10px', 
              border: '1px solid rgba(212,175,55,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <UserIconWrapper url={userAvatarUrl} />
          </button>

          {showUserMenu && (
            <>
              <div onClick={() => setShowUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 2900 }} />
              <div style={{
                position: 'absolute', top: '46px', right: 0, width: '210px',
                backgroundColor: '#FAEFBC', borderRadius: '16px', border: '1px solid rgba(212,175,55,0.4)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 3000, overflow: 'hidden',
                animation: 'modalFadeIn 0.2s ease-out'
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(44,24,16,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#2C1810', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserIconWrapper url={userAvatarUrl} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#2C1810', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser || 'Mi cuenta'}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#2C1810', opacity: 0.55 }}>Sesión activa</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); onLogout?.() }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#8B2C1C', fontSize: '13px', fontWeight: 700, textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(139,44,28,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button 
            className="topbar-btn"
            onClick={() => {
              setShowNotifications(!showNotifications)
              if (notificationCount > 0) onClearNotifications?.()
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Bell size={20} color="#D4AF37" />
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
              position: 'absolute', top: '40px', right: '0', width: '320px',
              backgroundColor: '#FAEFBC', borderRadius: '20px', border: '2px solid #D4AF37',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 3000, overflow: 'hidden',
              animation: 'modalFadeIn 0.2s ease-out'
            }}>
              {/* Header */}
              <div style={{ padding: '14px 18px', backgroundColor: '#D4AF37', color: '#0F1A0F', fontWeight: '900', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🔔 Notificaciones</span>
                {notificationCount > 0 && (
                  <span style={{ fontSize: '11px', backgroundColor: '#0F1A0F', color: '#D4AF37', borderRadius: '20px', padding: '2px 8px', fontWeight: '900' }}>
                    {notificationCount} nueva{notificationCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* List */}
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '30px 18px', textAlign: 'center', color: '#2C1810', opacity: 0.45 }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🌿</div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '700' }}>Sin notificaciones nuevas</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        onNotificationClick?.(n.action)
                        setShowNotifications(false)
                      }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '13px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)',
                        display: 'flex', flexDirection: 'column', gap: '4px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(212,175,55,0.15)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <p style={{ margin: 0, fontSize: '13px', color: '#2C1810', lineHeight: '1.45', fontWeight: '700' }}>{n.text}</p>
                      <span style={{ fontSize: '10px', color: '#8B4513', opacity: 0.65, fontWeight: '700' }}>{n.time} · {n.action === 'open_events' ? 'Ver Eventos →' : 'Ver Historias →'}</span>
                    </button>
                  ))
                )}
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
  return <User size={18} color="#F5E6C8" />
}
