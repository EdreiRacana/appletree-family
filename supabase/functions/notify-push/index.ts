// Edge Function: envía push notifications a los suscriptores del usuario
// destinatario cuando entra un row nuevo en public.notifications.
//
// Invocada por trigger en migration 011 vía pg_net.
//
// Config (Supabase → Edge Functions → notify-push → Secrets):
//   VAPID_PUBLIC_KEY   — public key generada
//   VAPID_PRIVATE_KEY  — private key generada
//   VAPID_SUBJECT      — mailto:no-reply@applefamilytree.com

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:no-reply@applefamilytree.com'
const APP_URL = Deno.env.get('APP_URL') || 'https://applefamilytree.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  action: string | null
  related_id: string | null
}

function actionToUrl(action: string | null, relatedId: string | null): string {
  switch (action) {
    case 'open_chat':          return `${APP_URL}/?chat=${relatedId || ''}`
    case 'open_event_thread':  return `${APP_URL}/?event=${relatedId || ''}`
    case 'open_wall':          return `${APP_URL}/?wall=1`
    case 'open_stories':       return `${APP_URL}/?stories=1`
    default:                    return APP_URL
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: 'VAPID keys missing' }), { status: 500 })
  }

  let body: { notification?: NotificationRow } = {}
  try { body = await req.json() } catch { /* ignore */ }
  const n = body.notification
  if (!n?.id || !n.user_id) {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 })
  }

  const admin = createClient(SB_URL, SB_SERVICE_KEY)

  // Respeta la preferencia push_enabled
  const { data: pref } = await admin
    .from('notification_prefs')
    .select('push_enabled')
    .eq('user_id', n.user_id)
    .maybeSingle()
  if (pref && pref.push_enabled === false) {
    return new Response(JSON.stringify({ ok: true, skipped: 'push_disabled' }), { status: 200 })
  }

  // Suscripciones del usuario destinatario
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', n.user_id)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
  }

  const payload = JSON.stringify({
    title: n.title || 'AppleFamily Tree',
    body: n.body || '',
    url: actionToUrl(n.action, n.related_id),
    notificationId: n.id,
    tag: `${n.type}-${n.related_id || n.id}`,
  })

  const results = await Promise.allSettled(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
        return { id: s.id, ok: true }
      } catch (err: any) {
        // 404 / 410 → subscription expiró → borrar
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
        }
        return { id: s.id, ok: false, error: err?.message || String(err) }
      }
    }),
  )

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).ok).length
  return new Response(JSON.stringify({ ok: true, sent, total: subs.length }), { status: 200 })
})
