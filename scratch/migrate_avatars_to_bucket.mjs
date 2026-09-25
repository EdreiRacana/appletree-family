#!/usr/bin/env node
/**
 * MIGRA AVATARES BASE64 → SUPABASE STORAGE
 * ═════════════════════════════════════════
 * Se corre UNA sola vez para limpiar la BD.
 *
 * Qué hace:
 *   1. Lee todos los public.members cuyo avatar_url empieza con "data:image/".
 *   2. Decodifica el base64 a Buffer.
 *   3. Sube al bucket 'avatars' con nombre único.
 *   4. Actualiza member.avatar_url con la URL pública.
 *   5. Reporta cuántos migró y cuánto espacio liberó.
 *
 * Requisitos:
 *   - Node 18+
 *   - Variables de entorno (o pásalas inline):
 *       SUPABASE_URL              = https://TU_PROYECTO.supabase.co
 *       SUPABASE_SERVICE_ROLE_KEY = eyJ...   (¡NO la anon key, la service role!)
 *
 * Cómo correr (desde la raíz del repo):
 *   cd scratch
 *   npm i @supabase/supabase-js
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *     node migrate_avatars_to_bucket.mjs
 *
 * O en Windows PowerShell:
 *   $env:SUPABASE_URL = "https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
 *   node migrate_avatars_to_bucket.mjs
 *
 * Es idempotente: si un member ya tiene URL http(s), lo salta.
 * Si algo falla en medio, puedes correrlo de nuevo — solo procesará los que
 * quedaron pendientes.
 */

import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !SB_KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en env vars.')
  process.exit(1)
}

const sb = createClient(SB_URL, SB_KEY)

function dataUrlToBuffer(dataUrl) {
  // formato: data:image/jpeg;base64,<...>
  const [meta, b64] = dataUrl.split(',')
  const match = meta.match(/data:([^;]+);base64/)
  const contentType = match ? match[1] : 'image/jpeg'
  return { buffer: Buffer.from(b64, 'base64'), contentType }
}

async function main() {
  console.log('Buscando miembros con avatar en base64…')
  const { data: members, error } = await sb
    .from('members')
    .select('id, tree_id, first_name, last_name, avatar_url')
    .not('avatar_url', 'is', null)

  if (error) { console.error('Error listando members:', error); process.exit(1) }

  const targets = (members ?? []).filter(m => m.avatar_url?.startsWith('data:image/'))
  if (targets.length === 0) {
    console.log('Nada que migrar. Todos los avatares ya son URLs.')
    return
  }
  console.log(`Encontrados ${targets.length} avatares en base64.`)

  let migrated = 0
  let failed = 0
  let bytesFreed = 0

  for (const m of targets) {
    const label = `${m.first_name}${m.last_name ? ' ' + m.last_name : ''}`
    try {
      const originalSize = m.avatar_url.length
      const { buffer, contentType } = dataUrlToBuffer(m.avatar_url)
      const ext = contentType.split('/')[1] || 'jpg'
      const path = `${m.tree_id}/${m.id}-${Date.now()}.${ext}`

      const { error: upErr } = await sb.storage
        .from('avatars')
        .upload(path, buffer, { contentType, cacheControl: '31536000', upsert: false })
      if (upErr) throw upErr

      const { data: pub } = sb.storage.from('avatars').getPublicUrl(path)
      const publicUrl = pub?.publicUrl
      if (!publicUrl) throw new Error('sin URL pública')

      const { error: updErr } = await sb.from('members').update({ avatar_url: publicUrl }).eq('id', m.id)
      if (updErr) throw updErr

      bytesFreed += originalSize
      migrated++
      console.log(`  ✓ ${label} (${Math.round(originalSize / 1024)} KB → ${Math.round(buffer.length / 1024)} KB en bucket)`)
    } catch (err) {
      failed++
      console.error(`  ✗ ${label}:`, err.message ?? err)
    }
  }

  console.log('')
  console.log('═══ RESUMEN ═══')
  console.log(`Migrados:      ${migrated}`)
  console.log(`Fallidos:      ${failed}`)
  console.log(`Espacio libre: ${Math.round(bytesFreed / 1024)} KB de la BD (aprox.)`)
}

main().catch(err => { console.error(err); process.exit(1) })
