// AppleTree Family — Image utilities
// Downscales and compresses an image File into a small JPEG data URL.
// Goal: keep avatar payloads tiny so the apple medallion never saturates
// the container and the value stays light enough to store inline.

export async function fileToDownscaledDataUrl(
  file: File,
  maxSize = 320,
  quality = 0.72
): Promise<string> {
  // 1. Read the file as a data URL
  const sourceDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })

  // 2. Decode into an <img>
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
    image.src = sourceDataUrl
  })

  // 3. Compute the downscaled dimensions (never upscale)
  const longest = Math.max(img.width, img.height) || 1
  const scale = Math.min(1, maxSize / longest)
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  // 4. Draw onto a canvas and export as compressed JPEG
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return sourceDataUrl
  ctx.drawImage(img, 0, 0, w, h)

  return canvas.toDataURL('image/jpeg', quality)
}
