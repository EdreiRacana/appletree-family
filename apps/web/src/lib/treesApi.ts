// API para manejo multi-árbol. Cada usuario puede pertenecer a varios árboles
// (owner de uno propio + invitado a otros). Este módulo llama a las RPC
// creadas en la migration 009.

import { supabase } from './supabase'

export interface UserTree {
  treeId: string
  treeName: string
  role: 'owner' | 'member'
  memberCount: number
  isDemo: boolean
}

const DEMO_TREE_ID = '00000000-0000-0000-0000-000000000001'

// Lista todos los árboles del usuario autenticado (owner o member).
// Excluye por defecto el demo — el llamador puede pedirlo con includeDemo=true.
export async function listUserTrees(includeDemo = false): Promise<UserTree[]> {
  const { data, error } = await supabase.rpc('get_user_trees')
  if (error) throw error
  const rows = (data as Array<{
    tree_id: string
    tree_name: string
    role: 'owner' | 'member'
    is_demo: boolean
  }>) || []
  return rows
    .filter(r => includeDemo || !r.is_demo)
    .map(r => ({
      treeId: r.tree_id,
      treeName: r.tree_name,
      role: r.role,
      memberCount: 0,
      isDemo: r.is_demo,
    }))
}

// Crea árbol nuevo con member root para el usuario autenticado.
// Devuelve el tree_id nuevo. Idempotente-por-usuario NO — llamar solo una vez.
export async function bootstrapUserTree(input: {
  familyName: string
  firstName?: string
  lastName?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('bootstrap_user_tree', {
    p_family_name: input.familyName,
    p_first_name: input.firstName ?? null,
    p_last_name: input.lastName ?? null,
  })
  if (error) throw error
  return data as string
}

export { DEMO_TREE_ID }
