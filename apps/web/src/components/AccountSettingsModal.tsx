'use client'

// AppleTree Family — Modal de configuración de cuenta
//
// Dos secciones:
//   1. Cambiar contraseña (pide actual + nueva + confirmar)
//   2. Cambiar correo (Supabase manda verificación al correo nuevo)
//
// Ambas usan supabase.auth.updateUser(). Supabase requiere una sesión activa
// para llamar updateUser, y ya la tenemos porque el usuario está logueado.

import React, { useState, useEffect } from 'react'
import { X, Lock, Mail, Check, Eye, EyeOff, Bell, BellOff, Shield, AlertTriangle, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushClient'
import AdminsPanel from '@/components/AdminsPanel'
import type { Member } from '@/lib/types'

interface AccountSettingsModalProps {
  currentEmail: string
  onClose: () => void
  // Contexto opcional para mostrar la pestaña "Administradores". Si no se
  // pasan estos props, esa pestaña no se muestra.
  treeId?: string | null
  isAdmin?: boolean
  isOwner?: boolean
  members?: Member[]
}

type Tab = 'password' | 'email' | 'notifications' | 'admins' | 'danger'

export default function AccountSettingsModal({ currentEmail, onClose, treeId, isAdmin, isOwner, members }: AccountSettingsModalProps) {
  const [tab, setTab] = useState<Tab>('password')

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  // Email state
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)

  // Push notifications state
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('unsupported')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    setPushStatus(getPermissionStatus())
  }, [tab])

  const handleTogglePush = async () => {
    setPushBusy(true)
    setPushError(null)
    try {
      if (pushStatus === 'granted') {
        await unsubscribeFromPush()
      } else {
        const res = await subscribeToPush()
        if (!res.ok) {
          setPushError(
            res.reason === 'denied' ? 'Permiso denegado. Actívalo en la configuración del navegador.'
            : res.reason === 'vapid-missing' ? 'Falta configurar VAPID_PUBLIC_KEY en el servidor.'
            : res.reason === 'unsupported' ? 'Tu navegador no soporta notificaciones push.'
            : 'No se pudo activar. Intenta de nuevo.'
          )
        }
      }
      setPushStatus(getPermissionStatus())
    } finally {
      setPushBusy(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'BORRAR') {
      setDeleteError('Debes escribir exactamente BORRAR para confirmar.')
      return
    }
    if (!deletePassword) {
      setDeleteError('Ingresa tu contraseña actual.')
      return
    }
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesión no encontrada')
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: session.access_token,
          password: deletePassword,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'No se pudo borrar la cuenta')
      await supabase.auth.signOut()
      window.localStorage.clear()
      window.location.href = '/'
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al borrar la cuenta')
      setDeleteBusy(false)
    }
  }

  const handleChangePassword = async () => {
    setPwError(null)
    setPwSuccess(false)
    if (!currentPassword || !newPassword) {
      setPwError('Todos los campos son obligatorios.')
      return
    }
    if (newPassword.length < 6) {
      setPwError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas nuevas no coinciden.')
      return
    }
    setPwLoading(true)
    try {
      // Re-autenticación con la contraseña actual. Supabase updateUser no la
      // pide, pero sin verificarla dejaríamos que cualquiera con acceso a
      // una sesión activa cambie la clave (ej. computadora abandonada).
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      })
      if (reAuthErr) {
        setPwError('La contraseña actual es incorrecta.')
        return
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPwError(error.message)
        return
      }
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setPwLoading(false)
    }
  }

  const handleChangeEmail = async () => {
    setEmailError(null)
    setEmailSuccess(false)
    if (!newEmail) {
      setEmailError('Escribe el correo nuevo.')
      return
    }
    if (newEmail === currentEmail) {
      setEmailError('El correo nuevo es igual al actual.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('El correo no tiene un formato válido.')
      return
    }
    setEmailLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (error) {
        setEmailError(error.message)
        return
      }
      setEmailSuccess(true)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setEmailLoading(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Configuración de Cuenta</h2>
            <p style={subtitleStyle}>Cambia contraseña, correo o notificaciones.</p>
          </div>
          <button onClick={onClose} style={closeButtonStyle} title="Cerrar">
            <X size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div style={tabsWrapperStyle}>
          <button
            onClick={() => setTab('password')}
            style={{ ...tabButtonStyle, ...(tab === 'password' ? tabActiveStyle : {}) }}
          >
            <Lock size={14} /> Contraseña
          </button>
          <button
            onClick={() => setTab('email')}
            style={{ ...tabButtonStyle, ...(tab === 'email' ? tabActiveStyle : {}) }}
          >
            <Mail size={14} /> Correo
          </button>
          <button
            onClick={() => setTab('notifications')}
            style={{ ...tabButtonStyle, ...(tab === 'notifications' ? tabActiveStyle : {}) }}
          >
            <Bell size={14} /> Notificaciones
          </button>
          {isAdmin && treeId && (
            <button
              onClick={() => setTab('admins')}
              style={{ ...tabButtonStyle, ...(tab === 'admins' ? tabActiveStyle : {}) }}
            >
              <Shield size={14} /> Admins
            </button>
          )}
          <button
            onClick={() => setTab('danger')}
            style={{
              ...tabButtonStyle,
              ...(tab === 'danger' ? { backgroundColor: 'rgba(178,34,34,0.15)', color: '#FF4444', borderColor: 'rgba(178,34,34,0.4)' } : {}),
            }}
          >
            <AlertTriangle size={14} /> Zona peligro
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
          {tab === 'password' && (
            <>
              <div>
                <label style={labelStyle}>Contraseña actual</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  style={inputStyle}
                  placeholder="La que usas para entrar hoy"
                />
              </div>
              <div>
                <label style={labelStyle}>Nueva contraseña</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  style={inputStyle}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label style={labelStyle}>Confirmar nueva contraseña</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={inputStyle}
                  placeholder="Repite la nueva"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPasswords(v => !v)}
                style={ghostButtonStyle}
              >
                {showPasswords ? <><EyeOff size={13} /> Ocultar contraseñas</> : <><Eye size={13} /> Mostrar contraseñas</>}
              </button>
              {pwError && <div style={errorStyle}>{pwError}</div>}
              {pwSuccess && <div style={successStyle}><Check size={14} /> Contraseña actualizada.</div>}
              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                style={{ ...primaryButtonStyle, opacity: pwLoading ? 0.6 : 1, cursor: pwLoading ? 'wait' : 'pointer' }}
              >
                {pwLoading ? 'Actualizando…' : 'Cambiar contraseña'}
              </button>
            </>
          )}

          {tab === 'email' && (
            <>
              <div style={infoBoxStyle}>
                Tu correo actual: <strong>{currentEmail}</strong>
              </div>
              <div>
                <label style={labelStyle}>Nuevo correo</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  autoComplete="email"
                  style={inputStyle}
                  placeholder="nuevo@correo.com"
                />
              </div>
              <div style={warningBoxStyle}>
                <strong>Importante:</strong> Supabase te mandará un correo de
                confirmación al correo nuevo. Hasta que hagas clic en el link,
                tu correo sigue siendo el actual.
              </div>
              {emailError && <div style={errorStyle}>{emailError}</div>}
              {emailSuccess && (
                <div style={successStyle}>
                  <Check size={14} /> ¡Listo! Revisa <strong>{newEmail}</strong> para confirmar el cambio.
                </div>
              )}
              <button
                onClick={handleChangeEmail}
                disabled={emailLoading}
                style={{ ...primaryButtonStyle, opacity: emailLoading ? 0.6 : 1, cursor: emailLoading ? 'wait' : 'pointer' }}
              >
                {emailLoading ? 'Enviando…' : 'Cambiar correo'}
              </button>
            </>
          )}

          {tab === 'notifications' && (
            <>
              <div style={infoBoxStyle}>
                Activa las notificaciones push para recibir avisos en tu celular
                cuando recibas mensajes, comentarios o mensajes del Buzón — incluso
                con AppleFamily cerrada.
              </div>
              <div style={{
                padding: '16px 18px', borderRadius: '14px',
                backgroundColor: pushStatus === 'granted' ? 'rgba(34,139,34,0.08)' : 'rgba(139,69,19,0.05)',
                border: pushStatus === 'granted' ? '1px solid rgba(34,139,34,0.35)' : '1px solid rgba(139,69,19,0.15)',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  backgroundColor: pushStatus === 'granted' ? '#228B22' : '#8B4513',
                  color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {pushStatus === 'granted' ? <Bell size={20} /> : <BellOff size={20} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#2C1810' }}>
                    {pushStatus === 'granted' ? 'Notificaciones activas'
                     : pushStatus === 'denied' ? 'Notificaciones bloqueadas'
                     : pushStatus === 'unsupported' ? 'Tu navegador no soporta push'
                     : 'Notificaciones desactivadas'}
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.7, color: '#5D4037' }}>
                    {pushStatus === 'granted' ? 'Recibes avisos al celular'
                     : pushStatus === 'denied' ? 'Habilítalas desde configuración del navegador'
                     : pushStatus === 'unsupported' ? 'Prueba en Chrome, Firefox o Safari 16+'
                     : 'Actívalas para recibir mensajes en tiempo real'}
                  </div>
                </div>
              </div>
              {pushError && <div style={errorStyle}>{pushError}</div>}
              {pushStatus !== 'unsupported' && pushStatus !== 'denied' && (
                <button
                  onClick={handleTogglePush}
                  disabled={pushBusy}
                  style={{
                    ...primaryButtonStyle,
                    backgroundColor: pushStatus === 'granted' ? '#8B4513' : '#228B22',
                    opacity: pushBusy ? 0.6 : 1,
                    cursor: pushBusy ? 'wait' : 'pointer',
                  }}
                >
                  {pushBusy ? 'Procesando…'
                   : pushStatus === 'granted' ? 'Desactivar notificaciones'
                   : 'Activar notificaciones al celular'}
                </button>
              )}
            </>
          )}

          {tab === 'admins' && treeId && (
            <AdminsPanel
              treeId={treeId}
              isOwner={!!isOwner}
              members={members ?? []}
            />
          )}

          {tab === 'danger' && (
            <>
              <div style={{
                padding: '14px 16px', borderRadius: '12px',
                backgroundColor: 'rgba(178, 34, 34, 0.08)',
                border: '1px solid rgba(178, 34, 34, 0.3)',
                color: '#5D4037',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <AlertTriangle size={18} color="#B22222" />
                  <strong style={{ color: '#B22222', fontSize: '15px' }}>Borrar mi cuenta</strong>
                </div>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, opacity: 0.85 }}>
                  Esta acción es <strong>permanente</strong>. Se eliminará tu cuenta,
                  tus preferencias y las notificaciones push. Tu manzana en el árbol
                  se desvinculará (los datos quedan, pero sin usuario asociado).
                  Si eres <strong>owner único</strong> de un árbol, se transferirá al
                  admin más antiguo. Si no hay admin, el árbol queda huérfano.
                </p>
              </div>

              <div>
                <label style={labelStyle}>Escribe <strong>BORRAR</strong> para confirmar</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  style={inputStyle}
                  placeholder="BORRAR"
                  autoComplete="off"
                />
              </div>

              <div>
                <label style={labelStyle}>Tu contraseña actual</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  style={inputStyle}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              {deleteError && <div style={errorStyle}>{deleteError}</div>}

              <button
                onClick={handleDeleteAccount}
                disabled={deleteBusy || deleteConfirmText !== 'BORRAR' || !deletePassword}
                style={{
                  ...primaryButtonStyle,
                  backgroundColor: '#B22222',
                  color: '#FFF',
                  opacity: deleteBusy || deleteConfirmText !== 'BORRAR' || !deletePassword ? 0.5 : 1,
                  cursor: deleteBusy ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <Trash2 size={16} />
                {deleteBusy ? 'Borrando…' : 'Borrar mi cuenta permanentemente'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(15, 26, 15, 0.85)', backdropFilter: 'blur(10px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 6000, padding: '20px',
}
const modalStyle: React.CSSProperties = {
  maxWidth: '460px', width: '100%', maxHeight: '92vh',
  backgroundColor: '#FAEFBC', borderRadius: '24px',
  border: '2px solid #2C1810',
  boxShadow: '0 30px 100px rgba(0,0,0,0.6)',
  overflow: 'hidden', display: 'flex', flexDirection: 'column',
}
const headerStyle: React.CSSProperties = {
  padding: '22px 28px', backgroundColor: '#2C1810', color: '#FAEFBC',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px',
}
const titleStyle: React.CSSProperties = {
  margin: 0, fontFamily: 'serif', fontSize: '22px',
}
const subtitleStyle: React.CSSProperties = {
  margin: '4px 0 0', fontSize: '12px', opacity: 0.7, fontWeight: 600,
}
const closeButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#FAEFBC', cursor: 'pointer', padding: 0,
}
const tabsWrapperStyle: React.CSSProperties = {
  display: 'flex', backgroundColor: 'rgba(44,24,16,0.06)', borderBottom: '1px solid rgba(44,24,16,0.1)',
}
const tabButtonStyle: React.CSSProperties = {
  flex: 1, padding: '14px 12px', border: 'none', background: 'transparent',
  fontSize: '13px', fontWeight: 700, color: '#7A6558',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  borderBottom: '2px solid transparent', transition: 'all 0.15s ease',
}
const tabActiveStyle: React.CSSProperties = {
  color: '#2C1810', borderBottomColor: '#D4822A', backgroundColor: 'transparent',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 900, color: '#2C1810',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: '12px',
  border: '1.5px solid rgba(44,24,16,0.15)', backgroundColor: 'white',
  fontSize: '14px', fontWeight: 600, color: '#2C1810', outline: 'none',
}
const primaryButtonStyle: React.CSSProperties = {
  width: '100%', padding: '13px', backgroundColor: '#D4822A', color: 'white',
  borderRadius: '14px', border: 'none', fontSize: '14px', fontWeight: 900,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 6px 20px rgba(212,130,42,0.3)', cursor: 'pointer',
}
const ghostButtonStyle: React.CSSProperties = {
  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px',
  background: 'none', border: 'none', color: '#7A6558', fontSize: '11px', fontWeight: 700,
  cursor: 'pointer', textDecoration: 'underline', padding: 0,
}
const errorStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: '10px',
  backgroundColor: 'rgba(178, 34, 34, 0.12)', color: '#8B2C1C',
  fontSize: '12px', fontWeight: 700,
}
const successStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: '10px',
  backgroundColor: 'rgba(46, 125, 50, 0.15)', color: '#2E7D32',
  fontSize: '12px', fontWeight: 700,
  display: 'flex', alignItems: 'center', gap: '8px',
}
const infoBoxStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: '10px',
  backgroundColor: 'rgba(44,24,16,0.05)', fontSize: '12px', color: '#2C1810', fontWeight: 600,
}
const warningBoxStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: '10px',
  backgroundColor: 'rgba(212, 130, 42, 0.1)',
  border: '1px solid rgba(212, 130, 42, 0.35)',
  fontSize: '11px', color: '#7A4A15', lineHeight: 1.5,
}
