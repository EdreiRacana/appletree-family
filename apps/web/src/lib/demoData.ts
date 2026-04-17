// AppleTree Family — Demo data replicating the reference image layout
// Replace with real Supabase data once connected

import type { Member, Relationship } from './types'

const TREE_ID = 'demo-tree-001'

export const DEMO_MEMBERS: Member[] = [
  // Generation -3 (great-grandparents row - top)
  {
    id: 'g3-1', treeId: TREE_ID, firstName: 'Santos', lastName: 'López',
    dateOfBirth: '1815-01-01', dateOfDeath: '1889-01-01',
    appleType: 'red', generation: -3, canvasX: 250, canvasY: 50,
  },
  {
    id: 'g3-2', treeId: TREE_ID, firstName: 'Canaria', lastName: 'López',
    dateOfBirth: '1815-01-01', dateOfDeath: '1890-01-01',
    appleType: 'green', generation: -3, canvasX: 370, canvasY: 50,
  },
  {
    id: 'g3-3', treeId: TREE_ID, firstName: 'Azalan', lastName: 'Pérez',
    dateOfBirth: '1826-01-01', dateOfDeath: '1900-01-01',
    appleType: 'red', generation: -3, canvasX: 530, canvasY: 50,
  },
  {
    id: 'g3-4', treeId: TREE_ID, firstName: 'Colles', lastName: 'Pérez',
    dateOfBirth: '1826-01-01', dateOfDeath: '1901-01-01',
    appleType: 'green', generation: -3, canvasX: 650, canvasY: 50,
  },
  // Babies on the right (newest generation)
  {
    id: 'baby-1', treeId: TREE_ID, firstName: 'Sofía', lastName: 'Pérez',
    dateOfBirth: '2024-03-15',
    appleType: 'pink', isBaby: true, gender: 'female',
    generation: 1, canvasX: 780, canvasY: 50,
  },
  {
    id: 'baby-2', treeId: TREE_ID, firstName: 'Mateo', lastName: 'Pérez',
    dateOfBirth: '2023-11-02',
    appleType: 'pink', isBaby: true, gender: 'male',
    generation: 1, canvasX: 880, canvasY: 50,
  },

  // Generation -2 (grandparents)
  {
    id: 'g2-1', treeId: TREE_ID, firstName: 'Margarita', lastName: 'López',
    dateOfBirth: '1888-01-01', dateOfDeath: '1972-01-01',
    appleType: 'red', generation: -2, canvasX: 180, canvasY: 190,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Margarita1&backgroundColor=ffb3b3',
  },
  {
    id: 'g2-2', treeId: TREE_ID, firstName: 'Narcise', lastName: 'López',
    dateOfBirth: '1888-01-01', dateOfDeath: '1975-01-01',
    appleType: 'red', generation: -2, canvasX: 300, canvasY: 190,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Narcise&backgroundColor=ffb3b3',
  },
  {
    id: 'g2-3', treeId: TREE_ID, firstName: 'Margarita', lastName: 'López',
    dateOfBirth: '1888-01-01', dateOfDeath: '1975-01-01',
    appleType: 'green', generation: -2, canvasX: 420, canvasY: 190,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MargaritaG&backgroundColor=b3ffb3',
  },
  {
    id: 'g2-4', treeId: TREE_ID, firstName: 'Andrés', lastName: 'Pérez',
    dateOfBirth: '1888-01-01', dateOfDeath: '1972-01-01',
    appleType: 'red', generation: -2, canvasX: 580, canvasY: 190,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andres2&backgroundColor=ffb3b3',
  },
  {
    id: 'g2-5', treeId: TREE_ID, firstName: 'Andrés', lastName: 'Pérez',
    dateOfBirth: '1888-01-01', dateOfDeath: '1973-01-01',
    appleType: 'red', generation: -2, canvasX: 700, canvasY: 190,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andres3&backgroundColor=ffb3b3',
  },
  {
    id: 'g2-6', treeId: TREE_ID, firstName: 'Andrés', lastName: 'Pérez',
    dateOfBirth: '1880-01-01', dateOfDeath: '1973-01-01',
    appleType: 'red', generation: -2, canvasX: 820, canvasY: 190,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andres4&backgroundColor=ffb3b3',
  },

  // Generation -1 (parents)
  {
    id: 'g1-1', treeId: TREE_ID, firstName: 'Margarita', lastName: 'López',
    dateOfBirth: '1888-01-01', dateOfDeath: '1972-01-01',
    appleType: 'red', generation: -1, canvasX: 340, canvasY: 330,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MargaritaP&backgroundColor=ffb3b3',
  },
  {
    id: 'g1-2', treeId: TREE_ID, firstName: 'Sonioa', lastName: 'López',
    dateOfBirth: '1888-01-01', dateOfDeath: '1972-01-01',
    appleType: 'green', generation: -1, canvasX: 460, canvasY: 330,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sonioa&backgroundColor=b3ffb3',
  },
  {
    id: 'g1-3', treeId: TREE_ID, firstName: 'Andrés', lastName: 'Pérez',
    dateOfBirth: '1964-01-01', dateOfDeath: '1975-01-01',
    appleType: 'red', generation: -1, canvasX: 580, canvasY: 330,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AndresP1&backgroundColor=ffb3b3',
  },
  {
    id: 'g1-4', treeId: TREE_ID, firstName: 'Andrés', lastName: 'Pérez',
    dateOfBirth: '1964-01-01', dateOfDeath: '1975-01-01',
    appleType: 'red', generation: -1, canvasX: 700, canvasY: 330,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AndresP2&backgroundColor=ffb3b3',
  },

  // Generation 0 (center / self)
  {
    id: 'g0-1', treeId: TREE_ID, firstName: 'Domme', lastName: 'López',
    dateOfBirth: '1892-01-01', dateOfDeath: '1973-01-01',
    appleType: 'red', generation: 0, canvasX: 270, canvasY: 460,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Domme&backgroundColor=ffb3b3',
  },
  {
    id: 'g0-2', treeId: TREE_ID, firstName: 'Margarita', lastName: 'López',
    dateOfBirth: '1899-01-01', dateOfDeath: '1972-01-01',
    appleType: 'red', generation: 0, canvasX: 430, canvasY: 460,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MargaritaRoot&backgroundColor=ffb3b3',
  },
  {
    id: 'g0-3', treeId: TREE_ID, firstName: 'Andrés', lastName: 'Pérez',
    dateOfBirth: '1888-01-01', dateOfDeath: '1972-01-01',
    appleType: 'red', generation: 0, canvasX: 580, canvasY: 460,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AndresRoot&backgroundColor=ffb3b3',
  },
  {
    id: 'g0-4', treeId: TREE_ID, firstName: 'Carloos', lastName: 'López',
    dateOfBirth: '1889-01-01', dateOfDeath: '1972-01-01',
    appleType: 'red', generation: 0, canvasX: 720, canvasY: 460,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CarloosRoot&backgroundColor=ffb3b3',
  },

  // Generation 1 (bottom / youngest ancestor shown)
  {
    id: 'g_bottom', treeId: TREE_ID, firstName: 'Andrés', lastName: 'Pérez',
    dateOfBirth: '1888-01-01', dateOfDeath: '1972-01-01',
    appleType: 'red', generation: 1, canvasX: 500, canvasY: 580,
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AndresBottom&backgroundColor=ffb3b3',
  },
]

export const DEMO_RELATIONSHIPS: Relationship[] = [
  // Spouse pairs (gen -3)
  { id: 'r1', treeId: TREE_ID, member1Id: 'g3-1', member2Id: 'g3-2', relationship: 'spouse', isActive: true },
  { id: 'r2', treeId: TREE_ID, member1Id: 'g3-3', member2Id: 'g3-4', relationship: 'spouse', isActive: true },

  // Parent → child connections (gen -3 to gen -2)
  { id: 'r3', treeId: TREE_ID, member1Id: 'g3-1', member2Id: 'g2-1', relationship: 'parent', isActive: true },
  { id: 'r4', treeId: TREE_ID, member1Id: 'g3-1', member2Id: 'g2-2', relationship: 'parent', isActive: true },
  { id: 'r5', treeId: TREE_ID, member1Id: 'g3-3', member2Id: 'g2-4', relationship: 'parent', isActive: true },
  { id: 'r6', treeId: TREE_ID, member1Id: 'g3-3', member2Id: 'g2-5', relationship: 'parent', isActive: true },

  // Gen -2 to gen -1
  { id: 'r7', treeId: TREE_ID, member1Id: 'g2-2', member2Id: 'g1-1', relationship: 'parent', isActive: true },
  { id: 'r8', treeId: TREE_ID, member1Id: 'g2-4', member2Id: 'g1-3', relationship: 'parent', isActive: true },

  // Gen -1 to gen 0
  { id: 'r9',  treeId: TREE_ID, member1Id: 'g1-1', member2Id: 'g0-1', relationship: 'parent', isActive: true },
  { id: 'r10', treeId: TREE_ID, member1Id: 'g1-3', member2Id: 'g0-3', relationship: 'parent', isActive: true },

  // Gen 0 to bottom
  { id: 'r11', treeId: TREE_ID, member1Id: 'g0-2', member2Id: 'g_bottom', relationship: 'parent', isActive: true },
  { id: 'r12', treeId: TREE_ID, member1Id: 'g0-3', member2Id: 'g_bottom', relationship: 'parent', isActive: true },
]

export const DEMO_FEED = [
  {
    id: 'f1', type: 'birthday', emoji: '🎂',
    title: "Birthday's Carlos Pérez.",
    time: '13 months ago',
    images: [],
  },
  {
    id: 'f2', type: 'anniversary', emoji: '🎊',
    title: "Birthday's Anniversary!",
    time: '12 months ago',
    images: [],
  },
  {
    id: 'f3', type: 'photo_upload', emoji: null,
    title: 'Recent photo album uploaded me!',
    time: '3 hours ago',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos&backgroundColor=ffb3b3',
    images: [
      'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=80&q=60',
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=80&q=60',
      'https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=80&q=60',
    ],
  },
  {
    id: 'f4', type: 'achievement', emoji: '🎓',
    title: "Carlos's Graduation!\nMaria's Trip Photos",
    time: '1 years ago',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria&backgroundColor=b3ffb3',
    images: [
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=80&q=60',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=80&q=60',
    ],
  },
  {
    id: 'f5', type: 'photo_upload', emoji: null,
    title: 'Recent photo album uploaded',
    time: '1 hours ago',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Papa&backgroundColor=ffb3b3',
    images: [],
  },
  {
    id: 'f6', type: 'achievement', emoji: '🎉',
    title: "Shared achievement posts\nCarlos's Graduation! 🎉",
    time: '3 hours ago',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Abuela&backgroundColor=b3ffb3',
    images: [],
  },
]
