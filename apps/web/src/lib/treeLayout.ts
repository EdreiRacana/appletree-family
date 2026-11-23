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
// Una generación más ancha que esto se acomoda en DOS filas escalonadas
// (como fruta a distintas alturas) para que la familia tenga forma de copa
// y quepa dentro del follaje sin alejar tanto la vista.
export const MAX_ROW_WIDTH = NODE_SIZE * 19
// Distancia vertical entre las dos filas de una misma generación
export const SUB_ROW_GAP = NODE_SIZE * 1.0

// Coloca una fila de unidades (persona o pareja) lo más cerca posible de su
// punto deseado (encima de sus padres) sin encimarse: regresión isotónica (PAV).
function placeRow(widths: number[], desired: number[]): number[] {
  const n = widths.length
  const cum: number[] = [0]
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + widths[i - 1] / 2 + UNIT_AIR + widths[i] / 2
  }
  // y[i] = x[i] - cum[i]; la restricción x[i] >= x[i-1] + espacio se vuelve
  // y[i] >= y[i-1] → regresión isotónica clásica.
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
  return y.map((v, i) => v + cum[i])
}

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

  // Altura acumulada: cada generación sube GENERATION_GAP por nivel, más
  // una fila extra si la generación de abajo se partió en dos.
  let yOffset = 0
  let lastGen: number | null = null
  let lastSplit = false
  let anySplit = false

  sortedGens.forEach(g => {
    const genMembers = [...gens[g]]
    if (lastGen !== null) yOffset += (g - lastGen) * GENERATION_GAP + (lastSplit ? SUB_ROW_GAP : 0)
    else yOffset = g * GENERATION_GAP

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

    // ── 4b. ¿UNA FILA O DOS? ─────────────────────────────────────
    // Si la generación es más ancha que la copa, se reparte en dos filas.
    // Los hermanos (mismos padres) se quedan juntos en la misma fila y las
    // familias se alternan abajo/arriba, en orden de izquierda a derecha.
    const rowWidth = widths.reduce((a, w) => a + w, 0) + UNIT_AIR * Math.max(0, n - 1)
    const subRow: number[] = new Array(n).fill(0)
    const isSplit = rowWidth > MAX_ROW_WIDTH && n >= 4
    if (isSplit) {
      const famKey = (u: Member[]) => u
        .map(m => [...(m.parents || [])].sort().join('+'))
        .filter(Boolean).sort()[0] || `solo:${u[0].id}`
      // Agrupar unidades consecutivas de la misma familia
      const groups: number[][] = []
      units.forEach((u, i) => {
        const last = groups[groups.length - 1]
        if (last && famKey(units[last[0]]) === famKey(u)) last.push(i)
        else groups.push([i])
      })
      // Familias grandes se parten a la mitad para no desbalancear
      const half = Math.ceil(n / 2)
      const chunks: number[][] = []
      groups.forEach(gr => {
        if (gr.length > half) { chunks.push(gr.slice(0, Math.ceil(gr.length / 2))); chunks.push(gr.slice(Math.ceil(gr.length / 2))) }
        else chunks.push(gr)
      })
      // Repartir alternando, pero mandando cada familia a la fila más corta
      // cuando la diferencia ya es grande.
      const load = [0, 0]
      let next = 0
      chunks.forEach(ch => {
        const w = ch.reduce((a, i) => a + widths[i] + UNIT_AIR, 0)
        let row = next
        if (load[row] - load[1 - row] > MAX_ROW_WIDTH * 0.15) row = 1 - row
        ch.forEach(i => { subRow[i] = row })
        load[row] += w
        next = 1 - row
      })
    }

    // ── 5. EMIT POSITIONS ──────────────────────────────────────────
    const baseY = ROOT_Y - yOffset
    ;[0, 1].forEach(row => {
      const idx = units.map((_, i) => i).filter(i => subRow[i] === row)
      if (idx.length === 0) return
      const centers = placeRow(idx.map(i => widths[i]), idx.map(i => desired[i]))
      const rowY = baseY - row * SUB_ROW_GAP
      idx.forEach((ui, k) => {
        const unit = units[ui]
        const L = unit.length
        const startOffset = -((L - 1) * SPOUSE_SPACING) / 2
        unit.forEach((member, j) => {
          positioned.push({ ...member, canvasX: centers[k] + startOffset + j * SPOUSE_SPACING, canvasY: rowY })
        })
      })
    })
    lastSplit = isSplit
    if (isSplit) anySplit = true
    lastGen = g
  })

  // ── 6. COPA EN ARCO ───────────────────────────────────────────────
  // Las filas rectas parecen tabla; una copa es redonda. Cada manzana baja
  // según su distancia horizontal al centro del árbol (parábola): el centro
  // queda arriba y las orillas cuelgan, como fruta en una copa. Todas las
  // filas usan la misma curva, así siguen paralelas y nunca se cruzan
  // (la caída máxima es menor que el espacio entre generaciones).
  if (positioned.length > 1) {
    const xs = positioned.map(p => p.canvasX)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const cx = (minX + maxX) / 2
    const half = Math.max((maxX - minX) / 2, NODE_SIZE)
    // Con filas dobles el árbol ya es más alto: se curva menos para no crecer.
    const DROOP = GENERATION_GAP * (anySplit ? 0.3 : 0.55)
    positioned.forEach(p => {
      const t = (p.canvasX - cx) / half
      p.canvasY = p.canvasY + DROOP * t * t
    })
  }

  return positioned
}
