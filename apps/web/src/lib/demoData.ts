import type { Member, Relationship } from './types'

export const DEMO_MEMBERS: Member[] = [
  // Generation 0: The Roots (Grandparents)
  {
    id: 'm1',
    treeId: 't1',
    firstName: 'Santos',
    lastName: 'López',
    dateOfBirth: '1910-05-12',
    dateOfDeath: '1995-11-20',
    gender: 'male',
    generation: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    appleType: 'red'
  },
  {
    id: 'm2',
    treeId: 't1',
    firstName: 'Margarita',
    lastName: 'García',
    dateOfBirth: '1915-08-22',
    dateOfDeath: '2005-04-10',
    gender: 'female',
    generation: 0,
    avatarUrl: 'https://images.unsplash.com/photo-1509783236416-c9ad59bae472?w=200&h=200&fit=crop',
    appleType: 'red'
  },

  // Generation 1: The Trunk (Parents)
  {
    id: 'm3',
    treeId: 't1',
    firstName: 'Andrés',
    lastName: 'Pérez',
    dateOfBirth: '1945-02-15',
    gender: 'male',
    generation: 1,
    parents: ['m1', 'm2'],
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    appleType: 'red'
  },
  {
    id: 'm4',
    treeId: 't1',
    firstName: 'Elena',
    lastName: 'López',
    dateOfBirth: '1948-11-30',
    gender: 'female',
    generation: 1,
    parents: ['m1', 'm2'],
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    appleType: 'red'
  },
  {
    id: 'm5',
    treeId: 't1',
    firstName: 'Carmen',
    lastName: 'Rodríguez',
    dateOfBirth: '1947-06-18',
    gender: 'female',
    generation: 1,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    appleType: 'green'
  },

  // Generation 2: The Branches (Siblings)
  {
    id: 'm6',
    treeId: 't1',
    firstName: 'Carlos',
    lastName: 'Pérez',
    dateOfBirth: '1975-09-12',
    gender: 'male',
    generation: 2,
    parents: ['m3', 'm5'],
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    appleType: 'red'
  },
  {
    id: 'm10', // NEW MEMBER: Carlos' Spouse
    treeId: 't1',
    firstName: 'Laura',
    lastName: 'Sánchez',
    dateOfBirth: '1978-04-15',
    gender: 'female',
    generation: 2,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    appleType: 'green'
  },
  {
    id: 'm7',
    treeId: 't1',
    firstName: 'Lucía',
    lastName: 'Pérez',
    dateOfBirth: '1980-03-22',
    gender: 'female',
    generation: 2,
    parents: ['m3', 'm5'],
    avatarUrl: 'https://images.unsplash.com/photo-1491349174775-aaafddd81942?w=100&h=100&fit=crop',
    appleType: 'red'
  },

  // Generation 3: The Leaves (Children)
  {
    id: 'm8',
    treeId: 't1',
    firstName: 'Mateo',
    lastName: 'Pérez',
    dateOfBirth: '2005-07-15',
    gender: 'male',
    generation: 3,
    parents: ['m6', 'm10'], // Now has both parents
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop',
    appleType: 'pink',
    isBaby: true
  },
  {
    id: 'm9',
    treeId: 't1',
    firstName: 'Camila',
    lastName: 'Pérez',
    dateOfBirth: '2008-12-05',
    gender: 'female',
    generation: 3,
    parents: ['m6', 'm10'], // Now has both parents
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
    appleType: 'pink'
  }
]

export const DEMO_RELATIONSHIPS: Relationship[] = [
  { id: 'r1', treeId: 't1', member1Id: 'm1', member2Id: 'm2', relationship: 'spouse', isActive: true },
  { id: 'r2', treeId: 't1', member1Id: 'm3', member2Id: 'm5', relationship: 'spouse', isActive: true },
  { id: 'r3', treeId: 't1', member1Id: 'm6', member2Id: 'm10', relationship: 'spouse', isActive: true } // NEW RELATIONSHIP
]
