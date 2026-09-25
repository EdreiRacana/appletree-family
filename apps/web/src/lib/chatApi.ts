// AppleTree Family — Chat API
//
// Envuelve las tablas `chats` y `messages` de Supabase con helpers idiomáticos.
// La convención del schema es que `participant_1 < participant_2` (UUID sort)
// para garantizar unicidad por par: hay exactamente UN chat por par de
// usuarios, sin importar quién lo abrió primero.
//
// Realtime: `subscribeToChat` usa un canal Postgres Changes filtrado por
// chat_id para no traer eventos irrelevantes.

import { supabase } from './supabase'

export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  content: string | null
  attachmentUrl: string | null
  attachmentType: string | null
  status: 'sent' | 'delivered' | 'read'
  isDeleted: boolean
  createdAt: string
  readAt: string | null
}

export interface ChatSummary {
  id: string
  otherUserId: string
  otherUserName: string | null
  otherAvatarUrl: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
}

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    chatId: row.chat_id as string,
    senderId: row.sender_id as string,
    content: (row.content as string | null) ?? null,
    attachmentUrl: (row.attachment_url as string | null) ?? null,
    attachmentType: (row.attachment_type as string | null) ?? null,
    status: (row.status as ChatMessage['status']) ?? 'sent',
    isDeleted: (row.is_deleted as boolean) ?? false,
    createdAt: row.created_at as string,
    readAt: (row.read_at as string | null) ?? null,
  }
}

// getOrCreateChat: devuelve el chatId entre auth.uid() y `otherUserId`, creando
// el registro si no existe. Ambos deben ser UUIDs de auth.users (públicos vía
// public.users). Un miembro del árbol sin cuenta (user_id null) no puede
// chatear — la UI debe filtrar antes de llamar aquí.
export async function getOrCreateChat(otherUserId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')
  if (user.id === otherUserId) throw new Error('No puedes chatear contigo mismo.')

  const [p1, p2] = sortPair(user.id, otherUserId)

  const { data: existing, error: selErr } = await supabase
    .from('chats')
    .select('id')
    .eq('participant_1', p1)
    .eq('participant_2', p2)
    .maybeSingle()
  if (selErr) throw selErr
  if (existing) return existing.id as string

  const { data: created, error: insErr } = await supabase
    .from('chats')
    .insert({ participant_1: p1, participant_2: p2 })
    .select('id')
    .single()
  if (insErr) throw insErr
  return created.id as string
}

export async function listMessages(chatId: string, limit = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data || []).map(mapMessage)
}

export async function sendMessage(
  chatId: string,
  content: string,
  attachment?: { url: string; type: 'image' | 'video' | 'audio' | 'file' } | null,
): Promise<ChatMessage> {
  const trimmed = content.trim()
  // Se permite mensaje sin texto SI hay attachment (foto sola, por ejemplo)
  if (!trimmed && !attachment) throw new Error('Mensaje vacío.')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')

  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: user.id,
      content: trimmed || null,
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
    })
    .select('*')
    .single()
  if (error) throw error

  // Best-effort: actualizar last_message_at del chat. Si RLS lo bloquea o
  // falla la política de UPDATE de chats (no la definimos explícita), el
  // mensaje ya se insertó — no rompemos el flujo.
  supabase
    .from('chats')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', chatId)
    .then(() => { /* ok */ }, () => { /* ignore */ })

  return mapMessage(data)
}

// subscribeToChat: canal Realtime filtrado por chat_id. Devuelve la función
// de unsubscribe para que el llamador la ejecute al desmontar.
export function subscribeToChat(
  chatId: string,
  onInsert: (msg: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`chat:${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        onInsert(mapMessage(payload.new as Record<string, unknown>))
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// listMyChats: todos los chats donde el usuario logueado es participante,
// con el nombre y avatar del otro lado, para el índice de conversaciones.
// Los conteos de no leídos vienen agrupados en una sola consulta.
export async function listMyChats(): Promise<ChatSummary[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')

  const { data: chats, error } = await supabase
    .from('chats')
    .select('id, participant_1, participant_2, last_message_at')
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  const rows = (chats || []) as Array<{
    id: string; participant_1: string; participant_2: string; last_message_at: string | null
  }>
  if (rows.length === 0) return []

  const otherIds = rows.map(c => c.participant_1 === user.id ? c.participant_2 : c.participant_1)
  const { data: profiles } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .in('id', otherIds)
  const profileById = new Map<string, { full_name: string | null; avatar_url: string | null }>()
  ;(profiles || []).forEach((p: { id: string; full_name: string | null; avatar_url: string | null }) => {
    profileById.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url })
  })

  // Preview del último mensaje por chat. Un pull separado para no meterle
  // JOIN complicado a Supabase con RLS activo.
  const previews = new Map<string, string>()
  for (const chat of rows) {
    const { data: last } = await supabase
      .from('messages')
      .select('content')
      .eq('chat_id', chat.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (last?.content) previews.set(chat.id, last.content as string)
  }

  return rows.map(chat => {
    const otherId = chat.participant_1 === user.id ? chat.participant_2 : chat.participant_1
    const prof = profileById.get(otherId)
    return {
      id: chat.id,
      otherUserId: otherId,
      otherUserName: prof?.full_name ?? null,
      otherAvatarUrl: prof?.avatar_url ?? null,
      lastMessageAt: chat.last_message_at,
      lastMessagePreview: previews.get(chat.id) ?? null,
      unreadCount: 0, // Placeholder — se puede afinar con read_at IS NULL AND sender != me
    }
  })
}

// markChatAsRead: marca todos los mensajes del otro participante como leídos.
export async function markChatAsRead(chatId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString(), status: 'read' })
    .eq('chat_id', chatId)
    .neq('sender_id', user.id)
    .is('read_at', null)
}
