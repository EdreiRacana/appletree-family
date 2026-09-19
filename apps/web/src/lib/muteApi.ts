// Mute preferences API
//
// Cada usuario decide qué evento/buzón/chat quiere silenciar.
// La UI expone toggles 🔕/🔔 en cada lugar aplicable.

import { supabase } from './supabase'

export type MuteSubjectType = 'event' | 'wall' | 'chat'

export interface MutePref {
  userId: string
  subjectType: MuteSubjectType
  subjectId: string
  mutedAt: string
}

export async function listMyMutes(): Promise<MutePref[]> {
  const { data, error } = await supabase
    .from('user_mute_prefs')
    .select('*')
  if (error) throw error
  return (data || []).map((r: Record<string, unknown>) => ({
    userId: r.user_id as string,
    subjectType: r.subject_type as MuteSubjectType,
    subjectId: r.subject_id as string,
    mutedAt: r.muted_at as string,
  }))
}

export async function muteSubject(subjectType: MuteSubjectType, subjectId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')
  const { error } = await supabase
    .from('user_mute_prefs')
    .insert({ user_id: user.id, subject_type: subjectType, subject_id: subjectId })
  if (error && !error.message?.includes('duplicate')) throw error
}

export async function unmuteSubject(subjectType: MuteSubjectType, subjectId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa.')
  const { error } = await supabase
    .from('user_mute_prefs')
    .delete()
    .eq('user_id', user.id)
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
  if (error) throw error
}

// Devuelve un Set con las llaves "type:id" para filtrado rápido en memoria.
export function toMuteKeySet(mutes: MutePref[]): Set<string> {
  return new Set(mutes.map(m => `${m.subjectType}:${m.subjectId}`))
}

export function isMuted(muteSet: Set<string>, type: MuteSubjectType, id: string): boolean {
  return muteSet.has(`${type}:${id}`)
}
