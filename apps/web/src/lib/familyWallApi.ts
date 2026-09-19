// Family Wall (Buzón Familiar) API
//
// Un solo hilo por árbol para banter cotidiano. Todos los miembros
// registrados del árbol pueden leer/escribir. RLS lo enforza.

import { supabase } from './supabase'

export interface WallMessage {
  id: string
  treeId: string
  authorUserId: string | null
  authorName: string
  authorAvatarUrl: string | null
  content: string
  isDeleted: boolean
  createdAt: string
}

function mapRow(row: Record<string, unknown>): WallMessage {
  return {
    id: row.id as string,
    treeId: row.tree_id as string,
    authorUserId: (row.author_user_id as string | null) ?? null,
    authorName: (row.author_name as string) ?? 'Familiar',
    authorAvatarUrl: (row.author_avatar_url as string | null) ?? null,
    content: (row.content as string) ?? '',
    isDeleted: (row.is_deleted as boolean) ?? false,
    createdAt: row.created_at as string,
  }
}

export async function listWallMessages(treeId: string, limit = 100): Promise<WallMessage[]> {
  const { data, error } = await supabase
    .from('family_wall_messages')
    .select('*')
    .eq('tree_id', treeId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function postWallMessage(
  treeId: string,
  content: string,
  author: { name: string; avatarUrl?: string | null }
): Promise<WallMessage> {
  const text = content.trim()
  if (!text) throw new Error('Mensaje vacío.')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')

  const { data, error } = await supabase
    .from('family_wall_messages')
    .insert({
      tree_id: treeId,
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

export async function deleteWallMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('family_wall_messages')
    .update({ is_deleted: true })
    .eq('id', messageId)
  if (error) throw error
}

export function subscribeToWall(
  treeId: string,
  onInsert: (msg: WallMessage) => void
): () => void {
  const channel = supabase
    .channel(`family-wall:${treeId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'family_wall_messages', filter: `tree_id=eq.${treeId}` },
      (payload) => onInsert(mapRow(payload.new as Record<string, unknown>))
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
