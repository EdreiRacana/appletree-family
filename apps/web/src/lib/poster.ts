import type { Member, Relationship } from './types'
import { computeTreeLayout, NODE_SIZE } from './treeLayout'

// Póster del árbol para imprimir: se dibuja en un <canvas> a ~300 ppp con el
// mismo acomodo de manzanas que la app, título de la familia y pie con fecha.

export type PosterStyle = 'noche' | 'pergamino'
export type PosterSize = 'carta' | 'a3'

// Carta horizontal 11×8.5 in a 300 ppp. A3 a ~290 ppp para no pasar el
// límite de 16.7 MP de los iPhone.
export const POSTER_SIZES: Record<PosterSize, { w: number, h: number, label: string, sub: string }> = {
  carta: { w: 3300, h: 2550, label: 'Carta', sub: '28 × 22 cm · impresora de casa' },
  a3: { w: 4800, h: 3394, label: 'Póster A3', sub: '42 × 30 cm · para enmarcar' },
}

interface PosterOptions {
  members: Member[]
  relationships: Relationship[]
  familyName: string
  style: PosterStyle
  size: PosterSize
  scale?: number          // < 1 para la vista previa
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const imgCache = new Map<string, Promise<HTMLImageElement | null>>()

// Se descarga como blob para que una foto sin permisos (CORS) no "manche" el
// canvas: si falla, se usan las iniciales.
function loadImage(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  if (!imgCache.has(src)) {
    imgCache.set(src, (async () => {
      try {
        const res = await fetch(src, { mode: 'cors' })
        if (!res.ok) return null
        const url = URL.createObjectURL(await res.blob())
        const img = new Image()
        img.src = url
        await img.decode()
        return img
      } catch { return null }
    })())
  }
  return imgCache.get(src)!
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, alignBottom = false) {
  const r = Math.max(w / img.width, h / img.height)
  const dw = img.width * r, dh = img.height * r
  ctx.drawImage(img, x + (w - dw) / 2, alignBottom ? y + h - dh : y + (h - dh) / 2, dw, dh)
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: (px: number) => string, px: number) {
  let size = px
  ctx.font = font(size)
  while (ctx.measureText(text).width > maxW && size > px * 0.55) {
    size *= 0.92
    ctx.font = font(size)
  }
  if (ctx.measureText(text).width > maxW) {
    let t = text
    while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
    return t + '…'
  }
  return text
}

function drawRibbon(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  // Mismo listón de MourningRibbon (viewBox 40×56), escalado a alto h.
  const k = h / 56
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(14 * Math.PI / 180)
  ctx.scale(k, k)
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  const back = new Path2D('M20 5 C31 5, 34 17, 20 30 L7 54')
  const front = new Path2D('M20 5 C9 5, 6 17, 20 30 L33 54')
  for (const [p, c] of [[back, '#0c0c0c'], [front, '#262626']] as const) {
    ctx.strokeStyle = 'rgba(220,220,220,0.55)'; ctx.lineWidth = 9.4; ctx.stroke(p)
    ctx.strokeStyle = c; ctx.lineWidth = 8; ctx.stroke(p)
  }
  ctx.restore()
}

export async function renderPoster(opts: PosterOptions): Promise<HTMLCanvasElement> {
  const { members, relationships, familyName, style } = opts
  const sc = opts.scale ?? 1
  const W = Math.round(POSTER_SIZES[opts.size].w * sc)
  const H = Math.round(POSTER_SIZES[opts.size].h * sc)
  const dark = style === 'noche'
  const gold = dark ? '#D4AF37' : '#8B6508'
  const ink = dark ? '#F5E6C8' : '#3B2A10'

  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready.catch(() => {})
  // La fuente de títulos de la app (puede venir como var(--…) de next/font).
  const probe = document.createElement('span')
  probe.style.fontFamily = "var(--font-display, 'Cormorant Garamond', Georgia, serif)"
  document.body.appendChild(probe)
  const serif = getComputedStyle(probe).fontFamily || "'Cormorant Garamond', Georgia, serif"
  probe.remove()
  // Que la fuente de título esté descargada antes de dibujar (si no, el
  // canvas usa una genérica).
  await document.fonts?.load?.(`600 48px ${serif}`).catch(() => {})

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  const positioned = computeTreeLayout(members, relationships)
  const [treeImg, appleRed, appleGreen, logo] = await Promise.all([
    loadImage('/assets/arbol-base.png'),
    loadImage('/assets/Manzana_roja.png'),
    loadImage('/assets/Manzana_verde.png'),
    loadImage('/assets/logo.png'),
  ])
  const avatars = new Map<string, HTMLImageElement | null>()
  await Promise.all(positioned.map(async m => { avatars.set(m.id, await loadImage(m.avatarUrl)) }))

  // ── Fondo ──
  if (dark) {
    ctx.fillStyle = '#0E1710'
    ctx.fillRect(0, 0, W, H)
    if (treeImg) { ctx.globalAlpha = 0.92; drawCover(ctx, treeImg, 0, 0, W, H, true); ctx.globalAlpha = 1 }
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.3)
    top.addColorStop(0, 'rgba(8,14,10,0.92)'); top.addColorStop(1, 'rgba(8,14,10,0)')
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, H * 0.3)
    const bot = ctx.createLinearGradient(0, H * 0.82, 0, H)
    bot.addColorStop(0, 'rgba(8,14,10,0)'); bot.addColorStop(1, 'rgba(8,14,10,0.9)')
    ctx.fillStyle = bot; ctx.fillRect(0, H * 0.82, W, H * 0.18)
    const vig = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75)
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
  } else {
    const bg = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.5, Math.max(W, H) * 0.7)
    bg.addColorStop(0, '#FBF5E6'); bg.addColorStop(1, '#E6D6B2')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    if (treeImg) {
      ctx.save()
      ctx.globalAlpha = 0.33
      ctx.filter = 'sepia(1) saturate(0.55) brightness(1.15) contrast(0.9)'
      drawCover(ctx, treeImg, 0, 0, W, H, true)
      ctx.restore()
    }
  }

  // Marco dorado doble
  const m1 = Math.min(W, H) * 0.022
  ctx.strokeStyle = gold
  ctx.globalAlpha = dark ? 0.75 : 0.85
  ctx.lineWidth = Math.max(2, W * 0.0013)
  ctx.strokeRect(m1, m1, W - 2 * m1, H - 2 * m1)
  ctx.lineWidth = Math.max(1, W * 0.0005)
  ctx.strokeRect(m1 * 1.45, m1 * 1.45, W - 2.9 * m1, H - 2.9 * m1)
  ctx.globalAlpha = 1

  // ── Título ──
  const gens = new Set(members.map(m => m.generation ?? 0)).size
  ctx.fillStyle = gold
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)'
  ctx.shadowBlur = H * 0.01
  const title = fitText(ctx, familyName, W * 0.8, px => `600 ${px}px ${serif}`, H * 0.072)
  ctx.fillText(title, W / 2, H * 0.115)
  ctx.shadowBlur = 0
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.85
  ctx.font = `600 ${H * 0.017}px 'Helvetica Neue', Arial, sans-serif`
  const sub = `ÁRBOL GENEALÓGICO  ·  ${members.length} ${members.length === 1 ? 'FAMILIAR' : 'FAMILIARES'}  ·  ${gens} ${gens === 1 ? 'GENERACIÓN' : 'GENERACIONES'}`
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${H * 0.004}px`
  ctx.fillText(sub, W / 2, H * 0.155)
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'
  ctx.globalAlpha = 1
  // Adorno bajo el subtítulo
  ctx.strokeStyle = gold; ctx.lineWidth = Math.max(1.5, H * 0.0011)
  ctx.beginPath(); ctx.moveTo(W / 2 - W * 0.09, H * 0.172); ctx.lineTo(W / 2 - W * 0.012, H * 0.172)
  ctx.moveTo(W / 2 + W * 0.012, H * 0.172); ctx.lineTo(W / 2 + W * 0.09, H * 0.172); ctx.stroke()
  ctx.fillStyle = gold
  ctx.beginPath(); ctx.arc(W / 2, H * 0.172, H * 0.0035, 0, Math.PI * 2); ctx.fill()

  // ── Acomodo de las manzanas dentro de la copa ──
  if (positioned.length) {
    const label = NODE_SIZE * 0.1
    const minX = Math.min(...positioned.map(p => p.canvasX)) - NODE_SIZE / 2
    const maxX = Math.max(...positioned.map(p => p.canvasX)) + NODE_SIZE / 2
    const minY = Math.min(...positioned.map(p => p.canvasY))
    const maxY = Math.max(...positioned.map(p => p.canvasY)) + NODE_SIZE + label
    // Encajar TODAS las manzanas dentro de la copa de la foto (misma cúpula
    // que usa la app, medida sobre arbol-base.png de 1536×1024). La foto se
    // dibuja "cover" pegada abajo, así que se convierte a coordenadas del póster.
    const ir = Math.max(W / 1536, H / 1024)
    const imgLeft = (W - 1536 * ir) / 2
    const imgTop = H - 1024 * ir
    const insideCanopy = (px: number, py: number) => {
      const ix = (px - imgLeft) / ir, iy = (py - imgTop) / ir
      const dx = Math.abs(ix - 757)
      if (iy < 620) {
        const ex = dx / (595 * 0.9), ey = (620 - iy) / (480 * 0.9)
        return ex * ex + ey * ey <= 1
      }
      if (iy <= 700) return dx <= 595 * 0.9
      return iy <= 860 && dx <= 150
    }
    const pts: Array<[number, number]> = []
    for (const p of positioned) {
      pts.push([p.canvasX - NODE_SIZE * 0.42, p.canvasY + NODE_SIZE * 0.1], [p.canvasX + NODE_SIZE * 0.42, p.canvasY + NODE_SIZE * 0.1],
        [p.canvasX - NODE_SIZE * 0.42, p.canvasY + NODE_SIZE * 0.95], [p.canvasX + NODE_SIZE * 0.42, p.canvasY + NODE_SIZE * 0.95])
    }
    const titleBottom = H * 0.19
    const canopyCX = imgLeft + 757 * ir
    const canopyTop = Math.max(imgTop + 140 * ir, titleBottom)
    const canopyBot = imgTop + 860 * ir
    const fits = (sc: number, fx: number, fy: number) => pts.every(([px, py]) => {
      const sx = px * sc + fx, sy = py * sc + fy
      return sy >= titleBottom && sy <= H * 0.88 && sx >= W * 0.04 && sx <= W * 0.96 && insideCanopy(sx, sy)
    })
    const treeCX = (minX + maxX) / 2
    const treeH = maxY - minY
    let best: { s: number, ox: number, oy: number } | null = null
    for (let sc = (W * 0.09) / NODE_SIZE; sc >= (W * 0.012) / NODE_SIZE && !best; sc *= 0.97) {
      const span = canopyBot - canopyTop - treeH * sc
      if (span < 0) continue
      const fx = canopyCX - treeCX * sc
      for (let k = 0; k <= 30; k++) {
        const fy = canopyTop + (span * k) / 30 - minY * sc
        if (fits(sc, fx, fy)) { best = { s: sc, ox: fx, oy: fy }; break }
      }
    }
    if (!best) {
      // Familia enorme: que quepa toda en el área central.
      const region = { x: W * 0.06, y: H * 0.2, w: W * 0.88, h: H * 0.6 }
      const sc = Math.min(region.w / (maxX - minX), region.h / (maxY - minY), (W * 0.09) / NODE_SIZE)
      best = { s: sc, ox: region.x + (region.w - (maxX - minX) * sc) / 2 - minX * sc, oy: region.y + (region.h - treeH * sc) / 2 - minY * sc }
    }
    const { s, ox, oy } = best
    const n = NODE_SIZE * s
    const X = (x: number) => ox + x * s
    const Y = (y: number) => oy + y * s
    const byId = new Map(positioned.map(p => [p.id, p]))

    // Ramas (padres → hijos) y parejas
    ctx.lineCap = 'round'
    ctx.strokeStyle = dark ? 'rgba(245,230,200,0.6)' : 'rgba(92,64,30,0.55)'
    ctx.lineWidth = Math.max(1.5, n * 0.022)
    positioned.forEach(child => {
      const ps = (child.parents ?? []).map(id => byId.get(id)).filter(Boolean) as typeof positioned
      if (!ps.length) return
      const mx = ps.reduce((a, p) => a + p.canvasX, 0) / ps.length
      const my = ps.reduce((a, p) => a + p.canvasY, 0) / ps.length
      if (child.canvasY >= my) return
      const x1 = X(mx), y1 = Y(my + NODE_SIZE / 2), x2 = X(child.canvasX), y2 = Y(child.canvasY + NODE_SIZE)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.bezierCurveTo(x1, (y1 + y2) / 2, x2, (y1 + y2) / 2, x2, y2)
      ctx.stroke()
    })
    ctx.setLineDash([n * 0.05, n * 0.05])
    relationships.filter(r => r.relationship === 'spouse').forEach(r => {
      const a = byId.get(r.member1Id), b = byId.get(r.member2Id)
      if (!a || !b) return
      ctx.beginPath()
      ctx.moveTo(X(a.canvasX), Y(a.canvasY + NODE_SIZE / 2))
      ctx.lineTo(X(b.canvasX), Y(b.canvasY + NODE_SIZE / 2))
      ctx.stroke()
    })
    ctx.setLineDash([])

    // Manzanas
    for (const p of positioned) {
      const left = X(p.canvasX) - n / 2
      const top = Y(p.canvasY)
      const deceased = !!p.dateOfDeath
      const apple = p.appleType === 'green' ? appleGreen : appleRed
      if (apple) {
        ctx.save()
        ctx.shadowColor = deceased ? 'rgba(212,175,55,0.7)' : 'rgba(0,0,0,0.45)'
        ctx.shadowBlur = n * (deceased ? 0.14 : 0.1)
        ctx.shadowOffsetY = deceased ? 0 : n * 0.04
        ctx.globalAlpha = deceased ? 0.6 : 1
        ctx.drawImage(apple, left, top, n, n)
        ctx.restore()
      }
      // Medallón
      const cx = left + n / 2
      const cy = top + n * 0.49
      const r = n * 0.135
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath()
      ctx.fillStyle = '#FFFFFF'; ctx.fill()
      ctx.clip()
      const av = avatars.get(p.id)
      if (av) {
        drawCover(ctx, av, cx - r, cy - r, r * 2, r * 2)
      } else {
        ctx.fillStyle = '#F5EBD3'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        ctx.fillStyle = '#6B4A12'
        ctx.font = `700 ${r * 0.85}px ${serif}`
        ctx.textBaseline = 'middle'
        ctx.fillText(`${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase(), cx, cy + r * 0.05)
        ctx.textBaseline = 'alphabetic'
      }
      ctx.restore()
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = deceased ? '#D4AF37' : 'rgba(255,255,255,0.95)'
      ctx.lineWidth = Math.max(1, n * 0.012); ctx.stroke()
      if (deceased) drawRibbon(ctx, cx + r * 0.45, cy - r * 1.45, r * 1.6)

      // Nombre y años (en la manzana, como en la app)
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = n * 0.03
      const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim().toUpperCase()
      const t = fitText(ctx, name, n * 0.72, px => `800 ${px}px 'Helvetica Neue', Arial, sans-serif`, n * 0.072)
      ctx.fillText(t, cx, top + n * 0.73)
      const by = p.dateOfBirth?.slice(0, 4) ?? ''
      const dy = p.dateOfDeath?.slice(0, 4) ?? ''
      const years = dy ? `${by || '?'} – ${dy}` : by
      if (years) {
        ctx.font = `600 ${n * 0.056}px 'Helvetica Neue', Arial, sans-serif`
        ctx.globalAlpha = 0.9
        ctx.fillText(years, cx, top + n * 0.81)
        ctx.globalAlpha = 1
      }
      ctx.shadowBlur = 0
    }
  }

  // ── Pie ──
  const fy = H * 0.935
  const now = new Date()
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.8
  ctx.font = `500 ${H * 0.0145}px 'Helvetica Neue', Arial, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(`Creado el ${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`, W * 0.055, fy)
  ctx.textAlign = 'right'
  ctx.fillText('applefamilytree.com', W * 0.945, fy)
  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  if (logo) {
    const lh = H * 0.06
    const lw = logo.width * (lh / logo.height)
    ctx.drawImage(logo, W / 2 - lw / 2, fy - lh * 0.8, lw, lh)
  }

  return canvas
}

export function posterFileName(familyName: string) {
  const base = familyName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `Poster-${base || 'Familia'}.jpg`
}
