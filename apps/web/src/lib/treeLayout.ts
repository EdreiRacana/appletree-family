import type { Member, Relationship } from './types'

/**
 * Genealogy Tree Layout Engine (Ascending Roots v10) - GIANT 210px NODES
 * Aggressive calibration for large assets to ensure an immersive, clear view.
 */

export function computeTreeLayout(members: Member[] = [], relationships: Relationship[] = []) {
  if (!members || members.length === 0) return []

  const gens: Record<number, Member[]> = {}
  members.forEach(m => {
    const g = m.generation ?? 0
    if (!gens[g]) gens[g] = []
    gens[g].push(m)
  })

  const sortedGens = Object.keys(gens).map(Number).sort((a,b) => a - b)
  
  // CALIBRATED FOR 210px NODES
  const HORIZONTAL_GAP = 550 
  const VERTICAL_GAP = 225 // Reduced to half for modern, compact layout
  const BASE_Y = 1300
  const CENTER_X = 960

  const positioned: (Member & { canvasX: number, canvasY: number })[] = []

  sortedGens.forEach((g, gIdx) => {
    const genMembers = [...gens[g]]
    const levelMembers: (Member & { canvasX: number, canvasY: number })[] = []
    
    const genSpouses = relationships.filter(rel => 
      rel.relationship === 'spouse' && 
      genMembers.some(m => m.id === rel.member1Id) && 
      genMembers.some(m => m.id === rel.member2Id)
    )

    const processedIds = new Set<string>()
    const units: Member[][] = []

    genSpouses.forEach(rel => {
      const m1 = genMembers.find(m => m.id === rel.member1Id)
      const m2 = genMembers.find(m => m.id === rel.member2Id)
      if (m1 && m2) {
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

    const UNIT_GAP = 700 // Broad separation for large apples
    let currentX = CENTER_X - (((units.length - 1) * UNIT_GAP) / 2)

    units.forEach(unit => {
      if (unit.length === 2) {
        // Spouse centers (220px apart to avoid edge-to-edge touch with 210px assets)
        levelMembers.push({ ...unit[0], canvasX: currentX - 110, canvasY: BASE_Y - (gIdx * VERTICAL_GAP) })
        levelMembers.push({ ...unit[1], canvasX: currentX + 110, canvasY: BASE_Y - (gIdx * VERTICAL_GAP) })
      } else {
        levelMembers.push({ ...unit[0], canvasX: currentX, canvasY: BASE_Y - (gIdx * VERTICAL_GAP) })
      }
      currentX += UNIT_GAP
    })

    positioned.push(...levelMembers)
  })

  return positioned
}
