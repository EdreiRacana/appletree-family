import type { Member, Relationship } from './types'

/**
 * Genealogy Tree Layout Engine v12 — "Compact Canopy"
 * ───────────────────────────────────────────────────
 * Hierarchical subtree packing (Reingold-Tilford style):
 *
 *  1. Members of each generation are grouped into UNITS (couples / singles).
 *  2. Units are linked to their parent unit, forming a forest of family trees.
 *  3. Widths are computed BOTTOM-UP: a unit's subtree width is the max of its
 *     own width and the packed width of its children's subtrees.
 *  4. Positions are assigned TOP-DOWN: every unit is centered over its own
 *     children — never over the whole row — producing a compact canopy where
 *     branches hug their bloodline.
 *
 *  Guarantees:
 *   • Zero overlaps (sibling subtrees own disjoint horizontal spans).
 *   • Parent-child connector lines flow straight down, no crossings between
 *     separate family branches.
 *   • Deterministic output (stable sorting everywhere) — no layout jumps.
 */

// ── LAYOUT CONSTANTS · single source of truth ──────────────────────
// All spacing derives from NODE_SIZE so the tree keeps proportional
// breathing room at any family size. Resize the tree by changing ONLY this.
export const NODE_SIZE = 140                        // apple diameter in px
export const SPOUSE_SPACING = NODE_SIZE * 1.02      // slot per person inside a couple (apples nearly kiss)
export const SUBTREE_GAP = NODE_SIZE * 0.35         // clear air between sibling sub-families
export const ROOT_GAP = NODE_SIZE * 0.6             // air between unrelated root trees
export const GENERATION_GAP = NODE_SIZE * 1.7       // vertical gap between generations
const LABEL_CLEARANCE = NODE_SIZE * 0.12            // extra width so name labels never collide

const ROOT_Y = 900      // generation 0 (roots) sit at the bottom; tree grows upward
const CENTER_X = 960

type Positioned = Member & { canvasX: number; canvasY: number }

interface Unit {
  id: string
  members: Member[]
  generation: number
  children: Unit[]
}

/** Visual width of the unit itself (its members side by side). */
function ownWidth(unit: Unit): number {
  return (unit.members.length - 1) * SPOUSE_SPACING + NODE_SIZE + LABEL_CLEARANCE
}

export function computeTreeLayout(members: Member[] = [], relationships: Relationship[] = []): Positioned[] {
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

  // 2. BUILD UNITS (couples clustered via spouse relationships) per generation
  const allUnits: Unit[] = []
  const unitOfMember = new Map<string, Unit>()

  sortedGens.forEach(g => {
    const genMembers = [...gens[g]]

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
      let orderedIds = clusterIds
      if (clusterIds.length > 1) {
        const byConnections = [...clusterIds].sort(
          (a, b) => spouseAdjacency[b].length - spouseAdjacency[a].length
        )
        const arranged: string[] = []
        byConnections.forEach((id, idx) => {
          if (idx % 2 === 0) arranged.push(id)
          else arranged.unshift(id)
        })
        orderedIds = arranged
      }

      const unit: Unit = {
        id: orderedIds[0],
        members: orderedIds.map(id => genMembers.find(gm => gm.id === id)!),
        generation: g,
        children: []
      }
      allUnits.push(unit)
      unit.members.forEach(mem => unitOfMember.set(mem.id, unit))
    })
  })

  // 3. LINK UNITS INTO A FOREST: each unit attaches to the unit holding
  //    the majority of its members' parents (must be an older generation).
  const roots: Unit[] = []

  allUnits.forEach(unit => {
    const votes = new Map<Unit, number>()
    unit.members.forEach(m => {
      (m.parents || []).forEach(pid => {
        const pUnit = unitOfMember.get(pid)
        if (pUnit && pUnit.generation < unit.generation) {
          votes.set(pUnit, (votes.get(pUnit) || 0) + 1)
        }
      })
    })

    if (votes.size === 0) {
      roots.push(unit)
      return
    }

    let parentUnit: Unit | null = null
    let bestVotes = -1
    votes.forEach((count, pUnit) => {
      if (count > bestVotes || (count === bestVotes && parentUnit && pUnit.id.localeCompare(parentUnit.id) < 0)) {
        bestVotes = count
        parentUnit = pUnit
      }
    })
    parentUnit!.children.push(unit)
  })

  // Siblings ordered by birth date (eldest left), then by id for determinism
  const eldestBirth = (u: Unit): string => {
    const dates = u.members.map(m => m.dateOfBirth || '9999-12-31').sort()
    return dates[0]
  }
  const sortChildren = (u: Unit) => {
    u.children.sort((a, b) => {
      const d = eldestBirth(a).localeCompare(eldestBirth(b))
      return d !== 0 ? d : a.id.localeCompare(b.id)
    })
    u.children.forEach(sortChildren)
  }
  roots.forEach(sortChildren)
  roots.sort((a, b) => (a.generation - b.generation) || a.id.localeCompare(b.id))

  // 4. CONTOUR-BASED PACKING (true Reingold-Tilford)
  //    Each subtree carries a per-generation contour [min,max]. Siblings are
  //    packed as close as their contours allow at EVERY shared level — a deep
  //    narrow branch tucks beneath a shallow wide one, instead of reserving a
  //    full bounding box. Parents center over the midpoint of their children.
  type Contour = Map<number, { min: number; max: number }>

  interface SubLayout {
    positions: Map<string, number>      // memberId -> x (frame of this subtree)
    unitCenter: number                  // x of this unit's center
    contour: Contour
  }

  const shiftLayout = (sl: SubLayout, dx: number) => {
    sl.positions.forEach((x, id) => sl.positions.set(id, x + dx))
    sl.unitCenter += dx
    sl.contour.forEach(ext => { ext.min += dx; ext.max += dx })
  }

  const mergeContour = (target: Contour, source: Contour) => {
    source.forEach((ext, gen) => {
      const t = target.get(gen)
      if (!t) target.set(gen, { min: ext.min, max: ext.max })
      else {
        t.min = Math.min(t.min, ext.min)
        t.max = Math.max(t.max, ext.max)
      }
    })
  }

  /** Minimum dx so that `incoming` clears `placed` by `gap` at every shared level. */
  const requiredShift = (placed: Contour, incoming: Contour, gap: number): number => {
    let shift = -Infinity
    incoming.forEach((ext, gen) => {
      const p = placed.get(gen)
      if (p) shift = Math.max(shift, p.max + gap - ext.min)
    })
    if (shift === -Infinity) {
      // No shared generations: fall back to global right edge
      let globalMax = -Infinity
      placed.forEach(ext => { globalMax = Math.max(globalMax, ext.max) })
      let incomingMin = Infinity
      incoming.forEach(ext => { incomingMin = Math.min(incomingMin, ext.min) })
      shift = (globalMax === -Infinity) ? 0 : globalMax + gap - incomingMin
    }
    return shift
  }

  const layoutSubtree = (u: Unit): SubLayout => {
    const half = ownWidth(u) / 2

    const placeOwnMembers = (positions: Map<string, number>, center: number) => {
      const L = u.members.length
      const startOffset = -((L - 1) * SPOUSE_SPACING) / 2
      u.members.forEach((member, i) => {
        positions.set(member.id, center + startOffset + i * SPOUSE_SPACING)
      })
    }

    if (u.children.length === 0) {
      const positions = new Map<string, number>()
      placeOwnMembers(positions, 0)
      const contour: Contour = new Map([[u.generation, { min: -half, max: half }]])
      return { positions, unitCenter: 0, contour }
    }

    // Pack children left → right against the merged contour
    const childLayouts = u.children.map(layoutSubtree)
    const merged: Contour = new Map()
    childLayouts.forEach((cl, i) => {
      const dx = i === 0 ? 0 : requiredShift(merged, cl.contour, SUBTREE_GAP)
      if (dx !== 0) shiftLayout(cl, dx)
      mergeContour(merged, cl.contour)
    })

    // Parent sits over the midpoint of its first and last child (RT aesthetic)
    const center = (childLayouts[0].unitCenter + childLayouts[childLayouts.length - 1].unitCenter) / 2

    const positions = new Map<string, number>()
    childLayouts.forEach(cl => cl.positions.forEach((x, id) => positions.set(id, x)))
    placeOwnMembers(positions, center)

    const ownExt = merged.get(u.generation)
    if (!ownExt) merged.set(u.generation, { min: center - half, max: center + half })
    else {
      ownExt.min = Math.min(ownExt.min, center - half)
      ownExt.max = Math.max(ownExt.max, center + half)
    }

    return { positions, unitCenter: center, contour: merged }
  }

  // 5. PACK ROOT TREES with the same contour logic, then center the forest
  const forest: Contour = new Map()
  const rootLayouts = roots.map(layoutSubtree)
  rootLayouts.forEach((rl, i) => {
    const dx = i === 0 ? 0 : requiredShift(forest, rl.contour, ROOT_GAP)
    if (dx !== 0) shiftLayout(rl, dx)
    mergeContour(forest, rl.contour)
  })

  let fMin = Infinity, fMax = -Infinity
  forest.forEach(ext => { fMin = Math.min(fMin, ext.min); fMax = Math.max(fMax, ext.max) })
  const globalShift = CENTER_X - (fMin + fMax) / 2

  const positioned: Positioned[] = []
  const memberById = new Map(stableMembers.map(m => [m.id, m]))
  rootLayouts.forEach(rl => {
    rl.positions.forEach((x, id) => {
      const m = memberById.get(id)!
      positioned.push({
        ...m,
        canvasX: x + globalShift,
        canvasY: ROOT_Y - (m.generation ?? 0) * GENERATION_GAP
      })
    })
  })

  return positioned
}
