// POST /api/account/delete
//
// Elimina la cuenta del usuario autenticado. Requiere re-autenticación
// (contraseña actual) para evitar borrados accidentales desde sesiones
// abandonadas. Después:
//   1. Desvincula el usuario de todos sus members (user_id → NULL).
//   2. Transfiere ownership de árboles donde es owner único al admin más
//      antiguo (si existe) O marca el árbol como huérfano para purga.
//   3. Borra push_subscriptions, notification_prefs, tree_memberships.
//   4. Llama a auth.admin.deleteUser para borrar de auth.users.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(req: NextRequest) {
  if (!SB_URL || !SB_SERVICE) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  let body: { accessToken?: string; password?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }

  if (!body.accessToken || !body.password) {
    return NextResponse.json({ error: 'Falta token o contraseña' }, { status: 400 })
  }

  // Cliente con el token del usuario para validar quién hace la llamada
  const asUser = createClient(SB_URL, SB_SERVICE, {
    global: { headers: { Authorization: `Bearer ${body.accessToken}` } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userErr } = await asUser.auth.getUser()
  if (userErr || !user?.email) {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
  }

  // Re-autenticación por contraseña: evita que un token robado borre la cuenta
  const admin = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } })
  const { error: pwErr } = await admin.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  })
  if (pwErr) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 403 })
  }

  // 1. Desvincular members del usuario
  await admin.from('members').update({ user_id: null }).eq('user_id', user.id)

  // 2. Transferir árboles donde es owner único → al admin más antiguo
  const { data: ownedTrees } = await admin
    .from('trees')
    .select('id')
    .eq('owner_id', user.id)
  for (const t of ownedTrees || []) {
    const { data: nextAdmin } = await admin
      .from('tree_memberships')
      .select('user_id')
      .eq('tree_id', t.id)
      .eq('role', 'admin')
      .order('granted_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (nextAdmin?.user_id) {
      await admin.from('trees').update({ owner_id: nextAdmin.user_id }).eq('id', t.id)
      await admin
        .from('tree_memberships')
        .update({ role: 'owner' })
        .eq('tree_id', t.id)
        .eq('user_id', nextAdmin.user_id)
    } else {
      // Árbol huérfano: lo dejamos con owner_id = null; una tarea batch
      // puede purgar árboles huérfanos sin miembros después de X días.
      await admin.from('trees').update({ owner_id: null }).eq('id', t.id)
    }
  }

  // 3. Borrar subscripciones y prefs
  await admin.from('push_subscriptions').delete().eq('user_id', user.id)
  await admin.from('notification_prefs').delete().eq('user_id', user.id)
  await admin.from('tree_memberships').delete().eq('user_id', user.id)
  await admin.from('notifications').delete().eq('user_id', user.id)
  await admin.from('users').delete().eq('id', user.id)

  // 4. Borrar de auth
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
