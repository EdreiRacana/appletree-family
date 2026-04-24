'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Image as ImageIcon, Trash2, Upload, ChevronLeft, Save, ChevronRight, Search, Globe, Lock } from 'lucide-react'
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
      if (data) {
        setPhotos(data)
        setActiveIndex(0)
      }
    } catch (err) {
      const local = localStorage.getItem(`apple_demo_photos_${albumId}`)
      if (local) {
        const p = JSON.parse(local).filter((p: Photo) => !p.url.startsWith('blob:'))
        setPhotos(p)
        setActiveIndex(0)
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
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
      paddingLeft: '140px', // Aumentado para separar del sidebar (contenedor de ligas)
      backgroundColor: 'rgba(27, 46, 27, 0.4)', backdropFilter: 'blur(10px)' 
    }}>
      <div style={{ 
        maxWidth: '550px', width: '100%', backgroundColor: '#FAEFBC', borderRadius: '40px', 
        border: '3px solid #2C1810', boxShadow: '0 30px 100px rgba(0,0,0,0.6)', 
        padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', 
        maxHeight: '80vh', overflow: 'hidden', position: 'relative' 
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {selectedAlbum && <button onClick={() => setSelectedAlbum(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#2C1810', fontWeight: '900', marginBottom: '5px' }}><ChevronLeft size={18} /> Volver</button>}
            <h2 style={{ fontSize: '22px', fontFamily: 'serif', margin: 0, color: '#2C1810', fontWeight: '950' }}>{selectedAlbum ? selectedAlbum.name : 'Mis Álbumes'}</h2>
          </div>
          <button 
            onClick={() => selectedAlbum ? {} : setShowCreateModal(true)} 
            style={{ padding: '8px 16px', backgroundColor: '#2C1810', color: '#FAEFBC', borderRadius: '12px', border: 'none', fontWeight: '900', cursor: 'pointer', fontSize: '12px' }}
          >
            {selectedAlbum ? '+ Foto' : '+ Nuevo'}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid #2C1810', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>
          ) : !selectedAlbum ? (
            /* LISTA VERTICAL */
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '5px' }}>
              {albums.map(album => (
                <div key={album.id} onClick={() => { setSelectedAlbum(album); fetchPhotos(album.id); }} style={{ 
                  display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', backgroundColor: 'rgba(44,24,16,0.03)', 
                  borderRadius: '15px', border: '2px solid #2C1810', cursor: 'pointer' 
                }} className="album-list-item">
                  <div style={{ width: '50px', height: '50px', flexShrink: 0, backgroundImage: `url(${album.cover_url || 'https://via.placeholder.com/200x200?text=Album'})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '10px', border: '2px solid #2C1810' }} />
                  <div style={{ flex: 1 }}>
                     <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '950', color: '#2C1810', fontFamily: 'serif' }}>{album.name}</h4>
                     <p style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: '800', color: '#D4822A' }}>de: {album.created_by_name}</p>
                  </div>
                  <ChevronRight size={18} style={{ opacity: 0.3 }} />
                </div>
              ))}
            </div>
          ) : (
            /* CARRUSEL CON ZOOM CENTRAL */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', justifyContent: 'center', height: '300px', position: 'relative' }}>
                 
                 {/* Prev Button */}
                 <button 
                   onClick={() => setActiveIndex(prev => prev > 0 ? prev - 1 : photos.length - 1)}
                   style={{ position: 'absolute', left: '-10px', zIndex: 10, backgroundColor: '#2C1810', color: '#FAEFBC', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}
                 ><ChevronLeft size={20} /></button>

                 {/* Photos Array */}
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.5s ease' }}>
                    {photos.map((photo, index) => {
                      const isActive = index === activeIndex
                      const isPrev = index === activeIndex - 1 || (activeIndex === 0 && index === photos.length - 1)
                      const isNext = index === activeIndex + 1 || (activeIndex === photos.length - 1 && index === 0)
                      
                      if (!isActive && !isPrev && !isNext && photos.length > 3) return null

                      return (
                        <div key={photo.id} style={{ 
                          width: isActive ? '220px' : '100px',
                          height: isActive ? '220px' : '100px',
                          borderRadius: '15px',
                          border: isActive ? '4px solid #2C1810' : '2px solid rgba(44,24,16,0.3)',
                          overflow: 'hidden',
                          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                          transform: isActive ? 'scale(1.1)' : 'scale(1)',
                          opacity: isActive ? 1 : 0.4,
                          boxShadow: isActive ? '0 20px 40px rgba(0,0,0,0.3)' : 'none',
                          cursor: 'pointer'
                        }} onClick={() => setActiveIndex(index)}>
                          <img src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )
                    })}
                 </div>

                 {/* Next Button */}
                 <button 
                   onClick={() => setActiveIndex(prev => prev < photos.length - 1 ? prev + 1 : 0)}
                   style={{ position: 'absolute', right: '-10px', zIndex: 10, backgroundColor: '#2C1810', color: '#FAEFBC', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}
                 ><ChevronRight size={20} /></button>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                 <p style={{ margin: 0, fontSize: '11px', fontWeight: '900', color: '#2C1810' }}>
                   Imagen {activeIndex + 1} de {photos.length}
                 </p>
                 <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '10px' }}>
                    {photos.map((_, i) => (
                      <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: i === activeIndex ? '#2C1810' : 'rgba(44,24,16,0.2)', transition: 'all 0.3s' }} />
                    ))}
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Create Album */}
        {showCreateModal && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 26, 15, 0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: '#FAEFBC', padding: '30px', borderRadius: '24px', border: '3px solid #2C1810', width: '280px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 style={{ margin: 0, fontFamily: 'serif', color: '#2C1810', fontSize: '20px' }}>Nuevo Álbum</h3>
              <input autoFocus value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '2px solid #2C1810', fontWeight: '700' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '10px', background: 'none', border: '2px solid #2C1810', fontWeight: '900', cursor: 'pointer', borderRadius: '10px' }}>Cerrar</button>
                <button onClick={handleCreateAlbum} style={{ flex: 1, padding: '10px', backgroundColor: '#2C1810', color: '#FAEFBC', border: 'none', fontWeight: '900', cursor: 'pointer', borderRadius: '10px' }}>Crear</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .album-list-item:hover { background-color: rgba(44,24,16,0.08) !important; transform: translateX(5px); }
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-thumb { background: #2C1810; border-radius: 10px; }
      `}</style>
    </div>
  )
}
