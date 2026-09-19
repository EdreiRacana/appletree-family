// Event comments API
//
// Cada evento (activity) tiene un hilo de comentarios en event_comments.
// RLS del schema restringe lectura/escritura a miembros registrados del árbol.

import { supabase } from './supabase'

export interface EventComment {
  id: string
  activityId: string
  authorUserId: string | null
  authorName: string
  authorAvatarUrl: string | null
  content: string
  isDeleted: boolean
  createdAt: string
}

function mapRow(row: Record<string, unknown>): EventComment {
  return {
    id: row.id as string,
    activityId: row.activity_id as string,
    authorUserId: (row.author_user_id as string | null) ?? null,
    authorName: (row.author_name as string) ?? 'Familiar',
    authorAvatarUrl: (row.author_avatar_url as string | null) ?? null,
    content: (row.content as string) ?? '',
    isDeleted: (row.is_deleted as boolean) ?? false,
    createdAt: row.created_at as string,
  }
}

export async function listEventComments(activityId: string): Promise<EventComment[]> {
  const { data, error } = await supabase
    .from('event_comments')
    .select('*')
    .eq('activity_id', activityId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function postEventComment(
  activityId: string,
  content: string,
  author: { name: string; avatarUrl?: string | null }
): Promise<EventComment> {
  const text = content.trim()
  if (!text) throw new Error('Comentario vacío.')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')

  const { data, error } = await supabase
    .from('event_comments')
    .insert({
      activity_id: activityId,
      author_user_id: user.id,
      author_name: author.name,
      author_avatar_url: author.avatarUrl ?? null,
      content: text,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function deleteEventComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('event_comments')
    .update({ is_deleted: true })
    .eq('id', commentId)
  if (error) throw error
}

// Suscripción realtime a un evento específico. Retorna función de unsubscribe.
export function subscribeToEventComments(
  activityId: string,
  onInsert: (comment: EventComment) => void
): () => void {
  const channel = supabase
    .channel(`event-comments:${activityId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'event_comments', filter: `activity_id=eq.${activityId}` },
      (payload) => onInsert(mapRow(payload.new as Record<string, unknown>))
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
