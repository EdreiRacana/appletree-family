'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import FeedPanel from '@/components/FeedPanel'
import AddStoryModal from '@/components/AddStoryModal'
import TreeCanvas from '@/components/tree/TreeCanvas'
import MemberProfilePanel from '@/components/tree/MemberProfilePanel'
import EditMemberModal from '@/components/tree/EditMemberModal'
import InviteMemberModal from '@/components/tree/InviteMemberModal'
import PhotoAlbums from '@/components/PhotoAlbums'
import HomeDashboard from '@/components/HomeDashboard'
import { supabase } from '@/lib/supabase'
import type { Member, Relationship } from '@/lib/types'

// Build trigger: v4.1-professional-invites

export default function AppleTreeDashboard() {
  const [treeData, setTreeData] = useState<{ members: Member[], relationships: Relationship[] }>({
    members: [],
    relationships: []
  })
  const [loading, setLoading] = useState(true)
  const [bgOpacity, setBgOpacity] = useState(0.3)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [invitingMember, setInvitingMember] = useState<Member | null>(null)
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false)
  const [storyActor, setStoryActor] = useState<Member | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>('Home')
  const [viewFocus, setViewFocus] = useState<'all' | 'paternal' | 'maternal'>('all')
 
  // THE MASTER TREE ID CREATED IN THE SEED
  const TREE_ID = '00000000-0000-0000-0000-000000000001'

  const fetchFamilyData = React.useCallback(async () => {
    try {
      const { data: membersData, error: mError } = await supabase.from('members').select('*').eq('tree_id', TREE_ID)
      const { data: relsData, error: rError } = await supabase.from('relationships').select('*').eq('tree_id', TREE_ID)
      if (mError || rError) throw mError || rError

      const mappedMembers: Member[] = (membersData || []).map((m: any) => ({
        id: m.id,
        treeId: m.tree_id,
        firstName: m.first_name,
        lastName: m.last_name,
        maidenName: m.maiden_name,
        nickname: m.nickname,
        dateOfBirth: m.date_of_birth,
        dateOfDeath: m.date_of_death,
        gender: m.gender,
        appleType: m.apple_type,
        avatarUrl: m.avatar_url,
        generation: m.generation,
        parents: m.parents || [],
        spouses: m.spouses || [],
        isBaby: m.is_baby,
        biography: m.biography,
        occupation: m.occupation,
        birthPlace: m.birth_place
      }))

      const mappedRels: Relationship[] = (relsData || []).map((r: any) => ({
        id: r.id,
        treeId: r.tree_id,
        member1Id: r.member1_id,
        member2Id: r.member2_id,
        relationship: r.relationship,
        isActive: r.is_active
      }))

      setTreeData({ members: mappedMembers, relationships: mappedRels })
    } catch (err) {
      console.error('Error fetching tree data:', err)
    } finally {
      setLoading(false)
    }
  }, [TREE_ID])

  useEffect(() => {
    fetchFamilyData()
  }, [fetchFamilyData])

  // LINEAGE FILTERING LOGIC
  const { filteredMembers, filteredRelationships } = useMemo(() => {
    if (viewFocus === 'all' || treeData.members.length === 0) {
      return { filteredMembers: treeData.members, filteredRelationships: treeData.relationships }
    }

    const proband = [...treeData.members]
      .filter(m => m.parents && m.parents.length >= 2)
      .sort((a, b) => (b.generation || 0) - (a.generation || 0))[0] || treeData.members[0]

    if (!proband || !proband.parents || proband.parents.length === 0) {
      return { filteredMembers: treeData.members, filteredRelationships: treeData.relationships }
    }

    const fatherId = treeData.members.find(m => proband.parents?.includes(m.id) && m.gender === 'male')?.id
    const motherId = treeData.members.find(m => proband.parents?.includes(m.id) && m.gender === 'female')?.id

    const getLineage = (rootId: string) => {
      const lineageIds = new Set<string>([rootId, proband.id])
      const stack = [rootId]
      while (stack.length > 0) {
        const id = stack.pop()!
        const member = treeData.members.find(m => m.id === id)
        if (member?.parents) {
          member.parents.forEach(pId => {
            if (!lineageIds.has(pId)) {
              lineageIds.add(pId); stack.push(pId);
            }
          })
        }
      }
      return lineageIds
    }

    const targetId = viewFocus === 'paternal' ? fatherId : motherId
    if (!targetId) return { filteredMembers: treeData.members, filteredRelationships: treeData.relationships }

    const visibleIds = getLineage(targetId)
    const finalVisibleIds = new Set(visibleIds)
    treeData.members.forEach(m => {
      if (visibleIds.has(m.id)) {
        m.spouses?.forEach(sId => finalVisibleIds.add(sId))
      }
    })

    const members = treeData.members.filter(m => finalVisibleIds.has(m.id))
    const relationships = treeData.relationships.filter(r => 
      finalVisibleIds.has(r.member1Id) && finalVisibleIds.has(r.member2Id)
    )

    return { filteredMembers: members, filteredRelationships: relationships }
  }, [treeData, viewFocus])

  const handleSendInvite = (email: string, side: string, message: string) => {
    console.log('Invitation sent to:', email, 'for side:', side)
    // Here we would call the Supabase API to create the invitation record
    setInvitingMember(null)
  }

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#1B2E1B', position: 'relative' }}>
      <Topbar viewFocus={viewFocus} onViewFocusChange={setViewFocus} onAdd={() => {}} />

      <div className="main-layout" style={{ display: 'flex', width: '100%', height: 'calc(100vh - 140px)', marginTop: '140px', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {(filteredMembers.length > 0 || !loading) && (
            <TreeCanvas 
              members={filteredMembers} 
              relationships={filteredRelationships} 
              onRefresh={fetchFamilyData}
              onViewProfile={setSelectedMember}
              onEditMember={setEditingMember}
              onAddStory={(m) => { setStoryActor(m); setIsStoryModalOpen(true); }}
              bgOpacity={bgOpacity}
            />
          )}

          {activeTab === 'Home' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
              <HomeDashboard members={filteredMembers} onViewTree={() => setActiveTab('My Tree')} />
            </div>
          )}

          {activeTab === 'Photo Albums' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
              <PhotoAlbums />
            </div>
          )}
        </div>

        <MemberProfilePanel 
          member={selectedMember} 
          onClose={() => setSelectedMember(null)} 
          onEdit={(m) => { setEditingMember(m); setSelectedMember(null); }}
          onInvite={(m) => { setInvitingMember(m); setSelectedMember(null); }}
        />

        {editingMember && <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} onSave={fetchFamilyData} />}
        
        {invitingMember && (
          <InviteMemberModal 
            member={invitingMember} 
            onClose={() => setInvitingMember(null)} 
            onSend={handleSendInvite} 
          />
        )}

        {isStoryModalOpen && <AddStoryModal treeId={TREE_ID} onClose={() => { setIsStoryModalOpen(false); setStoryActor(null); }} onSave={fetchFamilyData} />}

        {loading && treeData.members.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(242,210,65,0.1)', borderTopColor: '#F2D241', borderRadius: '50%' }} />
          </div>
        )}

        <div className="hide-on-mobile">
          <Sidebar 
            bgOpacity={bgOpacity} 
            onOpacityChange={setBgOpacity} 
            members={treeData.members}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        <div className="hide-on-mobile">
          <FeedPanel />
        </div>
      </div>

      <style jsx global>{`
        body { margin: 0; padding: 0; background-color: #1B2E1B; overflow: hidden; }
        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
          .main-layout { height: calc(100vh - 100px) !important; margin-top: 100px !important; }
        }
      `}</style>
    </main>
  )
}
