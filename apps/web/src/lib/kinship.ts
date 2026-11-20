// Parentesco calculado desde la manzana de QUIEN MIRA.
//
// Se recorre el árbol con tres tipos de paso:
//   U = subir a un padre/madre    D = bajar a un hijo/a    S = pareja
// (una relación "sibling" se toma como U+D). Con el camino más corto desde
// "yo" hasta cada familiar se nombra el parentesco: UU = abuelo, UUD = tío,
// UUDD = primo, SU = suegro, etc. Así cada familiar ve los parentescos
// desde su propia manzana (para ti Francisco es "papá"; para tu hijo,
// "abuelo").
import type { Member, Relationship } from './types'

type Step = 'U' | 'D' | 'S'

function g(m: Member | undefined, male: string, female: string, neutral: string): string {
  if (m?.gender === 'male') return male
  if (m?.gender === 'female') return female
  return neutral
}

// Nombre del parentesco para un camino dado (ya normalizado).
function nameFor(path: string, m: Member | undefined): string | null {
  const ups = /^U+$/.exec(path)?.[0].length ?? 0
  const downs = /^D+$/.exec(path)?.[0].length ?? 0
  if (path === '') return 'Tú'
  if (ups) {
    const base = [null,
      g(m, 'papá', 'mamá', 'papá/mamá'),
      g(m, 'abuelo', 'abuela', 'abuelo/a'),
      g(m, 'bisabuelo', 'bisabuela', 'bisabuelo/a'),
      g(m, 'tatarabuelo', 'tatarabuela', 'tatarabuelo/a')][ups]
    return base ?? g(m, 'ancestro', 'ancestra', 'ancestro/a')
  }
  if (downs) {
    const base = [null,
      g(m, 'hijo', 'hija', 'hijo/a'),
      g(m, 'nieto', 'nieta', 'nieto/a'),
      g(m, 'bisnieto', 'bisnieta', 'bisnieto/a'),
      g(m, 'tataranieto', 'tataranieta', 'tataranieto/a')][downs]
    return base ?? g(m, 'descendiente', 'descendiente', 'descendiente')
  }
  switch (path) {
    case 'S': return g(m, 'esposo', 'esposa', 'pareja')
    case 'UD': return g(m, 'hermano', 'hermana', 'hermano/a')
    case 'US': return g(m, 'padrastro', 'madrastra', 'padrastro/madrastra')
    case 'UUD': return g(m, 'tío', 'tía', 'tío/a')
    case 'UUUD': return g(m, 'tío abuelo', 'tía abuela', 'tío/a abuelo/a')
    case 'UDD': return g(m, 'sobrino', 'sobrina', 'sobrino/a')
    case 'UDDD': return g(m, 'sobrino nieto', 'sobrina nieta', 'sobrino/a nieto/a')
    case 'UUDD': return g(m, 'primo', 'prima', 'primo/a')
    case 'UUUDD': return g(m, 'tío segundo', 'tía segunda', 'tío/a segundo/a')
    case 'UUDDD': return g(m, 'sobrino segundo', 'sobrina segunda', 'sobrino/a segundo/a')
    case 'UUUDDD': return g(m, 'primo segundo', 'prima segunda', 'primo/a segundo/a')
    case 'SU': return g(m, 'suegro', 'suegra', 'suegro/a')
    case 'SUU': return g(m, 'abuelo de tu pareja', 'abuela de tu pareja', 'abuelo/a de tu pareja')
    case 'SUD': case 'UDS': return g(m, 'cuñado', 'cuñada', 'cuñado/a')
    case 'DS': return g(m, 'yerno', 'nuera', 'yerno/nuera')
    case 'DDS': return g(m, 'esposo de tu nieta', 'esposa de tu nieto', 'pareja de tu nieto/a')
    case 'UUDS': return g(m, 'tío', 'tía', 'tío/a')               // tío/a político/a
    case 'UDDS': return g(m, 'sobrino', 'sobrina', 'sobrino/a')    // político/a
    case 'SD': return g(m, 'hijastro', 'hijastra', 'hijastro/a')
    case 'UUSD': case 'USD': return g(m, 'medio hermano', 'media hermana', 'medio/a hermano/a')
    default: return null
  }
}

/**
 * Devuelve un mapa id → parentesco ("papá", "tía abuela", …) visto desde
 * `meId`. Los que no tienen un nombre claro quedan como "familiar".
 */
export function computeKinship(
  members: Member[],
  relationships: Relationship[],
  meId: string | null,
): Map<string, string> {
  const out = new Map<string, string>()
  if (!meId) return out
  const byId = new Map(members.map(m => [m.id, m]))
  if (!byId.has(meId)) return out

  // Aristas dirigidas con su tipo de paso.
  const edges = new Map<string, Array<{ to: string; step: Step | 'B' }>>()
  const add = (a: string, b: string, step: Step | 'B') => {
    if (!byId.has(a) || !byId.has(b) || a === b) return
    if (!edges.has(a)) edges.set(a, [])
    edges.get(a)!.push({ to: b, step })
  }
  for (const m of members) {
    for (const p of m.parents ?? []) { add(m.id, p, 'U'); add(p, m.id, 'D') }
    for (const s of m.spouses ?? []) { add(m.id, s, 'S'); add(s, m.id, 'S') }
  }
  for (const r of relationships) {
    if (r.isActive === false) continue
    if (r.relationship === 'spouse') { add(r.member1Id, r.member2Id, 'S'); add(r.member2Id, r.member1Id, 'S') }
    if (r.relationship === 'sibling') { add(r.member1Id, r.member2Id, 'B'); add(r.member2Id, r.member1Id, 'B') }
    if (r.relationship === 'parent') { add(r.member1Id, r.member2Id, 'D'); add(r.member2Id, r.member1Id, 'U') }
    if (r.relationship === 'child') { add(r.member1Id, r.member2Id, 'U'); add(r.member2Id, r.member1Id, 'D') }
  }

  // BFS: camino más corto (un hermano 'B' cuenta como dos pasos U+D).
  const path = new Map<string, string>([[meId, '']])
  let frontier = [meId]
  while (frontier.length) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of edges.get(id) ?? []) {
        if (path.has(e.to)) continue
        const p = path.get(id)! + (e.step === 'B' ? 'UD' : e.step)
        if (p.length > 8) continue
        path.set(e.to, p)
        next.push(e.to)
      }
    }
    frontier = next
  }

  for (const [id, p] of path) {
    const label = nameFor(p, byId.get(id))
    out.set(id, label ?? 'familiar')
  }
  return out
}

/** "Tu abuela", "Tú", "Familiar"… listo para mostrar. */
export function kinshipPhrase(label: string | undefined): string {
  if (!label) return ''
  if (label === 'Tú') return 'Tú'
  if (label === 'familiar') return 'Familiar'
  if (label.includes(' de tu ')) return label.charAt(0).toUpperCase() + label.slice(1)
  return `Tu ${label}`
}
