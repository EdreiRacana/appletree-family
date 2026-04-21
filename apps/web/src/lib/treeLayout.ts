import type { Member, Relationship } from './types'

/**
 * Genealogy Tree Layout Engine (Ascending Roots v11) - STABLE & CALIBRATED
 * Uses deterministic sorting to prevent layout jumps.
 */

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
  
  // 2. DIMENSIONS (Calibrated for a standard 1080p view)
  const HORIZONTAL_UNIT_GAP = 400 
  const VERTICAL_GENERATION_GAP = 190
  const BASE_Y = 800 // Lowered from 1300 to bring the tree into view
  const CENTER_X = 960

  const positioned: (Member & { canvasX: number, canvasY: number })[] = []

  sortedGens.forEach((g, gIdx) => {
    const genMembers = [...gens[g]]
    const levelMembers: (Member & { canvasX: number, canvasY: number })[] = []
    
    // Group spouses at this level
    const genSpouseRels = stableRelationships.filter(rel => 
      rel.relationship === 'spouse' && 
      genMembers.some(m => m.id === rel.member1Id) && 
      genMembers.some(m => m.id === rel.member2Id)
    )

    const processedIds = new Set<string>()
    const units: Member[][] = []

    genSpouseRels.forEach(rel => {
      const m1 = genMembers.find(m => m.id === rel.member1Id)
      const m2 = genMembers.find(m => m.id === rel.member2Id)
      if (m1 && m2 && !processedIds.has(m1.id) && !processedIds.has(m2.id)) {
        units.push([m1, m2])
        processedIds.add(m1.id)
        processedIds.add(m2.id)
      }
    })

    genMembers.forEach(m => {
      if (!processedIds.has(m.id)) {
        units.push([m])
      }
    })

    // Calculate row container width to center it
    let currentX = CENTER_X - (((units.length - 1) * HORIZONTAL_UNIT_GAP) / 2)
    const currentY = BASE_Y - (gIdx * VERTICAL_GENERATION_GAP)

    units.forEach(unit => {
      if (unit.length === 2) {
        levelMembers.push({ ...unit[0], canvasX: currentX - 100, canvasY: currentY })
        levelMembers.push({ ...unit[1], canvasX: currentX + 100, canvasY: currentY })
      } else {
        levelMembers.push({ ...unit[0], canvasX: currentX, canvasY: currentY })
      }
      currentX += HORIZONTAL_UNIT_GAP
    })

    positioned.push(...levelMembers)
  })

  return positioned
}
