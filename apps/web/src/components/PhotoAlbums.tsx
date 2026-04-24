'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Image as ImageIcon, Trash2, Upload, ChevronLeft, Save, ChevronRight, AlertCircle } from 'lucide-react'
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

export default function PhotoAlbums() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const CURRENT_USER_NAME = 'Elena Racana'
  const TREE_ID = '00000000-0000-0000-0000-000000000001'

  useEffect(() => { fetchAlbums() }, [])

  const fetchAlbums = async () => {
    try {
      const { data, error } = await supabase.from('albums').select('*').eq('tree_id', TREE_ID).order('created_at', { ascending: false })
      if (error) throw error
      if (data) setAlbums(data)
    } catch (err: any) {
      const local = localStorage.getItem('apple_demo_albums')
      if (local) setAlbums(JSON.parse(local))
    } finally { setLoading(false) }
  }

  const fetchPhotos = async (albumId: string) => {
    setLoading(true)
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
      const { data, error } = await supabase.from('albums').insert({ tree_id: TREE_ID, name: newAlbumName.trim(), created_by_name: CURRENT_USER_NAME, privacy: 'public' }).select().single()
      if (error) throw error
      if (data) { setAlbums([data, ...albums]); setShowCreateModal(false); setNewAlbumName('') }
    } catch (err) {
      const newLocalAlbum: Album = { id: `local-${Date.now()}`, name: newAlbumName.trim(), created_by_name: CURRENT_USER_NAME, privacy: 'public', cover_url: '' }
      const updated = [newLocalAlbum, ...albums]
      setAlbums(updated); localStorage.setItem('apple_demo_albums', JSON.stringify(updated)); setShowCreateModal(false); setNewAlbumName('')
    }
    setLoading(false)
  }

  return (
    <div style={{ 
      position: 'absolute', top: '100px', left: '340px', // Posición fija lejos del sidebar
      width: '450px', height: '600px', // Tamaño fijo estable
      backgroundColor: '#FAEFBC', borderRadius: '30px', border: '3px solid #2C1810',
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column',
      zIndex: 1000, overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '25px', borderBottom: '1px solid rgba(44,24,16,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {selectedAlbum && <button onClick={() => setSelectedAlbum(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2C1810', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}><ChevronLeft size={16} /> Volver</button>}
          <h2 style={{ fontSize: '20px', fontFamily: 'serif', margin: 0, color: '#2C1810' }}>{selectedAlbum ? selectedAlbum.name : 'Mis Álbumes'}</h2>
        </div>
        {!selectedAlbum ? (
           <button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 15px', backgroundColor: '#2C1810', color: '#FAEFBC', borderRadius: '10px', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: '12px' }}>+ Nuevo</button>
        ) : (
           <label style={{ padding: '8px 15px', backgroundColor: '#2C1810', color: '#FAEFBC', borderRadius: '10px', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: '12px' }}>+ Foto<input type="file" accept="image/*" hidden onChange={(e) => {}} /></label>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid #2C1810', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>
        ) : !selectedAlbum ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {albums.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}><ImageIcon size={48} /><p style={{ fontSize: '13px' }}>Aún no hay álbumes.</p></div> : albums.map(album => (
              <div key={album.id} onClick={() => { setSelectedAlbum(album); fetchPhotos(album.id); }} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', backgroundColor: 'rgba(44,24,16,0.04)', borderRadius: '15px', border: '2px solid #2C1810', cursor: 'pointer' }}>
                <div style={{ width: '50px', height: '50px', flexShrink: 0, backgroundImage: `url(${album.cover_url || 'https://via.placeholder.com/100?text=A'})`, backgroundSize: 'cover', borderRadius: '8px', border: '1px solid #2C1810' }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#2C1810' }}>{album.name}</h4>
                  <p style={{ margin: 0, fontSize: '10px', color: '#D4822A' }}>por: {album.created_by_name}</p>
                </div>
                <ChevronRight size={16} opacity={0.3} />
              </div>
            ))}
          </div>
        ) : (
          /* CARRUSEL SIMPLIFICADO */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
             {photos.length === 0 ? <p style={{ opacity: 0.5 }}>No hay fotos aún.</p> : (
               <>
                 <div style={{ position: 'relative', width: '100%', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <button onClick={() => setActiveIndex(activeIndex > 0 ? activeIndex - 1 : photos.length - 1)} style={{ position: 'absolute', left: 0, zIndex: 10, background: '#2C1810', color: 'white', borderRadius: '50%', width: '30px', height: '30px', border: 'none' }}><ChevronLeft size={16} /></button>
                   <img src={photos[activeIndex].url} style={{ maxWidth: '80%', maxHeight: '100%', borderRadius: '15px', border: '3px solid #2C1810', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', transition: 'transform 0.3s' }} className="zoom-active" />
                   <button onClick={() => setActiveIndex(activeIndex < photos.length - 1 ? activeIndex + 1 : 0)} style={{ position: 'absolute', right: 0, zIndex: 10, background: '#2C1810', color: 'white', borderRadius: '50%', width: '30px', height: '30px', border: 'none' }}><ChevronRight size={16} /></button>
                 </div>
                 <p style={{ fontSize: '12px', fontWeight: '900' }}>{activeIndex + 1} / {photos.length}</p>
               </>
             )}
          </div>
        )}
      </div>

      {/* Modal: Crear Álbum (Corregido para estar dentro y visible) */}
      {showCreateModal && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(27, 46, 27, 0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FAEFBC', padding: '25px', borderRadius: '20px', border: '3px solid #2C1810', width: '100%', maxWidth: '300px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2C1810' }}>Nuevo Álbum</h3>
            <input autoFocus value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} placeholder="Nombre..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #2C1810', marginBottom: '15px', fontWeight: '700' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '10px', background: 'none', border: '2px solid #2C1810', borderRadius: '10px', fontWeight: '900' }}>Cancelar</button>
              <button onClick={handleCreateAlbum} style={{ flex: 1, padding: '10px', backgroundColor: '#2C1810', color: '#FAEFBC', border: 'none', borderRadius: '10px', fontWeight: '900' }}>Crear</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .zoom-active:hover { transform: scale(1.1); }
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-thumb { background: #2C1810; border-radius: 10px; }
      `}</style>
    </div>
  )
}
