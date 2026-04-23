'use client' 

import React, { useState } from 'react'
import { X, Save, User as UserIcon, Calendar, ImageIcon, Baby, UserPlus, Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Member, Relationship } from '@/lib/types'

interface AddMemberModalProps {
  targetMember: Member
  relationships: Relationship[]
  onClose: () => void
  onSave: () => void
}

type RelType = 'child' | 'parent' | 'spouse'

export default function AddMemberModal({ targetMember, relationships, onClose, onSave }: AddMemberModalProps) {
  const [step, setStep] = useState<'choose' | 'form'>('choose')
  const [relType, setRelType] = useState<RelType>('child')
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: targetMember.lastName,
    dateOfBirth: '',
    avatarUrl: '',
    gender: 'male',
    appleType: 'red',
    isBaby: false
  })
  
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // 1. Calculate new member generation
      let newGen = targetMember.generation ?? 0
      if (relType === 'child') newGen += 1
      if (relType === 'parent') newGen -= 1

      // 2. Prepare Parent IDs if adding a child
      let parentIds: string[] = [targetMember.id]
      if (relType === 'child') {
        // Find spouse in relationships to add as co-parent
        const spouseRel = relationships.find(rel => 
          rel.relationship === 'spouse' && 
          (rel.member1Id === targetMember.id || rel.member2Id === targetMember.id)
        )
        if (spouseRel) {
          const spouseId = spouseRel.member1Id === targetMember.id ? spouseRel.member2Id : spouseRel.member1Id
          parentIds.push(spouseId)
        }
      }

      // 3. Create the new member record
      let insertData: any = {
        tree_id: targetMember.treeId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth || null,
        avatar_url: formData.avatarUrl || null,
        gender: formData.gender,
        apple_type: formData.appleType,
        generation: newGen,
        parents: parentIds
      }

      const { data: newMember, error: mError } = await supabase
        .from('members')
        .insert(insertData)
        .select()
        .single()

      if (mError) throw mError

      // 4. Handle additional linkages
      if (relType === 'parent') {
        // Update the target member's parents array
        const currentParents = targetMember.parents || []
        const { error: uError } = await supabase
          .from('members')
          .update({ parents: [...currentParents, newMember.id] })
          .eq('id', targetMember.id)
        if (uError) throw uError
      }

      if (relType === 'spouse') {
        // Update target member's spouses array
        const currentSpouses = targetMember.spouses || []
        await supabase
          .from('members')
          .update({ spouses: [...currentSpouses, newMember.id] })
          .eq('id', targetMember.id)

        // Update new member's spouses array
        await supabase
          .from('members')
          .update({ spouses: [targetMember.id] })
          .eq('id', newMember.id)

        // Create relationship bridge record
        await supabase
          .from('relationships')
          .insert({
            tree_id: targetMember.treeId,
            member1_id: targetMember.id,
            member2_id: newMember.id,
            relationship: 'spouse'
          })
      }

      onSave()
      onClose()
    } catch (err) {
      console.error('Error adding member:', err)
      alert('Error creating family connection')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>
            {step === 'choose' ? 'Expandir Familia' : `Añadir ${relType === 'child' ? 'Hijo/a' : relType === 'parent' ? 'Padre/Madre' : 'Pareja'}`}
          </h2>
          <button onClick={onClose} style={closeButtonStyle}><X size={24} /></button>
        </div>

        {step === 'choose' ? (
          <div style={choiceGridStyle}>
            <button onClick={() => { setRelType('child'); setStep('form') }} style={choiceButtonStyle}>
              <div style={iconBoxStyle}><Baby size={32} /></div>
              <span>Hijo / Hija</span>
              <p style={choiceDescStyle}>Añadir descendencia de {targetMember.firstName}</p>
            </button>
            <button onClick={() => { setRelType('parent'); setStep('form') }} style={choiceButtonStyle}>
              <div style={iconBoxStyle}><UserPlus size={32} /></div>
              <span>Padre / Madre</span>
              <p style={choiceDescStyle}>Añadir un nivel superior (Ascendencia)</p>
            </button>
            <button onClick={() => { setRelType('spouse'); setStep('form') }} style={choiceButtonStyle}>
              <div style={iconBoxStyle}><Heart size={32} /></div>
              <span>Pareja</span>
              <p style={choiceDescStyle}>Añadir cónyuge o compañero/a</p>
            </button>
          </div>
        ) : (
          <div style={formWrapperStyle}>
            {/* Form Fields */}
            <div style={grid2Style}>
              <div>
                <label style={labelStyle}><UserIcon size={14} /> NOMBRE</label>
                <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} style={inputStyle} placeholder="Ej: Ana" />
              </div>
              <div>
                <label style={labelStyle}>APELLIDOS</label>
                <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}><Calendar size={14} /> FECHA DE NACIMIENTO</label>
              <input type="date" value={formData.dateOfBirth} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(242,210,65,0.1)', padding: '12px 16px', borderRadius: '12px', border: '1px dashed #F2D241' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#8B4513', display: 'block' }}>MODO BEBÉ (PRIVACIDAD)</span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>Protección de imagen automática.</span>
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

            <div>
              <label style={labelStyle}>GÉNERO</label>
              <div style={flexGap12Style}>
                {['male', 'female'].map(g => (
                  <button key={g} onClick={() => setFormData({...formData, gender: g as any})} style={toggleButtonStyle(formData.gender === g)}>
                    {g === 'male' ? 'HOMBRE' : 'MUJER'}
                  </button>
                ))}
              </div>
            </div>

            <div style={footerStyle}>
              <button onClick={() => setStep('choose')} style={secondaryButtonStyle}>Volver</button>
              <button onClick={handleSave} disabled={isSaving || !formData.firstName} style={primaryButtonStyle}>
                {isSaving ? 'Creando...' : 'Crear Familiar'}
              </button>
            </div>
          </div>
        )}
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

// STYLES
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#FAEFBC', width: '100%', maxWidth: '540px', borderRadius: '32px',
  padding: '40px', position: 'relative', border: '2px solid #F2D241', color: '#2C1810',
  boxShadow: '0 30px 60px -12px rgba(0,0,0,0.6)', animation: 'modalFadeIn 0.3s ease-out'
}

const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'serif', fontSize: '28px', color: '#8B4513' }
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#8B4513' }

const choiceGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }
const choiceButtonStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', borderRadius: '20px',
  border: '1.5px solid rgba(139,69,19,0.1)', backgroundColor: 'rgba(255,255,255,0.4)',
  cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'center'
}
const iconBoxStyle: React.CSSProperties = { color: '#8B4513', marginBottom: '12px' }
const choiceDescStyle: React.CSSProperties = { fontSize: '13px', opacity: 0.6, marginTop: '4px', maxWidth: '200px' }

const formWrapperStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' }
const grid2Style: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }
const labelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', opacity: 0.6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(139,69,19,0.15)', backgroundColor: 'rgba(255,255,255,0.7)', fontSize: '15px' }
const flexGap12Style: React.CSSProperties = { display: 'flex', gap: '12px' }

const toggleButtonStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
  border: active ? '2px solid #F2D241' : '1px solid rgba(0,0,0,0.1)',
  backgroundColor: active ? '#8B4513' : 'rgba(255,255,255,0.5)',
  color: active ? '#FAEFBC' : '#8B4513', transition: 'all 0.2s ease'
})

const footerStyle: React.CSSProperties = { display: 'flex', gap: '12px', marginTop: '20px' }
const secondaryButtonStyle: React.CSSProperties = { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #8B4513', color: '#8B4513', fontWeight: 'bold', cursor: 'pointer' }
const primaryButtonStyle: React.CSSProperties = { flex: 2, padding: '12px', borderRadius: '12px', backgroundColor: '#8B4513', color: '#FAEFBC', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,69,19,0.3)' }
