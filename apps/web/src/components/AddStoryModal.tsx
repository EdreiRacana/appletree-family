'use client'

import React, { useState } from 'react'
import { X, Camera, Save, Calendar, Type } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AddStoryModalProps {
  treeId: string
  initialData?: {
    id: string
    title: string
    year: string
    description: string
    imageUrl: string
  }
  onClose: () => void
  onSave: () => void
}

export default function AddStoryModal({ treeId, initialData, onClose, onSave }: AddStoryModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    year: initialData?.year || new Date().getFullYear().toString(),
    description: initialData?.description || ''
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1200
          let width = img.width
          let height = img.height

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Canvas to Blob failed'))
          }, 'image/jpeg', 0.8) // Calidad 80% en JPEG es el estándar de oro
        }
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleSave = async () => {
    if (!formData.title || !formData.description) return
    setIsSaving(true)

    try {
      let finalImageUrl = initialData?.imageUrl || 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&q=80'

      // 1. Subir foto optimizada si se seleccionó una nueva
      if (selectedFile) {
        const optimizedBlob = await compressImage(selectedFile)
        const fileName = `${Math.random()}.jpg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('family-photos')
          .upload(fileName, optimizedBlob, { contentType: 'image/jpeg' })

        if (uploadError) {
          console.error('Error uploading:', uploadError)
          alert('Asegúrate de haber creado el bucket "family-photos" en Supabase Storage.')
          throw uploadError
        }

        const { data: { publicUrl } } = supabase.storage
          .from('family-photos')
          .getPublicUrl(fileName)
        
        finalImageUrl = publicUrl
      }

      if (initialData?.id) {
        // UPDATE
        const { error } = await supabase
          .from('activities')
          .update({
            title: `${formData.title} (${formData.year})`,
            description: formData.description,
            image_url: finalImageUrl
          })
          .eq('id', initialData.id)
        if (error) throw error
      } else {
        // INSERT
        const { error } = await supabase
          .from('activities')
          .insert({
            tree_id: treeId,
            type: 'photo_upload',
            title: `${formData.title} (${formData.year})`,
            description: formData.description,
            image_url: finalImageUrl,
            privacy: 'core'
          })
        if (error) throw error
      }

      onSave()
      onClose()
    } catch (err) {
      console.error('Error saving story:', err)
      alert('Error al guardar la historia.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Nueva Historia Familiar</h2>
          <button onClick={onClose} style={closeButtonStyle}><X size={20} /></button>
        </div>

        <div style={formStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}><Type size={14} /> TÍTULO DEL MOMENTO</label>
            <input 
              style={inputStyle} 
              placeholder="Ej: El primer viaje a la playa" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}><Calendar size={14} /> AÑO / FECHA</label>
            <input 
              style={inputStyle} 
              placeholder="Ej: 1995" 
              value={formData.year}
              onChange={e => setFormData({...formData, year: e.target.value})}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}><Camera size={14} /> FOTO DEL RECUERDO</label>
            <div 
              onClick={() => document.getElementById('file-upload')?.click()}
              style={{
                ...inputStyle, 
                height: '120px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer',
                backgroundImage: previewUrl ? `url(${previewUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {!previewUrl && (
                <>
                  <Camera size={30} style={{opacity: 0.5}} />
                  <span style={{fontSize: '12px', marginTop: '10px', opacity: 0.6}}>Haga clic para elegir una foto</span>
                </>
              )}
              {previewUrl && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px',
                  backgroundColor: 'rgba(44,24,16,0.6)', color: 'white', fontSize: '10px', textAlign: 'center'
                }}>
                  Cambiar foto
                </div>
              )}
            </div>
            <input 
              id="file-upload"
              type="file" 
              accept="image/*"
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>DESCRIPCIÓN DE LA HISTORIA</label>
            <textarea 
              style={{...inputStyle, height: '100px', resize: 'none'}} 
              placeholder="Cuéntanos qué pasó..." 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <button 
            onClick={handleSave} 
            disabled={isSaving || !formData.title} 
            style={isSaving ? {...submitButtonStyle, opacity: 0.7} : submitButtonStyle}
          >
            <Save size={18} />
            {isSaving ? 'Guardando...' : 'Publicar Historia'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#FAEFBC', width: '90%', maxWidth: '400px', borderRadius: '24px',
  padding: '25px', border: '2px solid #2C1810', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
  animation: 'slideUp 0.3s ease-out'
}

const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'serif', fontSize: '20px', color: '#2C1810', fontWeight: '900' }
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#2C1810' }

const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '15px' }
const inputGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' }
const labelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '900', color: '#2C1810', opacity: 0.8 }
const inputStyle: React.CSSProperties = { 
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid rgba(44,24,16,0.2)', 
  backgroundColor: 'rgba(255,255,255,0.5)', color: '#2C1810', fontSize: '14px', outline: 'none'
}

const submitButtonStyle: React.CSSProperties = {
  marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
  padding: '12px', borderRadius: '12px', backgroundColor: '#2C1810', color: '#FAEFBC',
  border: 'none', fontWeight: '900', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease'
}
