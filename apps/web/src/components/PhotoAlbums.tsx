'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Image as ImageIcon, Trash2, Upload, ChevronLeft, Save, ChevronRight, AlertCircle, Globe, Lock, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Album {
  id: string
  name: string
  description?: string
  cover_url?: string
  created_by_name?: string
  privacy?: 'public' | 'private' | 'selective'
}

interface Photo {
  id: string
  url: string
  caption?: string
}

interface PhotoAlbumsProps {
  treeId: string
  onClose?: () => void
}

export default function PhotoAlbums({ treeId, onClose }: PhotoAlbumsProps) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [renamingAlbumId, setRenamingAlbumId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const CURRENT_USER_NAME = 'Familiar'

  useEffect(() => { fetchAlbums() }, [treeId])

  const fetchAlbums = async () => {
    try {
      const { data, error } = await supabase.from('albums').select('*').eq('tree_id', treeId).order('created_at', { ascending: false })
      if (error) throw error
      if (data) setAlbums(data)
    } catch (err: any) {
      const local = localStorage.getItem('apple_demo_albums')
      if (local) setAlbums(JSON.parse(local))
    } finally { setLoading(false) }
  }

  const fetchPhotos = async (albumId: string) => {
    setLoading(true)
    setPhotos([]) // Clear previous photos
    try {
      const { data, error } = await supabase.from('photos').select('*').eq('album_id', albumId).order('created_at', { ascending: true })
      if (error) throw error
      if (data) { setPhotos(data); setActiveIndex(0); }
    } catch (err) {
      const local = localStorage.getItem(`apple_demo_photos_${albumId}`)
      if (local) {
        const p = JSON.parse(local).filter((p: Photo) => !p.url.startsWith('blob:'))
        setPhotos(p); setActiveIndex(0);
      }
    } finally { setLoading(false) }
  }

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('albums').insert({ tree_id: treeId, name: newAlbumName.trim(), created_by_name: CURRENT_USER_NAME, privacy: 'public' }).select().single()
      if (error) throw error
      if (data) { 
        setAlbums([data, ...albums])
        setShowCreateModal(false)
        setNewAlbumName('')
        setSelectedAlbum(data)
        setPhotos([])
      }
    } catch (err) {
      const newLocalAlbum: Album = { id: `local-${Date.now()}`, name: newAlbumName.trim(), created_by_name: CURRENT_USER_NAME, privacy: 'public', cover_url: '' }
      const updated = [newLocalAlbum, ...albums]
      setAlbums(updated)
      localStorage.setItem('apple_demo_albums', JSON.stringify(updated))
      setShowCreateModal(false)
      setNewAlbumName('')
      setSelectedAlbum(newLocalAlbum)
      setPhotos([])
    }
    setLoading(false)
  }

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.readAsDataURL(file)
      reader.onload = (e) => {
        const img = new Image(); img.src = e.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas'); const MAX = 1200; let w = img.width, h = img.height
          if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
          canvas.width = w; canvas.height = h; canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
          canvas.toBlob(b => b ? resolve(b) : reject(), 'image/jpeg', 0.6)
        }
      }
    })
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(blob)
    })
  }

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedAlbum) return
    setIsUploading(true)
    try {
      const file = e.target.files[0]
      const compressedBlob = await compressImage(file)
      
      try {
        const fileName = `${Date.now()}-${file.name}`
        const filePath = `albums/${selectedAlbum.id}/${fileName}`
        const { error: uploadError } = await supabase.storage.from('family-photos').upload(filePath, compressedBlob)
        if (uploadError) throw uploadError
        
        const { data: { publicUrl } } = supabase.storage.from('family-photos').getPublicUrl(filePath)
        const { data: photoData, error: dbError } = await supabase.from('photos').insert({ album_id: selectedAlbum.id, url: publicUrl }).select().single()
        
        if (dbError) throw dbError
        if (photoData) {
          setPhotos(prev => [...prev, photoData])
          setActiveIndex(photos.length)
          if (!selectedAlbum.cover_url) {
             await supabase.from('albums').update({ cover_url: publicUrl }).eq('id', selectedAlbum.id)
             setAlbums(albums.map(a => a.id === selectedAlbum.id ? { ...a, cover_url: publicUrl } : a))
          }
        }
      } catch (dbErr) {
        // Fallback persistent demo
        const base64 = await blobToBase64(compressedBlob)
        const newPhoto = { id: `local-photo-${Date.now()}`, url: base64 }
        const updated = [...photos, newPhoto]
        setPhotos(updated)
        setActiveIndex(updated.length - 1)
        localStorage.setItem(`apple_demo_photos_${selectedAlbum.id}`, JSON.stringify(updated))
        
        if (!selectedAlbum.cover_url) {
           const updatedAlbums = albums.map(a => a.id === selectedAlbum.id ? { ...a, cover_url: base64 } : a)
           setAlbums(updatedAlbums)
           localStorage.setItem('apple_demo_albums', JSON.stringify(updatedAlbums))
        }
      }
    } catch (err) {
      console.error('Upload process error:', err)
      alert('Error al procesar la imagen.')
    } finally { setIsUploading(false) }
  }

  // Rename album helper — el mismo path que fetchAlbums (Supabase + fallback local)
  const handleRenameAlbum = async (album: Album) => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === album.name) { setRenamingAlbumId(null); return }
    try {
      if (!album.id.startsWith('local-')) {
        const { error } = await supabase.from('albums').update({ name: trimmed }).eq('id', album.id)
        if (error) throw error
      }
      const updated = albums.map(a => a.id === album.id ? { ...a, name: trimmed } : a)
      setAlbums(updated)
      if (album.id.startsWith('local-')) {
        localStorage.setItem('apple_demo_albums', JSON.stringify(updated))
      }
      if (selectedAlbum?.id === album.id) setSelectedAlbum({ ...selectedAlbum, name: trimmed })
    } catch (err) {
      console.error('Rename error:', err)
    } finally {
      setRenamingAlbumId(null)
    }
  }

  return (
    <div style={{
      // Panel flotante centrado y responsive — antes era absolute con
      // top/left/width/height hardcoded → se cortaba en pantallas chicas
      // y no había forma de cerrarlo.
      position: 'fixed',
      top: '92px',
      right: '18px',
      bottom: '18px',
      width: 'min(460px, calc(100vw - 40px))',
      backgroundColor: '#FAEFBC', borderRadius: '20px', border: '2px solid rgba(44,24,16,0.35)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column',
      zIndex: 1000, overflow: 'hidden'
    }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(44,24,16,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(44,24,16,0.02)', gap: '10px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {selectedAlbum && <button onClick={() => setSelectedAlbum(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2C1810', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', marginBottom: '3px', opacity: 0.7 }}><ChevronLeft size={14} /> Volver</button>}
          <h2 style={{ fontSize: '18px', fontFamily: 'serif', margin: 0, color: '#2C1810', fontWeight: '950', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedAlbum ? selectedAlbum.name : 'Mis Álbumes'}</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {!selectedAlbum ? (
            <button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 14px', backgroundColor: '#2C1810', color: '#FAEFBC', borderRadius: '12px', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: '11px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>+ Nuevo</button>
          ) : (
            <label style={{ padding: '8px 14px', backgroundColor: '#2C1810', color: '#FAEFBC', borderRadius: '12px', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
              <Upload size={14} /> Subir
              <input type="file" accept="image/*" hidden onChange={handleUploadPhoto} />
            </label>
          )}
          {onClose && (
            <button onClick={onClose} title="Cerrar" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(44,24,16,0.25)', background: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C1810' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={32} color="#2C1810" /></div>
        ) : !selectedAlbum ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {albums.map(album => {
              const isRenaming = renamingAlbumId === album.id
              return (
                <div key={album.id}
                  onClick={() => { if (!isRenaming) { setSelectedAlbum(album); fetchPhotos(album.id) } }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'white', borderRadius: '18px', border: '2.5px solid #2C1810', cursor: isRenaming ? 'default' : 'pointer', transition: 'transform 0.2s', minWidth: 0 }} className="album-card-item">
                  <div style={{ width: '50px', height: '50px', flexShrink: 0, backgroundImage: album.cover_url ? `url(${album.cover_url})` : 'linear-gradient(135deg,#D4822A,#B8691A)', backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '10px', border: '1.5px solid #2C1810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!album.cover_url && <ImageIcon size={18} color="#FAEFBC" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameAlbum(album)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameAlbum(album); if (e.key === 'Escape') setRenamingAlbumId(null) }}
                        style={{ width: '100%', padding: '4px 8px', borderRadius: '8px', border: '1.5px solid #2C1810', fontSize: '14px', fontWeight: 800, fontFamily: 'inherit', outline: 'none' }}
                      />
                    ) : (
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#2C1810', fontWeight: '950', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.name}</h4>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                      <p style={{ margin: 0, fontSize: '9px', color: '#D4822A', fontWeight: '800' }}>por: {album.created_by_name}</p>
                      {album.privacy === 'private' ? <Lock size={10} color="#D4822A" /> : <Globe size={10} color="#D4822A" />}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setRenameValue(album.name); setRenamingAlbumId(album.id) }}
                    title="Renombrar"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2C1810', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
                  >
                    <Save size={14} />
                  </button>
                  <ChevronRight size={16} opacity={0.3} />
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '10px' }}>
             {isUploading ? (
               <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={40} color="#2C1810" style={{ marginBottom: '10px' }} /><p style={{ fontSize: '13px', fontWeight: '900', color: '#2C1810' }}>Comprimiendo y guardando...</p></div>
             ) : photos.length === 0 ? (
               <div style={{ textAlign: 'center', opacity: 0.4 }}><ImageIcon size={48} /><p style={{ fontSize: '13px', marginTop: '10px', fontWeight: '800' }}>Añade tu primera foto para empezar.</p></div>
             ) : (
               <>
                 <div style={{ position: 'relative', width: '100%', height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <button onClick={() => setActiveIndex(activeIndex > 0 ? activeIndex - 1 : photos.length - 1)} style={{ position: 'absolute', left: '-5px', zIndex: 10, background: '#2C1810', color: 'white', borderRadius: '50%', width: '32px', height: '32px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}><ChevronLeft size={16} /></button>
                   <div style={{ width: '85%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '20px', border: '4px solid #2C1810', boxShadow: '0 15px 40px rgba(0,0,0,0.3)' }}>
                      <img src={photos[activeIndex].url} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }} className="zoom-target" />
                   </div>
                   <button onClick={() => setActiveIndex(activeIndex < photos.length - 1 ? activeIndex + 1 : 0)} style={{ position: 'absolute', right: '-5px', zIndex: 10, background: '#2C1810', color: 'white', borderRadius: '50%', width: '32px', height: '32px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}><ChevronRight size={16} /></button>
                 </div>
                 <p style={{ fontSize: '12px', fontWeight: '950', color: '#2C1810', background: 'rgba(44,24,16,0.05)', padding: '4px 12px', borderRadius: '10px' }}>{activeIndex + 1} / {photos.length}</p>
               </>
             )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(27, 46, 27, 0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FAEFBC', padding: '30px', borderRadius: '25px', border: '3.5px solid #2C1810', width: '100%', maxWidth: '280px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2C1810', fontSize: '19px', fontFamily: 'serif' }}>Nuevo Álbum</h3>
            <input autoFocus value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} placeholder="Ej. Vacaciones 2024" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #2C1810', marginBottom: '18px', fontWeight: '700', outline: 'none' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '11px', background: 'none', border: '2px solid #2C1810', borderRadius: '12px', fontWeight: '900', fontSize: '12px' }}>Cancelar</button>
              <button onClick={handleCreateAlbum} style={{ flex: 1, padding: '11px', backgroundColor: '#2C1810', color: '#FAEFBC', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '12px' }}>Crear</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .zoom-target:hover { transform: scale(1.15); }
        .album-card-item:hover { transform: translateX(5px); background-color: #FAEFBC !important; }
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-thumb { background: #2C1810; border-radius: 10px; }
      `}</style>
    </div>
  )
}
