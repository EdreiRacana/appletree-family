'use client'

// Álbumes de fotos de la familia.
// - Todo se guarda en Supabase (tablas albums/photos + bucket family-photos),
//   nunca solo en el navegador: lo que sube uno lo ve toda la familia.
// - Cualquier miembro crea álbumes y sube fotos (varias a la vez).
// - Renombrar/borrar: quien lo creó o un administrador del árbol.
// - Ver una foto en grande: la misma ventana que Historias.
import React, { useEffect, useRef, useState } from 'react'
import { X, Image as ImageIcon, Trash2, Upload, ChevronLeft, Pencil, Loader2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTreeRole } from '@/lib/useTreeRole'
import StoryLightbox from './StoryLightbox'

interface Album {
  id: string
  name: string
  cover_url: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
}

interface Photo {
  id: string
  url: string
  storage_path: string | null
  caption: string | null
  uploaded_by: string
  uploaded_by_name: string | null
}

interface PhotoAlbumsProps {
  treeId: string
  onClose?: () => void
}

const BUCKET = 'family-photos'

// Reduce el tamaño sin perder calidad visible (máx. 1800px, JPEG 85%).
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Formato de imagen no compatible'))
      img.onload = () => {
        const MAX = 1800
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          const k = MAX / Math.max(w, h)
          w = Math.round(w * k); h = Math.round(h * k)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo comprimir'))), 'image/jpeg', 0.85)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function PhotoAlbums({ treeId, onClose }: PhotoAlbumsProps) {
  const { isAdmin } = useTreeRole(treeId)
  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [selected, setSelected] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [viewer, setViewer] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      const name = (u.user_metadata?.full_name as string | undefined) || u.email?.split('@')[0] || 'Un familiar'
      setMe({ id: u.id, name })
    })
  }, [])

  const canManage = (createdBy: string) => isAdmin || (!!me && me.id === createdBy)

  useEffect(() => {
    let alive = true
    supabase
      .from('albums').select('*').eq('tree_id', treeId).order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) setError('No se pudieron cargar los álbumes.')
        setAlbums((data as Album[]) ?? [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [treeId])

  const openAlbum = async (album: Album) => {
    setSelected(album); setPhotos([]); setError(''); setLoading(true)
    const { data, error: err } = await supabase
      .from('photos').select('*').eq('album_id', album.id).order('created_at', { ascending: true })
    if (err) setError('No se pudieron cargar las fotos.')
    setPhotos((data as Photo[]) ?? [])
    setLoading(false)
  }

  const createAlbum = async () => {
    const name = newName.trim()
    if (!name) return
    setError('')
    const { data, error: err } = await supabase
      .from('albums').insert({ tree_id: treeId, name, created_by_name: me?.name ?? null }).select().single()
    if (err || !data) { setError('No se pudo crear el álbum. Intenta de nuevo.'); return }
    setAlbums(prev => [data as Album, ...prev])
    setCreating(false); setNewName('')
    openAlbum(data as Album)
  }

  const renameAlbum = async (album: Album) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name || name === album.name) return
    const { error: err } = await supabase.from('albums').update({ name }).eq('id', album.id)
    if (err) { setError('No se pudo renombrar.'); return }
    setAlbums(prev => prev.map(a => (a.id === album.id ? { ...a, name } : a)))
    if (selected?.id === album.id) setSelected({ ...album, name })
  }

  const deleteAlbum = async (album: Album) => {
    if (!window.confirm(`¿Borrar el álbum "${album.name}" y todas sus fotos? No se puede deshacer.`)) return
    const { data: ph } = await supabase.from('photos').select('storage_path').eq('album_id', album.id)
    const paths = ((ph as { storage_path: string | null }[]) ?? []).map(p => p.storage_path).filter((p): p is string => !!p)
    const { error: err } = await supabase.from('albums').delete().eq('id', album.id)
    if (err) { setError('No se pudo borrar el álbum.'); return }
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
    setAlbums(prev => prev.filter(a => a.id !== album.id))
    if (selected?.id === album.id) { setSelected(null); setPhotos([]) }
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !files.length || !selected) return
    setError('')
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!list.length) { setError('Elige archivos de imagen.'); return }
    setUploading({ done: 0, total: list.length })
    let failed = 0
    let cover = selected.cover_url
    for (const file of list) {
      try {
        const blob = await compressImage(file)
        const path = `${treeId}/${selected.id}/${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
        if (upErr) throw upErr
        const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
        const { data, error: dbErr } = await supabase.from('photos').insert({
          album_id: selected.id, tree_id: treeId, url, storage_path: path, uploaded_by_name: me?.name ?? null,
        }).select().single()
        if (dbErr || !data) { await supabase.storage.from(BUCKET).remove([path]); throw dbErr }
        setPhotos(prev => [...prev, data as Photo])
        if (!cover) {
          cover = url
          await supabase.from('albums').update({ cover_url: url }).eq('id', selected.id)
          setAlbums(prev => prev.map(a => (a.id === selected.id ? { ...a, cover_url: url } : a)))
        }
      } catch {
        failed++
      }
      setUploading(u => (u ? { ...u, done: u.done + 1 } : u))
    }
    setUploading(null)
    if (fileRef.current) fileRef.current.value = ''
    if (failed) setError(failed === list.length ? 'No se pudo subir ninguna foto. Revisa tu conexión e intenta de nuevo.' : `${failed} foto(s) no se pudieron subir.`)
  }

  const deletePhoto = async (photo: Photo) => {
    if (!window.confirm('¿Borrar esta foto? No se puede deshacer.')) return
    const { error: err } = await supabase.from('photos').delete().eq('id', photo.id)
    if (err) { setError('No se pudo borrar la foto.'); return }
    if (photo.storage_path) await supabase.storage.from(BUCKET).remove([photo.storage_path])
    const rest = photos.filter(p => p.id !== photo.id)
    setPhotos(rest)
    setViewer(null)
    if (selected && selected.cover_url === photo.url) {
      const nextCover = rest[0]?.url ?? null
      await supabase.from('albums').update({ cover_url: nextCover }).eq('id', selected.id)
      setAlbums(prev => prev.map(a => (a.id === selected.id ? { ...a, cover_url: nextCover } : a)))
      setSelected({ ...selected, cover_url: nextCover })
    }
  }

  const dark = '#2C1810'
  const btn: React.CSSProperties = {
    padding: '8px 14px', backgroundColor: dark, color: '#FAEFBC', borderRadius: 12, border: 'none',
    fontWeight: 800, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
  }
  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', color: dark, padding: 6, display: 'flex', opacity: 0.6,
  }

  return (
    <div style={{
      position: 'fixed', top: 92, right: 18, bottom: 18, width: 'min(520px, calc(100vw - 40px))',
      backgroundColor: '#FAEFBC', borderRadius: 20, border: '2px solid rgba(44,24,16,0.35)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden',
    }}>
      {/* Encabezado */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(44,24,16,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {selected && (
            <button onClick={() => { setSelected(null); setError('') }} style={{ ...iconBtn, padding: 0, opacity: 0.7, fontSize: 11, fontWeight: 800, gap: 4, alignItems: 'center', marginBottom: 2 }}>
              <ChevronLeft size={14} /> Álbumes
            </button>
          )}
          <h2 style={{ fontSize: 18, fontFamily: 'Georgia, serif', margin: 0, color: dark, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected ? selected.name : 'Fotos de la familia'}
          </h2>
          {selected && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8B5E2A' }}>
              {photos.length} foto{photos.length === 1 ? '' : 's'}{selected.created_by_name ? ` · creado por ${selected.created_by_name}` : ''}
            </p>
          )}
        </div>
        {!selected ? (
          <button onClick={() => { setCreating(true); setError('') }} style={btn}><Plus size={14} /> Nuevo álbum</button>
        ) : (
          <label style={{ ...btn, opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
            <Upload size={14} /> Subir fotos
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => uploadFiles(e.target.files)} />
          </label>
        )}
        {onClose && (
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(44,24,16,0.25)', background: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark }}>
            <X size={16} />
          </button>
        )}
      </div>

      {error && (
        <p role="alert" style={{ margin: '10px 16px 0', padding: '8px 12px', borderRadius: 10, background: 'rgba(192,57,43,0.1)', color: '#A93226', fontSize: 12, fontWeight: 700 }}>{error}</p>
      )}
      {uploading && (
        <p style={{ margin: '10px 16px 0', padding: '8px 12px', borderRadius: 10, background: 'rgba(44,24,16,0.06)', color: dark, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} className="animate-spin" /> Subiendo {uploading.done + 1 > uploading.total ? uploading.total : uploading.done + 1} de {uploading.total}…
        </p>
      )}

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 14, scrollbarWidth: 'thin' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 className="animate-spin" size={30} color={dark} /></div>
        ) : !selected ? (
          albums.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: dark, opacity: 0.6 }}>
              <ImageIcon size={44} />
              <p style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>Todavía no hay álbumes.<br />Crea el primero y sube las fotos de la familia.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {albums.map(album => (
                <div key={album.id} style={{ background: 'white', borderRadius: 14, border: '1.5px solid rgba(44,24,16,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <button onClick={() => openAlbum(album)} aria-label={`Abrir ${album.name}`} style={{
                    border: 'none', padding: 0, cursor: 'pointer', aspectRatio: '4 / 3', width: '100%',
                    background: album.cover_url ? `center / cover no-repeat url(${album.cover_url})` : 'linear-gradient(135deg,#D4822A,#B8691A)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!album.cover_url && <ImageIcon size={26} color="#FAEFBC" />}
                  </button>
                  <div style={{ padding: '8px 8px 8px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {renamingId === album.id ? (
                        <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => renameAlbum(album)}
                          onKeyDown={e => { if (e.key === 'Enter') renameAlbum(album); if (e.key === 'Escape') setRenamingId(null) }}
                          style={{ width: '100%', padding: '3px 6px', borderRadius: 6, border: `1.5px solid ${dark}`, fontSize: 13, fontWeight: 700 }} />
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.name}</p>
                      )}
                      {album.created_by_name && <p style={{ margin: 0, fontSize: 10, color: '#8B5E2A' }}>por {album.created_by_name}</p>}
                    </div>
                    {canManage(album.created_by) && renamingId !== album.id && (
                      <>
                        <button onClick={() => { setRenameValue(album.name); setRenamingId(album.id) }} aria-label="Renombrar álbum" style={iconBtn}><Pencil size={13} /></button>
                        <button onClick={() => deleteAlbum(album)} aria-label="Borrar álbum" style={{ ...iconBtn, color: '#A93226' }}><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : photos.length === 0 && !uploading ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: dark, opacity: 0.6 }}>
            <ImageIcon size={44} />
            <p style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>Este álbum está vacío.<br />Toca <strong>Subir fotos</strong> (puedes elegir varias).</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {photos.map((p, i) => (
              <button key={p.id} onClick={() => setViewer(i)} aria-label={`Ver foto ${i + 1}`} style={{
                border: 'none', padding: 0, cursor: 'zoom-in', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden',
                background: `center / cover no-repeat url(${p.url})`, boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Crear álbum */}
      {creating && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(27,46,27,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ backgroundColor: '#FAEFBC', padding: 26, borderRadius: 20, width: '100%', maxWidth: 300, textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 14px', color: dark, fontSize: 19, fontFamily: 'Georgia, serif' }}>Nuevo álbum</h3>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} maxLength={120}
              onKeyDown={e => { if (e.key === 'Enter') createAlbum() }}
              placeholder="Ej. Navidad 2025" style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: `2px solid ${dark}`, marginBottom: 16, fontWeight: 700 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setCreating(false); setNewName('') }} style={{ flex: 1, padding: 11, background: 'none', border: `2px solid ${dark}`, borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={createAlbum} style={{ ...btn, flex: 1, justifyContent: 'center', padding: 11 }}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Ver foto en grande (misma ventana que Historias) */}
      {viewer !== null && selected && photos[viewer] && (
        <>
          <StoryLightbox
            stories={photos.map((p, i) => ({
              id: p.id, imageUrl: p.url, title: selected.name,
              description: p.uploaded_by_name ? `Subida por ${p.uploaded_by_name}` : null,
            }))}
            index={viewer}
            onIndexChange={setViewer}
            onClose={() => setViewer(null)}
          />
          {canManage(photos[viewer].uploaded_by) && (
            <button onClick={() => deletePhoto(photos[viewer])} style={{
              position: 'fixed', top: 14, right: 64, zIndex: 13001, height: 40, padding: '0 14px', borderRadius: 20,
              border: '1px solid rgba(255,107,107,0.6)', background: 'rgba(40,10,10,0.7)', color: '#FF8A8A',
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              <Trash2 size={14} /> Borrar foto
            </button>
          )}
        </>
      )}

    </div>
  )
}
