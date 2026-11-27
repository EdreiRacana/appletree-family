// Resumen semanal de AppleFamily Tree.
// Lo corre GitHub Actions cada domingo (.github/workflows/resumen-semanal.yml).
//
// Variables:
//   SUPABASE_DB_URL  conexión a la base (secreto de GitHub, el mismo del respaldo)
//   RESEND_API_KEY   llave de Resend (secreto de GitHub)
//   SOLO_A           opcional: enviar solo a este correo (para probar)
//   VISTA_PREVIA=1   opcional: no envía; guarda los correos como HTML en ./vista-previa
//   DATOS_JSON       opcional: archivo con datos de ejemplo en vez de la base

import fs from 'node:fs'
import path from 'node:path'

const APP_URL = (process.env.APP_URL || 'https://applefamilytree.com').replace(/\/$/, '')
const FROM = process.env.DIGEST_FROM || 'AppleFamily Tree <no-reply@applefamilytree.com>'
const PREVIEW = process.env.VISTA_PREVIA === '1'
const ONLY = (process.env.SOLO_A || '').trim().toLowerCase()

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const ymd = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const dayLabel = s => { const d = ymd(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}` }
const initials = n => esc(String(n || '?').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase())

function avatar(person, size = 40) {
  if (person.avatar) {
    return `<img src="${esc(person.avatar)}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid #D4AF37" />`
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1E2A22;border:2px solid #D4AF37;color:#D4AF37;font:700 ${Math.round(size * 0.36)}px Georgia,serif;line-height:${size}px;text-align:center">${initials(person.name)}</div>`
}

function row(person, title, sub, accent = '#8B6508') {
  return `<tr><td style="padding:8px 0;width:52px;vertical-align:middle">${avatar(person)}</td>
    <td style="padding:8px 0;vertical-align:middle">
      <div style="font:700 15px 'Helvetica Neue',Arial,sans-serif;color:#2C1810">${title}</div>
      <div style="font:13px 'Helvetica Neue',Arial,sans-serif;color:${accent};margin-top:2px">${sub}</div>
    </td></tr>`
}

function section(icon, title, inner) {
  return `<tr><td style="padding:22px 36px 4px">
    <div style="font:700 11px 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:#B8860B;border-bottom:1px solid rgba(212,175,55,0.3);padding-bottom:8px;margin-bottom:6px">${icon}&nbsp; ${title}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table>
  </td></tr>`
}

function hasNews(f) {
  return f.birthdays.length || f.remembrances.length || f.new_members.length || f.stories.length || Number(f.photos_new) > 0
}

function familyBlock(f, multi) {
  const parts = []
  if (multi) {
    parts.push(`<tr><td style="padding:26px 36px 0"><div style="font:600 20px Georgia,serif;color:#2C1810">${esc(f.name)}</div></td></tr>`)
  }
  if (f.birthdays.length) {
    parts.push(section('🎂', 'Cumpleaños de esta semana', f.birthdays.map(b => {
      const me = b.member_id === f.my_member_id
      return row(b, me ? '¡Es tu cumpleaños! 🎉' : esc(b.name), `${dayLabel(b.date)} · ${me ? 'cumples' : 'cumple'} ${b.turns} años`)
    }).join('')))
  }
  if (f.remembrances.length) {
    parts.push(section('🕯️', 'Los recordamos', f.remembrances.map(r => row(r, esc(r.name),
      r.kind === 'birth'
        ? `${dayLabel(r.date)} · habría cumplido ${r.years} años`
        : `${dayLabel(r.date)} · ${r.years} ${r.years === 1 ? 'año' : 'años'} de su partida`, '#6B5B4E')).join('')))
  }
  if (f.new_members.length) {
    parts.push(section('🍎', f.new_members.length === 1 ? 'Nuevo en el árbol' : 'Nuevos en el árbol',
      f.new_members.map(n => row(n, esc(n.name), 'Se agregó a la familia esta semana')).join('')))
  }
  if (f.stories.length) {
    const items = f.stories.slice(0, 4).map(s => `<tr><td colspan="2" style="padding:8px 0">
      ${s.image ? `<img src="${esc(s.image)}" width="100%" alt="" style="display:block;width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin-bottom:8px" />` : ''}
      <div style="font:700 15px 'Helvetica Neue',Arial,sans-serif;color:#2C1810">${esc(s.title)}</div>
      ${s.author ? `<div style="font:13px 'Helvetica Neue',Arial,sans-serif;color:#8B6508;margin-top:2px">Compartida por ${esc(s.author)}</div>` : ''}
    </td></tr>`).join('')
    const more = f.stories.length > 4 ? `<tr><td colspan="2" style="font:13px Arial,sans-serif;color:#6B5B4E;padding:4px 0">y ${f.stories.length - 4} más…</td></tr>` : ''
    parts.push(section('📖', f.stories.length === 1 ? 'Nueva historia' : 'Historias nuevas', items + more))
  }
  if (Number(f.photos_new) > 0) {
    const n = Number(f.photos_new)
    parts.push(section('📷', 'Fotos', `<tr><td style="font:15px 'Helvetica Neue',Arial,sans-serif;color:#2C1810;padding:8px 0">Se ${n === 1 ? 'subió 1 foto nueva' : `subieron ${n} fotos nuevas`} al álbum familiar.</td></tr>`))
  }
  return parts.join('')
}

function renderDigest(r) {
  const fams = r.families.filter(hasNews)
  const multi = fams.length > 1
  const name = esc(r.first_name || '')
  const unsub = `${APP_URL}/baja?t=${encodeURIComponent(r.token)}`
  const total = fams.reduce((a, f) => a + Number(f.members_total || 0), 0)
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>Tu semana en familia</title></head>
<body style="margin:0;padding:0;background:#F5F0E8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:22px;border:1px solid rgba(212,175,55,0.28);overflow:hidden;box-shadow:0 12px 40px rgba(44,24,16,0.10)">
  <tr><td style="background:#1E2A22;padding:32px 28px 26px;text-align:center;border-bottom:2px solid #D4AF37">
    <img src="${APP_URL}/assets/logo.png" width="60" height="60" alt="AppleFamily Tree" style="display:block;margin:0 auto 10px" />
    <div style="font:600 24px Georgia,serif;color:#D4AF37">AppleFamily <i>Tree</i></div>
    <div style="margin-top:8px;font:11px Arial,sans-serif;color:#F5E6C8;letter-spacing:0.3em;text-transform:uppercase;opacity:0.75">· Tu semana en familia ·</div>
  </td></tr>
  <tr><td style="padding:30px 36px 0">
    <div style="font:600 22px Georgia,serif;color:#2C1810">Hola${name ? `, ${name}` : ''} 👋</div>
    <p style="margin:10px 0 0;font:15px/1.6 'Helvetica Neue',Arial,sans-serif;color:#5A4A3E">Esto es lo que pasa ${multi ? 'en tus familias' : `en <b>${esc(fams[0]?.name || 'tu familia')}</b>`} esta semana.</p>
  </td></tr>
  ${fams.map(f => familyBlock(f, multi)).join('')}
  <tr><td style="padding:30px 36px 34px;text-align:center">
    <a href="${APP_URL}" style="display:inline-block;padding:14px 36px;background:#D4AF37;background-image:linear-gradient(135deg,#D4AF37 0%,#B8860B 100%);color:#1E2A22;border-radius:12px;text-decoration:none;font:800 14px Arial,sans-serif;letter-spacing:0.04em">Abrir el árbol</a>
    ${total ? `<div style="margin-top:12px;font:12px Arial,sans-serif;color:#8A7A6D">${total} familiares en tu árbol 🍎</div>` : ''}
  </td></tr>
  <tr><td style="padding:18px 30px 22px;border-top:1px solid rgba(212,175,55,0.2);background:#FAF6F0;text-align:center;font:11px/1.6 Arial,sans-serif;color:#7A6558">
    Recibes este resumen porque eres parte de un árbol en AppleFamily Tree.<br />
    <a href="${unsub}" style="color:#8B6508">Ya no quiero recibir el resumen semanal</a>
  </td></tr>
</table>
<p style="margin:16px 0 0;font:10px Arial,sans-serif;color:#8A7A6D;letter-spacing:0.15em;text-transform:uppercase">AppleFamily Tree · applefamilytree.com</p>
</td></tr></table></body></html>`

  const first = fams[0]
  const b = first?.birthdays.find(x => x.member_id !== first.my_member_id)
  const subject = b
    ? `🎂 ${b.name.split(' ')[0]} cumple ${b.turns} años esta semana`
    : first?.stories.length ? '📖 Hay historias nuevas en tu familia'
    : first?.new_members.length ? '🍎 Tu árbol creció esta semana'
    : '🍎 Tu semana en familia'
  return { subject, html, unsub }
}

async function loadPayload() {
  if (process.env.DATOS_JSON) return JSON.parse(fs.readFileSync(process.env.DATOS_JSON, 'utf8'))
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const { rows } = await client.query('select public.weekly_digest_payload() as p')
    return rows[0].p || []
  } finally {
    await client.end()
  }
}

async function main() {
  const payload = await loadPayload()
  let list = payload.filter(r => r.families.some(hasNews))
  if (ONLY) list = list.filter(r => String(r.email).toLowerCase() === ONLY)
  console.log(`Personas con novedades: ${list.length} (de ${payload.length} suscritas)`)

  if (PREVIEW) {
    const dir = path.resolve('vista-previa')
    fs.mkdirSync(dir, { recursive: true })
    list.forEach((r, i) => {
      const { subject, html } = renderDigest(r)
      fs.writeFileSync(path.join(dir, `correo-${i + 1}.html`), html)
      console.log(`  ${i + 1}. ${subject}`)
    })
    return
  }

  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Falta RESEND_API_KEY')
  let ok = 0, fail = 0
  for (const r of list) {
    const { subject, html, unsub } = renderDigest(r)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: [r.email], subject, html,
        headers: { 'List-Unsubscribe': `<${unsub}>` },
      }),
    })
    if (res.ok) ok++
    else { fail++; console.error(`  No se pudo enviar (${res.status}): ${(await res.text()).slice(0, 200)}`) }
    await new Promise(s => setTimeout(s, 600))   // Resend gratis: máx. 2 por segundo
  }
  console.log(`Enviados: ${ok} · Fallidos: ${fail}`)
  if (fail && !ok) process.exit(1)
}

main().catch(e => { console.error(e.message); process.exit(1) })
