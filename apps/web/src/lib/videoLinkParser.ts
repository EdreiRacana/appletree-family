// Video link parser
//
// Reconoce URLs de YouTube y Vimeo dentro de texto libre, extrae el video
// ID, y devuelve tanto la URL de portada como la URL para embeber.
//
// No hace fetch — todo por regex. Cero red, cero cost.

export type VideoPlatform = 'youtube' | 'vimeo'

export interface VideoLink {
  raw: string           // Texto completo del link como lo pegó el usuario
  platform: VideoPlatform
  id: string            // Video ID en la plataforma
  thumbnailUrl: string  // Portada servida por la propia plataforma
  embedUrl: string      // URL para <iframe> del reproductor
}

// Regex que capturan el ID de video de las distintas variantes de URL:
//   youtube.com/watch?v=XXX
//   youtu.be/XXX
//   youtube.com/shorts/XXX
//   youtube.com/embed/XXX
//   m.youtube.com/watch?v=XXX
const YT_PATTERNS: RegExp[] = [
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/i,
  /(?:https?:\/\/)?youtu\.be\/([\w-]{11})/i,
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([\w-]{11})/i,
  /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/embed\/([\w-]{11})/i,
]

const VIMEO_PATTERN = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/i

// Detecta el primer link de video en el texto y lo devuelve. Si no hay,
// devuelve null. Solo se procesa el PRIMER match para no saturar.
export function detectVideoLink(text: string): VideoLink | null {
  if (!text) return null

  for (const pattern of YT_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const id = match[1]
      return {
        raw: match[0],
        platform: 'youtube',
        id,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
      }
    }
  }

  const vimeoMatch = text.match(VIMEO_PATTERN)
  if (vimeoMatch?.[1]) {
    const id = vimeoMatch[1]
    return {
      raw: vimeoMatch[0],
      platform: 'vimeo',
      id,
      // Vimeo requiere fetch a oEmbed para la portada oficial. Como fallback
      // usamos un placeholder — el reproductor real vive en el embed.
      thumbnailUrl: `https://vumbnail.com/${id}.jpg`,
      embedUrl: `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`,
    }
  }

  return null
}

// Extrae TODOS los links de video en un texto (para casos donde alguien
// pega varios). Útil si más adelante queremos permitir 2+ videos en una
// historia.
export function detectAllVideoLinks(text: string): VideoLink[] {
  if (!text) return []
  const found: VideoLink[] = []
  const seen = new Set<string>()

  // Barremos todo el texto buscando cualquier patrón conocido, sin importar
  // orden. Cada match único (por ID) se agrega una vez.
  const allPatterns: Array<{ re: RegExp; platform: VideoPlatform }> = [
    ...YT_PATTERNS.map(re => ({ re: new RegExp(re.source, 'gi'), platform: 'youtube' as const })),
    { re: new RegExp(VIMEO_PATTERN.source, 'gi'), platform: 'vimeo' as const },
  ]

  for (const { re, platform } of allPatterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const id = m[1]
      const key = `${platform}:${id}`
      if (seen.has(key)) continue
      seen.add(key)
      if (platform === 'youtube') {
        found.push({
          raw: m[0], platform, id,
          thumbnailUrl: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
          embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
        })
      } else {
        found.push({
          raw: m[0], platform, id,
          thumbnailUrl: `https://vumbnail.com/${id}.jpg`,
          embedUrl: `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`,
        })
      }
    }
  }
  return found
}

// Reemplaza el link crudo en el texto por un placeholder para que la UI
// no muestre la URL fea junto al card. Devuelve el texto limpio y el link.
export interface SplitResult {
  cleanText: string
  video: VideoLink | null
}

export function splitTextAndVideo(text: string): SplitResult {
  const video = detectVideoLink(text)
  if (!video) return { cleanText: text, video: null }
  // Quita el link raw del texto. Espacios en blanco quedan colapsados.
  const cleanText = text.replace(video.raw, '').replace(/\s+/g, ' ').trim()
  return { cleanText, video }
}
