// Parentesco calculado desde la manzana de QUIEN MIRA.
//
// Se recorre el árbol con tres tipos de paso:
//   U = subir a un padre/madre    D = bajar a un hijo/a    S = pareja
// (una relación "sibling" se toma como U+D). Con el camino más corto desde
// "yo" hasta cada familiar se nombra el parentesco:
//   - sangre (U…U D…D): papá, abuela, tío abuelo, primo segundo, sobrina nieta…
//   - políticos: suegro, cuñada, yerno, "esposa de tu primo",
//     "abuelo de tu esposa"…
// Cada familiar ve los parentescos desde su propia manzana (para ti
// Francisco es "papá"; para tu hijo, "abuelo").
import type { Member, Relationship } from './types'

type Step = 'U' | 'D' | 'S'

function g(m: Member | undefined, male: string, female: string, neutral: string): string {
  if (m?.gender === 'male') return male
  if (m?.gender === 'female') return female
  return neutral
}

const ORD_M = ['', '', 'segundo', 'tercero', 'cuarto', 'quinto']
const ORD_F = ['', '', 'segunda', 'tercera', 'cuarta', 'quinta']
function ord(m: Member | undefined, n: number): string {
  const i = Math.min(n, 5)
  return g(m, ORD_M[i], ORD_F[i], `${ORD_M[i]}/a`)
}

// Parentesco de sangre: `a` pasos hacia arriba y luego `b` hacia abajo.
function blood(a: number, b: number, m: Member | undefined): string | null {
  if (a === 0 && b === 0) return 'Tú'
  if (b === 0) {
    return [null,
      g(m, 'papá', 'mamá', 'papá/mamá'),
      g(m, 'abuelo', 'abuela', 'abuelo/a'),
      g(m, 'bisabuelo', 'bisabuela', 'bisabuelo/a'),
      g(m, 'tatarabuelo', 'tatarabuela', 'tatarabuelo/a')][a] ?? g(m, 'ancestro', 'ancestra', 'ancestro/a')
  }
  if (a === 0) {
    return [null,
      g(m, 'hijo', 'hija', 'hijo/a'),
      g(m, 'nieto', 'nieta', 'nieto/a'),
      g(m, 'bisnieto', 'bisnieta', 'bisnieto/a'),
      g(m, 'tataranieto', 'tataranieta', 'tataranieto/a')][b] ?? g(m, 'descendiente', 'descendiente', 'descendiente')
  }
  if (a === 1 && b === 1) return g(m, 'hermano', 'hermana', 'hermano/a')
  if (a === 1) {          // hijos de hermanos y su descendencia
    return [null, null,
      g(m, 'sobrino', 'sobrina', 'sobrino/a'),
      g(m, 'sobrino nieto', 'sobrina nieta', 'sobrino/a nieto/a'),
      g(m, 'sobrino bisnieto', 'sobrina bisnieta', 'sobrino/a bisnieto/a')][b] ?? null
  }
  if (b === 1) {          // hermanos de ancestros
    return [null, null,
      g(m, 'tío', 'tía', 'tío/a'),
      g(m, 'tío abuelo', 'tía abuela', 'tío/a abuelo/a'),
      g(m, 'tío bisabuelo', 'tía bisabuela', 'tío/a bisabuelo/a')][a] ?? null
  }
  // a ≥ 2 y b ≥ 2: primos y sus generaciones
  if (a === b) {
    return a === 2 ? g(m, 'primo', 'prima', 'primo/a') : `${g(m, 'primo', 'prima', 'primo/a')} ${ord(m, a - 1)}`
  }
  if (a > b) {             // generación de arriba: primos de mis papás, etc.
    const base = a - b === 1 ? g(m, 'tío', 'tía', 'tío/a') : g(m, 'tío abuelo', 'tía abuela', 'tío/a abuelo/a')
    return `${base} ${ord(m, b)}`
  }
  const base = b - a === 1 ? g(m, 'sobrino', 'sobrina', 'sobrino/a') : g(m, 'sobrino nieto', 'sobrina nieta', 'sobrino/a nieto/a')
  return `${base} ${ord(m, a)}`
}

function spouseWord(m: Member | undefined): string {
  return g(m, 'esposo', 'esposa', 'pareja')
}

// Nombre para un camino. `nodes[i]` es el familiar al que se llega tras el paso i.
function nameFor(path: string, nodes: Member[]): string | null {
  const target = nodes[nodes.length - 1]
  const pure = /^(U*)(D*)$/.exec(path)
  if (pure) return blood(pure[1].length, pure[2].length, target)

  switch (path) {
    case 'S': return spouseWord(target)
    case 'SU': return g(target, 'suegro', 'suegra', 'suegro/a')
    case 'SUD': case 'UDS': return g(target, 'cuñado', 'cuñada', 'cuñado/a')
    case 'DS': return g(target, 'yerno', 'nuera', 'yerno/nuera')
    case 'SD': return g(target, 'hijastro', 'hijastra', 'hijastro/a')
    case 'US': return g(target, 'padrastro', 'madrastra', 'padrastro/madrastra')
    case 'USD': return g(target, 'medio hermano', 'media hermana', 'medio/a hermano/a')
  }

  // Termina en pareja: "esposa de tu primo".
  if (path.endsWith('S') && path.length > 1) {
    const prefix = nameFor(path.slice(0, -1), nodes.slice(0, -1))
    if (prefix && prefix !== 'Tú') return `${spouseWord(target)} de tu ${prefix}`
  }
  // Empieza en pareja: familiares de tu pareja, "abuelo de tu esposa".
  if (path.startsWith('S') && path.length > 1) {
    const rest = /^(U*)(D*)$/.exec(path.slice(1))
    if (rest) {
      const name = blood(rest[1].length, rest[2].length, target)
      if (name) return `${name} de tu ${spouseWord(nodes[0])}`
    }
  }
  return null
}

/**
 * Devuelve un mapa id → parentesco ("papá", "tía abuela", "esposa de tu
 * primo"…) visto desde `meId`. Quien está en el árbol pero sin un nombre
 * claro (o sin conexión con tu manzana) queda como "familiar".
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

  const edges = new Map<string, Array<{ to: string; step: Step | 'B' }>>()
  const add = (a: string, b: string, step: Step | 'B') => {
    if (!byId.has(a) || !byId.has(b) || a === b) return
    if (!edges.has(a)) edges.set(a, [])
    edges.get(a)!.push({ to: b, step })
  }
  // Parejas conocidas (arrays + tabla relationships), para descartar
  // vínculos padre-hijo imposibles entre esposos.
  const spousePair = new Set<string>()
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (const m of members) for (const s of m.spouses ?? []) spousePair.add(pairKey(m.id, s))
  for (const r of relationships) {
    if (r.relationship === 'spouse' && r.isActive !== false) spousePair.add(pairKey(r.member1Id, r.member2Id))
  }

  // ¿Es confiable que `parentId` sea padre/madre de `child`? Se descartan los
  // datos dañados por un error anterior del formulario "Agregar familiar":
  //  - un esposo registrado como "padre" de su pareja;
  //  - ciclos (A padre de B y B padre de A): se conserva solo el sentido
  //    que concuerda con las generaciones (el padre va una arriba).
  const validParent = (child: Member, parentId: string): boolean => {
    const parent = byId.get(parentId)
    if (!parent) return false
    if (spousePair.has(pairKey(child.id, parentId))) return false
    if ((parent.parents ?? []).includes(child.id)) {
      const gp = parent.generation, gc = child.generation
      if (gp == null || gc == null || gp === gc) return false
      return gp < gc
    }
    return true
  }

  for (const m of members) {
    for (const p of m.parents ?? []) {
      if (!validParent(m, p)) continue
      add(m.id, p, 'U'); add(p, m.id, 'D')
    }
    for (const s of m.spouses ?? []) { add(m.id, s, 'S'); add(s, m.id, 'S') }
  }
  for (const r of relationships) {
    if (r.isActive === false) continue
    if (r.relationship === 'spouse') { add(r.member1Id, r.member2Id, 'S'); add(r.member2Id, r.member1Id, 'S') }
    if (r.relationship === 'sibling') { add(r.member1Id, r.member2Id, 'B'); add(r.member2Id, r.member1Id, 'B') }
    if (r.relationship === 'parent') { add(r.member1Id, r.member2Id, 'D'); add(r.member2Id, r.member1Id, 'U') }
    if (r.relationship === 'child') { add(r.member1Id, r.member2Id, 'U'); add(r.member2Id, r.member1Id, 'D') }
  }
  // Orden de exploración: primero sangre (U/D), luego pareja, para que el
  // camino más corto prefiera "tía" sobre "esposa de tu tío" cuando empaten.
  for (const list of edges.values()) {
    list.sort((x, y) => (x.step === 'S' ? 1 : 0) - (y.step === 'S' ? 1 : 0))
  }

  // BFS guardando el camino y la secuencia de familiares.
  const path = new Map<string, string>([[meId, '']])
  const chain = new Map<string, string[]>([[meId, []]])
  let frontier = [meId]
  while (frontier.length) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of edges.get(id) ?? []) {
        if (path.has(e.to)) continue
        const p = path.get(id)! + (e.step === 'B' ? 'UD' : e.step)
        if (p.length > 10) continue
        path.set(e.to, p)
        // Para 'B' el familiar intermedio (el papá en común) no se conoce;
        // se repite el destino, que basta para nombrar el parentesco.
        chain.set(e.to, [...chain.get(id)!, ...(e.step === 'B' ? [e.to, e.to] : [e.to])])
        next.push(e.to)
      }
    }
    frontier = next
  }

  for (const m of members) {
    const p = path.get(m.id)
    if (p === undefined) { out.set(m.id, 'familiar'); continue }
    const nodes = (chain.get(m.id) ?? []).map(id => byId.get(id)!).filter(Boolean)
    out.set(m.id, nameFor(p, nodes) ?? 'familiar')
  }
  return out
}

/** "Tu abuela", "Tú", "Esposa de tu primo", "Familiar"… listo para mostrar. */
export function kinshipPhrase(label: string | undefined): string {
  if (!label) return ''
  if (label === 'Tú') return 'Tú'
  if (label === 'familiar') return 'Familiar'
  if (label.includes(' de tu ')) return label.charAt(0).toUpperCase() + label.slice(1)
  return `Tu ${label}`
}
