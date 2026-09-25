// AppleTree Family — Image utilities
//
// - fileToDownscaledDataUrl: comprime a data URL (base64). Legado, aún se usa
//   como preview en algunos modales.
// - compressImageToBlob: NUEVO. Comprime a Blob (mucho más ligero que base64
//   y listo para subir a Supabase Storage).
// - uploadImageToBucket: NUEVO. Comprime + sube al bucket + devuelve URL
//   pública. Es lo que usan EditMemberModal y ChatPanel.
//
// Compresión adaptativa: si el original ya es liviano (<500 KB) se usa calidad
// alta (0.85). Si es pesado (>5 MB, típico celular) se aprieta más (0.70).
// Así fotos chicas conservan calidad y las gigantes bajan más agresivo.

import { supabase } from './supabase'

// ============================================================================
// Compresión
// ============================================================================

interface CompressOptions {
  maxSize?: number     // píxeles del lado más largo (default 800)
  quality?: number     // 0..1 — si se pasa, sobrescribe el adaptativo
}

function pickAdaptiveQuality(fileSize: number): number {
  // fileSize en bytes.
  if (fileSize < 500 * 1024)         return 0.85   // <500 KB: casi sin pérdida
  if (fileSize < 2 * 1024 * 1024)    return 0.78   // <2 MB
  if (fileSize < 5 * 1024 * 1024)    return 0.72   // <5 MB
  return 0.65                                       // >=5 MB: aprieta duro
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

async function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
    img.src = dataUrl
  })
}

function drawToCanvas(img: HTMLImageElement, maxSize: number): HTMLCanvasElement {
  const longest = Math.max(img.width, img.height) || 1
  const scale = Math.min(1, maxSize / longest)
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

// Comprime a data URL (base64). Legado — nuevo código debería usar Blob/upload.
export async function fileToDownscaledDataUrl(
  file: File,
  maxSize = 320,
  quality = 0.72
): Promise<string> {
  const src = await readFileAsDataUrl(file)
  const img = await decodeImage(src)
  const canvas = drawToCanvas(img, maxSize)
  return canvas.toDataURL('image/jpeg', quality)
}

// Comprime a Blob listo para subir. Calidad adaptativa según peso original.
export async function compressImageToBlob(
  file: File,
  opts: CompressOptions = {}
): Promise<Blob> {
  const maxSize = opts.maxSize ?? 800
  const quality = opts.quality ?? pickAdaptiveQuality(file.size)

  const src = await readFileAsDataUrl(file)
  const img = await decodeImage(src)
  const canvas = drawToCanvas(img, maxSize)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen')),
      'image/jpeg',
      quality,
    )
  })
}

// ============================================================================
// Upload a Supabase Storage
// ============================================================================

interface UploadResult {
  url: string       // URL pública final
  path: string      // path dentro del bucket (útil para borrar después)
  size: number      // tamaño final en bytes
}

// Sube una imagen a un bucket público de Supabase Storage y devuelve la URL
// pública. Comprime automáticamente antes de subir.
//
//   bucket: 'avatars' | 'chat-attachments' | etc. (debe existir en Storage)
//   file:   el File del input.
//   folder: subcarpeta opcional dentro del bucket (ej. user_id o chat_id).
//   maxSize/quality: sobrescribe compresión por defecto.
export async function uploadImageToBucket(
  bucket: string,
  file: File,
  opts: CompressOptions & { folder?: string } = {}
): Promise<UploadResult> {
  const blob = await compressImageToBlob(file, opts)

  // Nombre único: <timestamp>-<random>.jpg  (evita colisiones y cache stale)
  const random = Math.random().toString(36).slice(2, 8)
  const filename = `${Date.now()}-${random}.jpg`
  const path = opts.folder ? `${opts.folder}/${filename}` : filename

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',   // 1 año — como el nombre es único, es seguro
      upsert: false,
    })

  if (error) throw new Error(`Error subiendo imagen: ${error.message}`)

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
  if (!pub?.publicUrl) throw new Error('No se pudo obtener la URL pública')

  return { url: pub.publicUrl, path, size: blob.size }
}

// Borra una imagen del bucket (útil al reemplazar avatar o eliminar mensaje).
// Silent-fail: si no existe o falla, no lanza excepción (mejor UX).
export async function deleteImageFromBucket(bucket: string, path: string): Promise<void> {
  try { await supabase.storage.from(bucket).remove([path]) } catch { /* ignore */ }
}
