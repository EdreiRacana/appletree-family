import type { Member, Relationship } from './types'

/**
 * Genealogy Tree Layout Engine (Ascending Roots v11) - STABLE & CALIBRATED
 * Uses deterministic sorting to prevent layout jumps.
 */

// ── LAYOUT CONSTANTS · single source of truth ──────────────────────
// NODE_SIZE controls the apple diameter AND every spacing value below it.
// Because all gaps are derived from NODE_SIZE, the tree keeps proportional
// breathing room and apples never overlap, no matter how large the family grows.
// To resize the whole tree, change ONLY this number.
export const NODE_SIZE = 140                       // apple diameter in px (was 200)
export const SPOUSE_SPACING = NODE_SIZE * 1.05     // horizontal slot per person inside a couple
export const UNIT_GAP = NODE_SIZE * 1.6            // min horizontal gap between separate family units
export const GENERATION_GAP = NODE_SIZE * 1.7      // vertical gap between generations

export function computeTreeLayout(members: Member[] = [], relationships: Relationship[] = []) {
  if (!members || members.length === 0) return []

  // 1. STABLE SORTING: Ensure deterministic processing
  const stableMembers = [...members].sort((a, b) => a.id.localeCompare(b.id))
  const stableRelationships = [...relationships].sort((a, b) => a.id.localeCompare(b.id))

  const gens: Record<number, Member[]> = {}
  stableMembers.forEach(m => {
    const g = m.generation ?? 0
    if (!gens[g]) gens[g] = []
    gens[g].push(m)
  })

  const sortedGens = Object.keys(gens).map(Number).sort((a,b) => a - b)
  
  // 2. DIMENSIONS (Calibrated for Top-Down view)
  const HORIZONTAL_UNIT_GAP = UNIT_GAP
  const VERTICAL_GENERATION_GAP = GENERATION_GAP
  const ROOT_Y = 900 // Grandparents (Roots) start at the bottom
  const CENTER_X = 960

  const positioned: (Member & { canvasX: number, canvasY: number })[] = []

  sortedGens.forEach((g, gIdx) => {
    const genMembers = [...gens[g]]
    const levelMembers: (Member & { canvasX: number, canvasY: number })[] = []
    
    // Group spouses at this level into clusters
    const spouseAdjacency: Record<string, string[]> = {}
    genMembers.forEach(m => { spouseAdjacency[m.id] = [] })

    const genSpouseRels = stableRelationships.filter(rel => 
      rel.relationship === 'spouse' && 
      genMembers.some(m => m.id === rel.member1Id) && 
      genMembers.some(m => m.id === rel.member2Id)
    )

    genSpouseRels.forEach(rel => {
      if (spouseAdjacency[rel.member1Id] && spouseAdjacency[rel.member2Id]) {
        spouseAdjacency[rel.member1Id].push(rel.member2Id)
        spouseAdjacency[rel.member2Id].push(rel.member1Id)
      }
    })

    const processedIds = new Set<string>()
    const units: Member[][] = []

    genMembers.forEach(m => {
      if (!processedIds.has(m.id)) {
        // Find connected component (cluster)
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

        // Sort cluster so node with most connections is in the middle
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
      }
    })

    // SORT UNITS BY PARENT X COORDINATE TO PREVENT LINE CROSSING
    // By determining where the parents of this unit are placed, we can order the children 
    // horizontally so their connection lines go straight up instead of crossing.
    units.sort((unitA, unitB) => {
      const getParentX = (unit: Member[]) => {
        let totalX = 0
        let count = 0
        unit.forEach(m => {
          if (m.parents && m.parents.length > 0) {
            m.parents.forEach(pid => {
              const pNode = positioned.find(pn => pn.id === pid)
              if (pNode && pNode.canvasX !== undefined) {
                totalX += pNode.canvasX
                count++
              }
            })
          }
        })
        return count > 0 ? totalX / count : CENTER_X // neutral fallback
      }

      const pXa = getParentX(unitA)
      const pXb = getParentX(unitB)
      
      if (pXa !== pXb) return pXa - pXb
      
      // Fallback to ID sorting
      return unitA[0].id.localeCompare(unitB[0].id)
    })

    // Calculate row container width to center it dynamically based on unit sizes
    const unitWidths = units.map(u => Math.max(HORIZONTAL_UNIT_GAP, u.length * SPOUSE_SPACING))
    const totalRowWidth = unitWidths.reduce((sum, width) => sum + width, 0)
    let startX = CENTER_X - (totalRowWidth / 2)
    const currentY = ROOT_Y - (g * VERTICAL_GENERATION_GAP)

    units.forEach((unit, idx) => {
      const uWidth = unitWidths[idx]
      const centerX = startX + uWidth / 2
      const L = unit.length
      const startOffset = -((L - 1) * SPOUSE_SPACING) / 2
      
      unit.forEach((member, i) => {
        levelMembers.push({ ...member, canvasX: centerX + startOffset + i * SPOUSE_SPACING, canvasY: currentY })
      })
      
      startX += uWidth
    })

    positioned.push(...levelMembers)
  })

  return positioned
}
