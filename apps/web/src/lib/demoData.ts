import type { Member, Relationship } from './types'

export const DEMO_MEMBERS: Member[] = [
  // Generation 0: Parents (El Tronco)
  {
    id: 'm1',
    treeId: 't1',
    firstName: 'Tu Papá',
    lastName: '(Apellidos)',
    gender: 'male',
    generation: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    appleType: 'red'
  },
  {
    id: 'm2',
    treeId: 't1',
    firstName: 'Primera Esposa',
    lastName: '(Fallecida)',
    dateOfDeath: '2000-01-01', // Marca como fallecida
    gender: 'female',
    generation: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    appleType: 'red'
  },
  {
    id: 'm3',
    treeId: 't1',
    firstName: 'Tu Mamá',
    lastName: '(Apellidos)',
    gender: 'female',
    generation: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop',
    appleType: 'red'
  },

  // Generation 1: Children (Las Ramas)
  // Hijos del Primer Matrimonio (Tus medios hermanos)
  {
    id: 'm4',
    treeId: 't1',
    firstName: 'Medio Hermano',
    lastName: '(Mayor)',
    gender: 'male',
    generation: 1,
    parents: ['m1', 'm2'], // Hijo de Papá y Primera Esposa
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    appleType: 'green'
  },
  {
    id: 'm5',
    treeId: 't1',
    firstName: 'Media Hermana',
    lastName: '(Mayor)',
    gender: 'female',
    generation: 1,
    parents: ['m1', 'm2'], // Hijo de Papá y Primera Esposa
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    appleType: 'green'
  },

  // Hijos del Segundo Matrimonio (Ustedes)
  {
    id: 'm6',
    treeId: 't1',
    firstName: 'Edrei',
    lastName: '(Tú)',
    gender: 'male',
    generation: 1,
    parents: ['m1', 'm3'], // Hijo de Papá y Tu Mamá
    avatarUrl: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=100&h=100&fit=crop',
    appleType: 'pink'
  },
  {
    id: 'm7',
    treeId: 't1',
    firstName: 'Tu Hermano',
    lastName: '(Menor)',
    gender: 'male',
    generation: 1,
    parents: ['m1', 'm3'], // Hijo de Papá y Tu Mamá
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop',
    appleType: 'pink'
  }
]

export const DEMO_RELATIONSHIPS: Relationship[] = [
  // Dos matrimonios para el mismo papá
  { id: 'r1', treeId: 't1', member1Id: 'm1', member2Id: 'm2', relationship: 'spouse', isActive: false }, // Primer matrimonio
  { id: 'r2', treeId: 't1', member1Id: 'm1', member2Id: 'm3', relationship: 'spouse', isActive: true }  // Segundo matrimonio
]
