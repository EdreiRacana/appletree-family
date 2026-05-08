// AppleTree Family — TypeScript Types
// Mirrors the Supabase database schema

export type AppleType = 'red' | 'green' | 'pink'

export type PrivacyLevel = 'private' | 'core' | 'extended' | 'public'

export type RelationshipType =
  | 'parent' | 'child' | 'spouse' | 'sibling'
  | 'grandparent' | 'grandchild' | 'uncle_aunt'
  | 'nephew_niece' | 'cousin' | 'step_parent'
  | 'step_child' | 'adoptive_parent' | 'adopted_child'
  | 'other'

export interface Member {
  id: string
  treeId: string
  userId?: string | null

  firstName: string
  lastName: string
  maidenName?: string | null
  nickname?: string | null

  dateOfBirth?: string | null   // ISO date string
  dateOfDeath?: string | null
  birthPlace?: string | null
  gender?: 'male' | 'female' | 'other' | null

  appleType: AppleType
  avatarUrl?: string | null
  avatarCloudinaryId?: string | null
  isBaby?: boolean              // Manual privacy toggle or computed from age

  canvasX?: number
  canvasY?: number
  generation?: number
  
  parents?: string[]             // Parent IDs
  spouses?: string[]            // Spouse IDs

  memberPrivacy?: PrivacyLevel
  biography?: string | null
  occupation?: string | null
}

export interface Relationship {
  id: string
  treeId: string
  member1Id: string
  member2Id: string
  relationship: RelationshipType
  startDate?: string | null
  endDate?: string | null
  isActive: boolean
}

export interface Tree {
  id: string
  ownerId: string
  name: string
  description?: string | null
  coverImageUrl?: string | null
  defaultPrivacy: PrivacyLevel
  isPublicLegacy: boolean
  memberCount: number
  createdAt: string
}

export interface User {
  id: string
  username?: string | null
  fullName?: string | null
  email: string
  avatarUrl?: string | null
  cloudinaryId?: string | null
  bio?: string | null
  dateOfBirth?: string | null
  isVerified: boolean
  isActive: boolean
}

export interface FeedActivity {
  id: string
  treeId: string
  actorUserId?: string | null
  actorMemberId?: string | null
  activityType: 'birthday' | 'anniversary' | 'achievement' | 'greeting' | 'photo_upload' | 'new_member' | 'memorial'
  title: string
  description?: string | null
  imageUrl?: string | null
  metadata?: Record<string, unknown>
  privacy: PrivacyLevel
  createdAt: string
}

export type FamilyEventType = 'birthday' | 'anniversary' | 'memorial' | 'reunion' | 'custom'

export interface FamilyEvent {
  id: string
  treeId: string
  title: string
  description?: string | null
  eventType: FamilyEventType
  eventDate: string   // ISO date string (YYYY-MM-DD)
  memberId?: string | null
  imageUrl?: string | null
  privacy: PrivacyLevel
  createdAt?: string
}
