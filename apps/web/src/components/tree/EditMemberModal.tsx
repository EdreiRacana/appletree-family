'use client'

import React, { useState } from 'react'
import { X, Save, User as UserIcon, Calendar, ImageIcon, MapPin, Briefcase, BookOpen, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

interface EditMemberModalProps {
  member: Member
  onClose: () => void
  onSave: () => void
}

export default function EditMemberModal({ member, onClose, onSave }: EditMemberModalProps) {
  const [formData, setFormData] = useState({
    firstName: member.firstName,
    lastName: member.lastName,
    dateOfBirth: member.dateOfBirth || '',
    dateOfDeath: member.dateOfDeath || '',
    avatarUrl: member.avatarUrl || '',
    gender: member.gender || 'male',
    appleType: member.appleType || 'red',
    isBaby: member.isBaby || false,
    biography: member.biography || '',
    occupation: member.occupation || '',
    birthPlace: member.birthPlace || '',
    nickname: member.nickname || '',
    maidenName: member.maidenName || '',
    parents: member.parents || []
  })
  const [isSaving, setIsSaving] = useState(false)
  const [parentsInfo, setParentsInfo] = useState<{id: string, name: string}[]>([])
  const [potentialParents, setPotentialParents] = useState<{id: string, name: string}[]>([])

  React.useEffect(() => {
    if (formData.parents.length > 0) {
      supabase.from('members').select('id, first_name, last_name').in('id', formData.parents)
        .then(({ data }) => {
          if (data) setParentsInfo(data.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })))
        })
    } else {
      setParentsInfo([])
    }
  }, [formData.parents])

  React.useEffect(() => {
    supabase.from('members')
      .select('id, first_name, last_name')
      .eq('tree_id', member.treeId)
      .neq('id', member.id)
      .then(({ data }) => {
        if (data) {
          setPotentialParents(data.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })))
        }
      })
  }, [member.treeId, member.id])

  const handleRemoveParent = (parentIdToRemove: string) => {
    if (confirm('¿Desvincular a este padre/madre? (Ideal para marcar hijos de relaciones anteriores)')) {
      setFormData({ ...formData, parents: formData.parents.filter(id => id !== parentIdToRemove) })
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    console.log('Tentando guardar cambios para:', member.id);
    try {
      // Re-activamos todos los campos personales ahora que las columnas existen en la DB
      const updateData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth || null,
        date_of_death: formData.dateOfDeath || null,
        avatar_url: formData.avatarUrl || null,
        gender: formData.gender,
        apple_type: formData.appleType,
        biography: formData.biography || null,
        occupation: formData.occupation || null,
        birth_place: formData.birthPlace || null,
        nickname: formData.nickname || null,
        maiden_name: formData.maidenName || null,
        parents: formData.parents
      }

      const { error } = await supabase
        .from('members')
        .update(updateData)
        .eq('id', member.id)

      if (error) {
        console.error('Error detallado de Supabase:', error.message, error.details, error.hint);
        throw new Error(error.message);
      }
      
      console.log('¡Guardado exitoso!');

      try {
        const currentUser = window.localStorage?.getItem('currentUser') || 'Francisco'
        await supabase.from('activities').insert({
          tree_id: member.treeId,
          type: 'member_updated',
          title: `Perfil Actualizado`,
          description: `${currentUser} actualizó la información de ${formData.firstName} ${formData.lastName}.`,
          privacy: 'family'
        })
      } catch (logErr) {
        console.error('Non-critical: failed to log activity', logErr)
      }

      onSave()
      onClose()
    } catch (err: any) {
      console.error('Error al guardar:', err);
      alert(`No se pudo guardar: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5000,
    }}>
      <div style={{
        backgroundColor: '#FAEFBC',
        width: '100%',
        maxWidth: '500px',
        borderRadius: '24px',
        padding: '32px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(242,210,65,0.3)',
        border: '2px solid #F2D241',
        color: '#2C1810',
        animation: 'modalFadeIn 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontFamily: 'serif', fontSize: '24px', color: '#8B4513' }}>
            Editar Familiar
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B4513' }}>
            <X size={24} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Avatar Preview Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: 'rgba(139,69,19,0.05)', padding: '16px', borderRadius: '16px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid #F2D241',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
              backgroundColor: '#fff'
            }}>
              <img 
                src={formData.avatarUrl || '/assets/default-avatar.png'} 
                alt="Preview" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', opacity: 0.7 }}>
                <ImageIcon size={14} /> URL DE LA FOTO
              </label>
              <input 
                type="text"
                value={formData.avatarUrl}
                onChange={(e) => setFormData({...formData, avatarUrl: e.target.value})}
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(139,69,19,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.5)',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}><UserIcon size={14} /> NOMBRE</label>
              <input 
                type="text" 
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>APELLIDOS</label>
              <input 
                type="text" 
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                style={inputStyle} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}><Calendar size={14} /> FECHA DE NACIMIENTO</label>
              <input 
                type="date" 
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}><Calendar size={14} /> FECHA DE FALLECIMIENTO</label>
              <input 
                type="date" 
                value={formData.dateOfDeath}
                onChange={(e) => setFormData({...formData, dateOfDeath: e.target.value})}
                style={inputStyle} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}><MapPin size={14} /> LUGAR DE ORIGEN</label>
              <input 
                type="text" 
                value={formData.birthPlace}
                onChange={(e) => setFormData({...formData, birthPlace: e.target.value})}
                placeholder="Ej: Ciudad de México"
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}><Star size={14} /> APODO / NICKNAME</label>
              <input 
                type="text" 
                value={formData.nickname}
                onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                placeholder="Ej: El Chato"
                style={inputStyle} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}><Briefcase size={14} /> PROFESIÓN / OCUPACIÓN</label>
              <input 
                type="text" 
                value={formData.occupation}
                onChange={(e) => setFormData({...formData, occupation: e.target.value})}
                placeholder="Ej: Ingeniero, Ama de casa..."
                style={inputStyle} 
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}><BookOpen size={14} /> BIOGRAFÍA Y LOGROS (Boda, Graduación...)</label>
            <textarea 
              value={formData.biography}
              onChange={(e) => setFormData({...formData, biography: e.target.value})}
              placeholder="Escribe aquí los momentos más importantes de su vida..."
              style={{ ...inputStyle, height: '100px', resize: 'none', lineHeight: '1.5' }} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(242,210,65,0.1)', padding: '12px 16px', borderRadius: '12px', border: '1px dashed #F2D241' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#8B4513', display: 'block' }}>MODO BEBÉ (PRIVACIDAD)</span>
              <span style={{ fontSize: '11px', opacity: 0.6 }}>Oculta la foto real y usa un icono.</span>
            </div>
            <button
              onClick={() => setFormData({...formData, isBaby: !formData.isBaby})}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: formData.isBaby ? '#8B4513' : '#D1D5DB',
                position: 'relative',
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#FFF',
                position: 'absolute',
                top: '3px',
                left: formData.isBaby ? '23px' : '3px',
                transition: 'all 0.2s ease'
              }} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>GÉNERO</label>
              <select 
                value={formData.gender}
                onChange={(e) => setFormData({...formData, gender: e.target.value as any})}
                style={inputStyle}
              >
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>TIPO DE MANZANA</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['red', 'green', 'pink'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFormData({...formData, appleType: type as any})}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: formData.appleType === type ? '2px solid #F2D241' : '1px solid rgba(0,0,0,0.1)',
                      backgroundColor: formData.appleType === type ? '#8B4513' : 'rgba(139,69,19,0.1)',
                      color: formData.appleType === type ? '#FAEFBC' : '#2C1810',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PARENT MANAGEMENT */}
          <div style={{ backgroundColor: 'rgba(139,69,19,0.05)', padding: '16px', borderRadius: '16px', border: '1px dashed rgba(139,69,19,0.2)' }}>
            <label style={{ ...labelStyle, color: '#B22222' }}>PADRES REGISTRADOS</label>
            <p style={{ fontSize: '11px', opacity: 0.6, marginTop: '-4px', marginBottom: '12px' }}>
              Si {formData.firstName} es de otra relación o le falta un padre, vincúlalo o desvincúlalo aquí.
            </p>
            
            {parentsInfo.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parentsInfo.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '8px', border: '1px solid rgba(139,69,19,0.1)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{p.name}</span>
                    <button 
                      onClick={() => handleRemoveParent(p.id)} 
                      style={{ background: 'none', border: 'none', color: '#B22222', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: '4px 8px' }}
                    >
                      X Desvincular
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#8B4513', fontStyle: 'italic', margin: '0 0 12px 0' }}>No hay padres vinculados.</p>
            )}

            {parentsInfo.length < 2 && potentialParents.filter(p => !formData.parents.includes(p.id)).length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      setFormData({ ...formData, parents: [...formData.parents, e.target.value] })
                      e.target.value = ''
                    }
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(139,69,19,0.3)', backgroundColor: 'rgba(255,255,255,0.9)', fontSize: '13px', color: '#8B4513', fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}
                  defaultValue=""
                >
                  <option value="" disabled>+ Vincular padre o madre...</option>
                  {potentialParents.filter(p => !formData.parents.includes(p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          <button 
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid rgba(139,69,19,0.2)',
              backgroundColor: 'transparent',
              color: '#8B4513',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#8B4513',
              color: '#FAEFBC',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isSaving ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px rgba(139,69,19,0.3)'
            }}
          >
            {isSaving ? 'Guardando...' : <Save size={18} />}
            {!isSaving && ' Guardar Cambios'}
          </button>
        </div>

        {/* DELETE ACTION */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed rgba(139,69,19,0.1)', textAlign: 'center' }}>
          <button
            onClick={async () => {
              if (confirm(`¿Estás seguro de que deseas eliminar a ${member.firstName} de la familia? Esta acción no se puede deshacer.`)) {
                setIsSaving(true)
                try {
                  const { error } = await supabase.from('members').delete().eq('id', member.id)
                  if (error) throw error
                  onSave()
                  onClose()
                } catch (err) {
                  console.error('Error deleting member:', err)
                  alert('No se pudo eliminar al familiar.')
                } finally {
                  setIsSaving(false)
                }
              }
            }}
            disabled={isSaving}
            style={{
              background: 'none',
              border: 'none',
              color: '#B22222',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textDecoration: 'underline',
              opacity: 0.7
            }}
          >
            ELIMINAR MIEMBRO DE LA FAMILIA
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  fontWeight: 'bold',
  marginBottom: '8px',
  opacity: 0.6,
  letterSpacing: '0.05em'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(139,69,19,0.15)',
  backgroundColor: 'rgba(255,255,255,0.7)',
  fontSize: '15px',
  color: '#2C1810',
  outline: 'none',
}
