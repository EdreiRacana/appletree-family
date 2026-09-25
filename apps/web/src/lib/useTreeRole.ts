import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

// Roles disponibles en el sistema (migration 012):
//   'owner'  → fundador del árbol, poder absoluto
//   'admin'  → editor con casi todos los poderes menos borrar árbol / cambiar owner
//   'member' → miembro normal, solo edita su propia manzana (autoedit)
//   null     → no es miembro del árbol (o no está enlazado)
export type TreeRole = 'owner' | 'admin' | 'member' | null

// Devuelve el rol del usuario logueado en el árbol dado. Se actualiza si
// cambia el treeId o el userId. Es la fuente única de verdad para el frontend
// al momento de decidir si mostrar el botón "Editar", el panel de admins, etc.
export function useTreeRole(treeId: string | null): {
  role: TreeRole
  isAdmin: boolean          // owner OR admin
  isOwner: boolean
  loading: boolean
  refresh: () => void
} {
  const [role, setRole] = useState<TreeRole>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!treeId) {
      setRole(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRole(null)
        return
      }
      const { data } = await supabase
        .from('tree_memberships')
        .select('role')
        .eq('tree_id', treeId)
        .eq('user_id', user.id)
        .maybeSingle()
      setRole((data?.role as TreeRole) ?? null)
    } finally {
      setLoading(false)
    }
  }, [treeId])

  useEffect(() => { void load() }, [load])

  return {
    role,
    isAdmin: role === 'owner' || role === 'admin',
    isOwner: role === 'owner',
    loading,
    refresh: load,
  }
}

// Marca al usuario activo (llamar en cada login exitoso). Alimenta el mecanismo
// de sucesión por inactividad (claim_ownership tras 30 días).
export async function touchTreeActivity(): Promise<void> {
  try { await supabase.rpc('touch_tree_activity') } catch { /* ignore */ }
}
