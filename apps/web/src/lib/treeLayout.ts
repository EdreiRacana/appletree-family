import type { Member, Relationship } from './types'

/**
 * Layout Engine v15 — "Honeycomb"
 * ────────────────────────────────
 * Apple-Watch style hexagonal packing. Todos los miembros se colocan en
 * una espiral hexagonal partiendo del proband (persona central). El
 * orden lo decide un BFS por relaciones (spouse → children → parents →
 * siblings), así los familiares cercanos quedan visualmente cerca.
 * Combinado con la lente radial del canvas se ve como el home screen
 * del watchOS: cluster denso, todo cabe, escala infinita.
 */

export const NODE_SIZE = 92
// Hex cell radius — la distancia del centro de una celda a un vecino.
// 1.05 x NODE_SIZE deja aire suficiente para que las manzanas no se toquen.
export const HEX_R = NODE_SIZE * 1.05
// Se mantienen para el layout viejo (por si algún módulo lo importa),
// aunque el default es ahora honeycomb.
export const SPOUSE_SPACING = NODE_SIZE * 0.95
export const UNIT_AIR = NODE_SIZE * 0.18
export const GENERATION_GAP = NODE_SIZE * 2.0

// Generador de espiral hexagonal — produce coords axiales (q, r) partiendo
// del origen y creciendo por anillos. El ring n tiene 6n celdas.
function hexSpiral(count: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [[0, 0]]
  if (count <= 1) return cells
  const dirs: Array<[number, number]> = [
    [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
  ]
  let ring = 1
  while (cells.length < count) {
    // arrancar en (0, -ring) — arriba del centro
    let q = 0
    let r = -ring
    for (let side = 0; side < 6; side++) {
      const [dq, dr] = dirs[side]
      for (let step = 0; step < ring; step++) {
        cells.push([q, r])
        if (cells.length >= count) return cells
        q += dq
        r += dr
      }
    }
    ring++
  }
  return cells
}

// Convierte coords axiales a pixel (pointy-top hex layout)
function hexToPixel(q: number, r: number): [number, number] {
  const x = HEX_R * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r)
  const y = HEX_R * (1.5 * r)
  return [x, y]
}

// Elige el proband — miembro raíz del árbol. Prioriza:
//   1. El más joven que tenga hijos (jefe de familia actual)
//   2. Fallback: primer miembro por id
function pickProband(members: Member[]): Member {
  const withChildren = new Set<string>()
  members.forEach(m => (m.parents || []).forEach(p => withChildren.add(p)))
  const parentsOfLiving = members.filter(m => withChildren.has(m.id))
  if (parentsOfLiving.length > 0) {
    // El de generación más baja (más viejo) o el primero por id
    parentsOfLiving.sort((a, b) => (a.generation ?? 0) - (b.generation ?? 0) || a.id.localeCompare(b.id))
    return parentsOfLiving[0]
  }
  return [...members].sort((a, b) => a.id.localeCompare(b.id))[0]
}

// BFS por relaciones: partiendo del proband, expande a spouse → hijos →
// padres → hermanos, para que los cercanos queden en anillos interiores.
function bfsOrder(proband: Member, members: Member[], relationships: Relationship[]): Member[] {
  const byId = new Map<string, Member>()
  members.forEach(m => byId.set(m.id, m))
  const adjacency = new Map<string, string[]>()
  const addLink = (a: string, b: string) => {
    if (!byId.has(a) || !byId.has(b)) return
    if (!adjacency.has(a)) adjacency.set(a, [])
    const arr = adjacency.get(a)!
    if (!arr.includes(b)) arr.push(b)
  }
  members.forEach(m => (m.parents || []).forEach(p => { addLink(m.id, p); addLink(p, m.id) }))
  relationships.forEach(rel => {
    if (rel.relationship === 'spouse') {
      addLink(rel.member1Id, rel.member2Id)
      addLink(rel.member2Id, rel.member1Id)
    }
  })

  const visited = new Set<string>([proband.id])
  const queue: string[] = [proband.id]
  const ordered: Member[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    ordered.push(byId.get(id)!)
    const neighbors = adjacency.get(id) || []
    // Ordenar vecinos para determinismo (misma vista siempre)
    neighbors.sort((a, b) => a.localeCompare(b))
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n)
        queue.push(n)
      }
    }
  }
  // Añadir miembros aislados (sin conexiones al cluster principal)
  members.forEach(m => { if (!visited.has(m.id)) ordered.push(m) })
  return ordered
}

// ─── HONEYCOMB LAYOUT — nueva función principal ────────────────────
export function computeHoneycombLayout(
  members: Member[] = [],
  relationships: Relationship[] = [],
) {
  if (!members || members.length === 0) return []
  const proband = pickProband(members)
  const ordered = bfsOrder(proband, members, relationships)
  const cells = hexSpiral(ordered.length)
  const CENTER_X = 960
  const CENTER_Y = 500
  return ordered.map((m, i) => {
    const [q, r] = cells[i]
    const [px, py] = hexToPixel(q, r)
    return { ...m, canvasX: CENTER_X + px, canvasY: CENTER_Y + py }
  })
}

export function computeTreeLayout(members: Member[] = [], relationships: Relationship[] = []) {
  if (!members || members.length === 0) return []

  // 1. STABLE SORTING: deterministic processing prevents layout jumps
  const stableMembers = [...members].sort((a, b) => a.id.localeCompare(b.id))
  const stableRelationships = [...relationships].sort((a, b) => a.id.localeCompare(b.id))

  const gens: Record<number, Member[]> = {}
  stableMembers.forEach(m => {
    const g = m.generation ?? 0
    if (!gens[g]) gens[g] = []
    gens[g].push(m)
  })

  const sortedGens = Object.keys(gens).map(Number).sort((a, b) => a - b)

  const ROOT_Y = 900   // Generation 0 (roots) sits at the bottom; tree grows upward
  const CENTER_X = 960

  const positioned: (Member & { canvasX: number, canvasY: number })[] = []

  sortedGens.forEach(g => {
    const genMembers = [...gens[g]]

    // ── 2. CLUSTER SPOUSES INTO UNITS ──────────────────────────────
    const spouseAdjacency: Record<string, string[]> = {}
    genMembers.forEach(m => { spouseAdjacency[m.id] = [] })

    stableRelationships
      .filter(rel =>
        rel.relationship === 'spouse' &&
        spouseAdjacency[rel.member1Id] !== undefined &&
        spouseAdjacency[rel.member2Id] !== undefined
      )
      .forEach(rel => {
        spouseAdjacency[rel.member1Id].push(rel.member2Id)
        spouseAdjacency[rel.member2Id].push(rel.member1Id)
      })

    const processedIds = new Set<string>()
    const units: Member[][] = []

    genMembers.forEach(m => {
      if (processedIds.has(m.id)) return

      // Flood-fill the spouse cluster
      const clusterIds: string[] = []
      const queue = [m.id]
      processedIds.add(m.id)
      while (queue.length > 0) {
        const curr = queue.shift()!
        clusterIds.push(curr)
        spouseAdjacency[curr].forEach(neighbor => {
          if (!processedIds.has(neighbor)) {
            processedIds.add(neighbor)
            queue.push(neighbor)
          }
        })
      }

      // Most-connected member sits in the middle of the couple cluster
      if (clusterIds.length > 1) {
        clusterIds.sort((a, b) => spouseAdjacency[b].length - spouseAdjacency[a].length)
        const arranged: string[] = []
        clusterIds.forEach((id, idx) => {
          if (idx % 2 === 0) arranged.push(id)
          else arranged.unshift(id)
        })
        units.push(arranged.map(id => genMembers.find(member => member.id === id)!))
      } else {
        units.push([m])
      }
    })

    // ── 3. ORDER UNITS BY PARENT X (prevents ALL line crossings) ──
    const getParentX = (unit: Member[]): number | null => {
      let totalX = 0
      let count = 0
      unit.forEach(m => {
        (m.parents || []).forEach(pid => {
          const pNode = positioned.find(pn => pn.id === pid)
          if (pNode && pNode.canvasX !== undefined) {
            totalX += pNode.canvasX
            count++
          }
        })
      })
      return count > 0 ? totalX / count : null
    }

    // ── 3b. ORIENT SPOUSES WITHIN EACH COUPLE BY THEIR OWN PARENTS ──
    // A couple bridging two family trees ("AMBAS" view) must place each
    // spouse on the side of their own parents, or their lines swap & cross.
    const memberParentX = (m: Member): number | null => {
      const ps = (m.parents || [])
        .map(pid => positioned.find(pn => pn.id === pid))
        .filter((p): p is (Member & { canvasX: number, canvasY: number }) => !!p)
      if (ps.length === 0) return null
      return ps.reduce((s, p) => s + p.canvasX, 0) / ps.length
    }

    units.forEach(unit => {
      if (unit.length < 2) return
      const keys = new Map<string, number | null>()
      unit.forEach(m => keys.set(m.id, memberParentX(m)))
      const known = unit.filter(m => keys.get(m.id) !== null)
      if (known.length < 2) return // nothing to orient with a single anchor

      const knownMean = known.reduce((s, m) => s + (keys.get(m.id) as number), 0) / known.length

      // Parentless members hug their spouse, sitting on the outer side
      const resolved = new Map<string, number>()
      unit.forEach(m => {
        const k = keys.get(m.id)
        if (k != null) { resolved.set(m.id, k); return }
        const spouseId = (spouseAdjacency[m.id] || []).find(sid => keys.get(sid) != null)
        const anchor = spouseId != null ? (keys.get(spouseId) ?? knownMean) : knownMean
        const side = anchor >= knownMean ? 1 : -1
        resolved.set(m.id, anchor + side * 0.001)
      })

      unit.sort((a, b) => {
        const d = (resolved.get(a.id)!) - (resolved.get(b.id)!)
        return d !== 0 ? d : a.id.localeCompare(b.id)
      })
    })

    const unitDesired = new Map<Member[], number | null>()
    units.forEach(u => unitDesired.set(u, getParentX(u)))

    units.sort((unitA, unitB) => {
      const pXa = unitDesired.get(unitA) ?? CENTER_X
      const pXb = unitDesired.get(unitB) ?? CENTER_X
      if (pXa !== pXb) return pXa - pXb
      return unitA[0].id.localeCompare(unitB[0].id) // deterministic fallback
    })

    // ── 4. MAGNETIC PLACEMENT (isotonic regression / PAV) ─────────
    // Each unit wants its center at its parents' midpoint. Minimum
    // center-to-center distances keep apples from ever overlapping.
    // PAV finds the closest-to-desired positions that respect both.
    const n = units.length
    const widths = units.map(u => u.length * SPOUSE_SPACING)

    // Units with no parents (roots / unlinked) desire the average of their
    // siblings-with-parents row, falling back to CENTER_X — so root rows
    // stay centered and orphan units don't yank the layout sideways.
    const knownDesires = units
      .map(u => unitDesired.get(u))
      .filter((d): d is number => d !== null)
    const fallbackDesire = knownDesires.length > 0
      ? knownDesires.reduce((a, b) => a + b, 0) / knownDesires.length
      : CENTER_X

    const desired = units.map(u => unitDesired.get(u) ?? fallbackDesire)

    // cum[i] = required offset of unit i's center from unit 0's center
    const cum: number[] = [0]
    for (let i = 1; i < n; i++) {
      cum[i] = cum[i - 1] + widths[i - 1] / 2 + UNIT_AIR + widths[i] / 2
    }

    // Transform: y[i] = x[i] - cum[i]. Constraint x[i] >= x[i-1] + gap
    // becomes y[i] >= y[i-1]  →  classic isotonic regression, solved by PAV.
    const t = desired.map((d, i) => d - cum[i])
    const blocks: { sum: number, count: number, val: number }[] = []
    t.forEach(v => {
      blocks.push({ sum: v, count: 1, val: v })
      while (blocks.length > 1 && blocks[blocks.length - 1].val < blocks[blocks.length - 2].val) {
        const b = blocks.pop()!
        const a = blocks[blocks.length - 1]
        a.sum += b.sum
        a.count += b.count
        a.val = a.sum / a.count
      }
    })
    const y: number[] = []
    blocks.forEach(b => { for (let k = 0; k < b.count; k++) y.push(b.val) })

    // ── 5. EMIT POSITIONS ──────────────────────────────────────────
    const currentY = ROOT_Y - g * GENERATION_GAP
    units.forEach((unit, i) => {
      const centerX = y[i] + cum[i]
      const L = unit.length
      const startOffset = -((L - 1) * SPOUSE_SPACING) / 2
      unit.forEach((member, k) => {
        positioned.push({ ...member, canvasX: centerX + startOffset + k * SPOUSE_SPACING, canvasY: currentY })
      })
    })
  })

  return positioned
}
