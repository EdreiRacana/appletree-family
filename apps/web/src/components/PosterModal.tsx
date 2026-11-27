'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X, Download } from 'lucide-react'
import type { Member, Relationship } from '@/lib/types'
import { renderPoster, posterFileName, POSTER_SIZES, type PosterStyle, type PosterSize } from '@/lib/poster'

// Ventana "Póster del árbol": vista previa en vivo, estilo y tamaño, y
// descarga en alta resolución (JPG listo para imprimir).
export default function PosterModal({ members, relationships, familyName, onClose }: {
  members: Member[]
  relationships: Relationship[]
  familyName: string
  onClose: () => void
}) {
  const [style, setStyle] = useState<PosterStyle>('noche')
  const [size, setSize] = useState<PosterSize>('carta')
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    setPreview(null)
    renderPoster({ members, relationships, familyName, style, size, scale: 0.3 })
      .then(c => { if (id === seq.current) setPreview(c.toDataURL('image/jpeg', 0.85)) })
      .catch(() => { if (id === seq.current) setError('No se pudo preparar la vista previa.') })
  }, [members, relationships, familyName, style, size])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const download = async () => {
    setBusy(true); setError('')
    try {
      const canvas = await renderPoster({ members, relationships, familyName, style, size })
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.93))
      if (!blob) throw new Error('blob')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = posterFileName(familyName)
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch {
      setError('No se pudo crear el póster. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const choice = (active: boolean): React.CSSProperties => ({
    flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
    border: active ? '1.5px solid var(--accent-gold)' : '1px solid var(--menu-border)',
    background: active ? 'var(--menu-active)' : 'transparent', color: 'var(--menu-fg)',
  })

  return (
    <div role="dialog" aria-modal="true" aria-label="Póster del árbol"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000, background: 'var(--glass-overlay, rgba(8,12,8,0.6))',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div style={{
        width: 'min(760px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', borderRadius: 22,
        background: 'var(--glass-card-bg, rgba(22,30,22,0.92))', color: 'var(--menu-fg)',
        border: '1px solid var(--menu-border)', boxShadow: 'var(--panel-shadow)', padding: '22px 22px 20px',
        animation: 'afModalIn 0.35s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--accent-gold)', fontWeight: 600 }}>
              Póster del árbol
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.75 }}>
              Tu familia completa en alta calidad, lista para imprimir y enmarcar.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{
            width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--menu-border)', cursor: 'pointer',
            background: 'transparent', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={16} /></button>
        </div>

        <div style={{
          position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#0E1710',
          aspectRatio: `${POSTER_SIZES[size].w} / ${POSTER_SIZES[size].h}`, boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}>
          {preview
            ? <img src={preview} alt="Vista previa del póster" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: 13 }}>
                <span style={{ width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'afSpin 0.8s linear infinite', marginRight: 10 }} />
                Preparando vista previa…
              </div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: 8 }}>Estilo</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['noche', 'Noche dorada', 'Fondo oscuro elegante'], ['pergamino', 'Pergamino', 'Claro, tono antiguo']] as const).map(([id, label, sub]) => (
                <button key={id} onClick={() => setStyle(id)} aria-pressed={style === id} style={choice(style === id)}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5 }}>{label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, opacity: 0.65 }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: 8 }}>Tamaño</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(Object.keys(POSTER_SIZES) as PosterSize[]).map(id => (
                <button key={id} onClick={() => setSize(id)} aria-pressed={size === id} style={choice(size === id)}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5 }}>{POSTER_SIZES[id].label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, opacity: 0.65 }}>{POSTER_SIZES[id].sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div style={{ marginTop: 12, fontSize: 13, color: '#E57373' }}>{error}</div>}

        <button onClick={download} disabled={busy} style={{
          marginTop: 18, width: '100%', padding: '14px 18px', borderRadius: 14, border: 'none',
          background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)', color: '#16201A',
          fontWeight: 800, fontSize: 15, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 8px 22px rgba(184,134,11,0.35)',
        }}>
          {busy
            ? <><span style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'afSpin 0.8s linear infinite' }} /> Creando póster en alta calidad…</>
            : <><Download size={18} /> Descargar póster</>}
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 11.5, opacity: 0.6, textAlign: 'center' }}>
          Se descarga como imagen JPG de alta resolución. Llévala a cualquier imprenta o imprímela en casa.
        </p>
      </div>
    </div>
  )
}
