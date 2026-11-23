import type { Member, Relationship } from './types'

// Qué parte del árbol se ve.
//  - Generaciones: ocultar las más antiguas (las raíces, abajo en el tronco)
//    contando desde quien mira: "desde mis abuelos" / "desde mis papás".
//  - Rama: solo una persona, su pareja, sus papás y todos sus descendientes
//    (con sus parejas).

export type GenMode = 'all' | 'grandparents' | 'parents'

// Desde cuántas manzanas se ocultan las raíces automáticamente al abrir.
export const AUTO_HIDE_FROM = 100

export interface TreeViewResult {
  members: Member[]
  relationships: Relationship[]
  hiddenAncestors: Member[]        // ocultas por generación (más antiguas primero)
  hiddenGenerations: number
  branchRoot: Member | null
  canHideGenerations: boolean      // hay generaciones arriba de mis abuelos/papás
}

function spousesOf(id: string, relationships: Relationship[], byId: Map<string, Member>): string[] {
  const out = new Set<string>(byId.get(id)?.spouses ?? [])
  relationships.forEach(r => {
    if (r.relationship !== 'spouse') return
    if (r.member1Id === id) out.add(r.member2Id)
    if (r.member2Id === id) out.add(r.member1Id)
  })
  return [...out].filter(x => byId.has(x))
}

export function genModeCutoff(me: Member | undefined, mode: GenMode): number | null {
  if (!me || mode === 'all' || me.generation === undefined || me.generation === null) return null
  return me.generation - (mode === 'grandparents' ? 2 : 1)
}

export function filterTreeView(
  members: Member[],
  relationships: Relationship[],
  opts: { meId?: string | null, genMode: GenMode, branchRootId?: string | null },
): TreeViewResult {
  const byId = new Map(members.map(m => [m.id, m]))
  const me = opts.meId ? byId.get(opts.meId) : undefined
  let visible = new Set(members.map(m => m.id))
  let branchRoot: Member | null = null

  // ── Rama ──
  if (opts.branchRootId && byId.has(opts.branchRootId)) {
    branchRoot = byId.get(opts.branchRootId)!
    const set = new Set<string>([branchRoot.id])
    ;(branchRoot.parents ?? []).forEach(p => { if (byId.has(p)) set.add(p) })
    const kids = new Map<string, string[]>()
    members.forEach(m => (m.parents ?? []).forEach(p => {
      if (!kids.has(p)) kids.set(p, [])
      kids.get(p)!.push(m.id)
    }))
    const down = (id: string) => {
      spousesOf(id, relationships, byId).forEach(s => set.add(s))
      for (const k of kids.get(id) ?? []) if (!set.has(k)) { set.add(k); down(k) }
    }
    down(branchRoot.id)
    visible = set
  }

  // ── Generaciones (solo en el árbol completo) ──
  const minGen = members.reduce((a, m) => Math.min(a, m.generation ?? 0), Infinity)
  const cutoff = branchRoot ? null : genModeCutoff(me, opts.genMode)
  const canHideGenerations = !!me && me.generation !== undefined && me.generation !== null && me.generation - 1 > minGen
  let hiddenAncestors: Member[] = []
  if (cutoff !== null && cutoff > minGen) {
    hiddenAncestors = members
      .filter(m => visible.has(m.id) && m.generation !== undefined && m.generation !== null && m.generation < cutoff)
      .sort((a, b) => (a.generation ?? 0) - (b.generation ?? 0) || a.firstName.localeCompare(b.firstName, 'es'))
    hiddenAncestors.forEach(m => visible.delete(m.id))
  }
  const hiddenGenerations = new Set(hiddenAncestors.map(m => m.generation)).size

  return {
    members: members.filter(m => visible.has(m.id)),
    relationships: relationships.filter(r => visible.has(r.member1Id) && visible.has(r.member2Id)),
    hiddenAncestors,
    hiddenGenerations,
    branchRoot,
    canHideGenerations,
  }
}
