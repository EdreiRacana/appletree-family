'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Shield, ShieldOff, UserPlus, Crown, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

interface AdminRow {
  user_id: string
  email: string
  full_name: string | null
  role: 'owner' | 'admin' | 'member'
  granted_at: string
  last_active_at: string | null
}

interface AdminsPanelProps {
  treeId: string
  isOwner: boolean
  members: Member[]   // para mostrar los candidatos a promover
  onClose?: () => void
}

// Panel donde el owner del árbol ve la lista de administradores y puede
// promover a otros miembros a admin, o quitarles el rol.
export default function AdminsPanel({ treeId, isOwner, members, onClose }: AdminsPanelProps) {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)   // user_id ocupado
  const [showAddPicker, setShowAddPicker] = useState(false)

  const loadAdmins = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_tree_admins', { p_tree_id: treeId })
      if (error) throw error
      setAdmins((data ?? []) as AdminRow[])
    } catch (err) {
      console.warn('No se pudo cargar la lista de administradores:', err)
      setAdmins([])
    } finally {
      setLoading(false)
    }
  }, [treeId])

  useEffect(() => { void loadAdmins() }, [loadAdmins])

  const handlePromote = async (userId: string) => {
    setBusy(userId)
    try {
      const { error } = await supabase.rpc('promote_to_admin', { p_tree_id: treeId, p_user_id: userId })
      if (error) throw error
      setShowAddPicker(false)
      await loadAdmins()
    } catch (err) {
      console.error('Error promoviendo admin:', err)
      alert(err instanceof Error ? err.message : 'No se pudo promover al administrador.')
    } finally {
      setBusy(null)
    }
  }

  const handleDemote = async (userId: string) => {
    if (!confirm('¿Quitar el rol de administrador a este usuario? Seguirá siendo miembro pero perderá los poderes de edición del árbol.')) return
    setBusy(userId)
    try {
      const { error } = await supabase.rpc('demote_admin', { p_tree_id: treeId, p_user_id: userId })
      if (error) throw error
      await loadAdmins()
    } catch (err) {
      console.error('Error quitando admin:', err)
      alert(err instanceof Error ? err.message : 'No se pudo quitar al administrador.')
    } finally {
      setBusy(null)
    }
  }

  // Candidatos para promover: miembros con cuenta enlazada que aún NO son admins.
  const currentAdminIds = new Set(admins.map(a => a.user_id))
  const candidates = members.filter(m => m.userId && !currentAdminIds.has(m.userId))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(44,24,16,0.05)', fontSize: '12px', color: '#2C1810', fontWeight: 600 }}>
        Administradores pueden editar cualquier manzana, relaciones y eventos.
        Solo el fundador (owner) puede nombrar o quitar administradores.
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#8B4513', fontSize: '13px' }}>Cargando…</div>
      ) : admins.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#8B4513', fontSize: '13px' }}>
          Aún no hay administradores. {isOwner && 'Puedes nombrar el primero abajo.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {admins.map(a => (
            <div
              key={a.user_id}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', borderRadius: '12px',
                backgroundColor: a.role === 'owner' ? 'rgba(212,175,55,0.15)' : 'rgba(139,69,19,0.06)',
                border: a.role === 'owner' ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(139,69,19,0.15)',
              }}
            >
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                backgroundColor: a.role === 'owner' ? '#D4AF37' : '#8B4513',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {a.role === 'owner' ? <Crown size={16} /> : <Shield size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#2C1810', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.full_name || a.email}
                </div>
                <div style={{ fontSize: '10px', color: '#7A6558', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {a.role === 'owner' ? 'Fundador' : 'Administrador'}
                </div>
              </div>
              {isOwner && a.role === 'admin' && (
                <button
                  onClick={() => handleDemote(a.user_id)}
                  disabled={busy === a.user_id}
                  title="Quitar rol de administrador"
                  style={{ background: 'none', border: 'none', color: '#8B2C1C', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                >
                  <ShieldOff size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && candidates.length > 0 && (
        <>
          {!showAddPicker ? (
            <button
              onClick={() => setShowAddPicker(true)}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px',
                border: '1.5px dashed rgba(139,69,19,0.4)',
                backgroundColor: 'transparent', color: '#8B4513',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <UserPlus size={16} /> Nombrar un administrador
            </button>
          ) : (
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#FFF6D8', border: '1px solid rgba(139,69,19,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#8B4513', textTransform: 'uppercase' }}>Elige un miembro</span>
                <button onClick={() => setShowAddPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B4513' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                {candidates.map(m => (
                  <button
                    key={m.userId}
                    onClick={() => m.userId && handlePromote(m.userId)}
                    disabled={busy === m.userId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', border: 'none', background: 'rgba(255,255,255,0.6)',
                      borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      color: '#2C1810', fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    <UserPlus size={14} color="#8B4513" />
                    {m.firstName} {m.lastName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {onClose && (
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8B4513', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', marginTop: '4px' }}>
          Cerrar
        </button>
      )}
    </div>
  )
}
