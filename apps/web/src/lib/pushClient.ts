// Cliente de push notifications.
// - registerServiceWorker: registra /sw.js una vez, idempotente.
// - subscribeToPush: pide permiso, crea PushSubscription y la guarda en BD
//   via /api/push/subscribe.
// - unsubscribeFromPush: revoca el permiso a nivel de navegador y borra la
//   subscription de la BD.
// - getSubscriptionStatus: devuelve 'granted' | 'denied' | 'default' | 'unsupported'.

import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission as 'granted' | 'denied' | 'default'
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    return reg
  } catch (err) {
    console.warn('SW register failed:', err)
    return null
  }
}

export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'vapid-missing' }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'denied' }

  const reg = await registerServiceWorker()
  if (!reg) return { ok: false, reason: 'sw-register-failed' }

  // Si ya hay subscription, la reusamos.
  const existing = await reg.pushManager.getSubscription()
  const sub = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })

  const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    return { ok: false, reason: 'invalid-subscription' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'not-authenticated' }

  // Upsert por endpoint único.
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: raw.endpoint,
    p256dh: raw.keys.p256dh,
    auth: raw.keys.auth,
    user_agent: navigator.userAgent.substring(0, 200),
    last_used_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  if (error) return { ok: false, reason: error.message }

  // Marca la preferencia push_enabled = true.
  await supabase.from('notification_prefs').upsert({
    user_id: user.id,
    push_enabled: true,
  }, { onConflict: 'user_id' })

  return { ok: true }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return { ok: true }

  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    try {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    } catch { /* ignore */ }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('notification_prefs').upsert({
      user_id: user.id,
      push_enabled: false,
    }, { onConflict: 'user_id' })
  }

  return { ok: true }
}
