'use client'

import React, { useEffect, useState } from 'react'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import FeedPanel from '@/components/FeedPanel'
import TreeCanvas from '@/components/tree/TreeCanvas'
import { supabase } from '@/lib/supabase'
import type { Member, Relationship } from '@/lib/types'

export default function AppleTreeDashboard() {
  const [treeData, setTreeData] = useState<{ members: Member[], relationships: Relationship[] }>({
    members: [],
    relationships: []
  })
  const [loading, setLoading] = useState(true)

  // THE MASTER TREE ID CREATED IN THE SEED
  const TREE_ID = '00000000-0000-0000-0000-000000000001'

  const fetchFamilyData = React.useCallback(async () => {
    try {
      // 1. Fetch Members
      const { data: membersData, error: mError } = await supabase
        .from('members')
        .select('*')
        .eq('tree_id', TREE_ID)

      // 2. Fetch Relationships
      const { data: relsData, error: rError } = await supabase
        .from('relationships')
        .select('*')
        .eq('tree_id', TREE_ID)

      if (mError || rError) throw mError || rError

      // 3. Map snake_case (DB) to camelCase (Frontend Types)
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
        occupation: m.occupation
      }))

      // CRITICAL FIX: Map relationships too!
      const mappedRels: Relationship[] = (relsData || []).map((r: any) => ({
        id: r.id,
        treeId: r.tree_id,
        member1Id: r.member1_id,
        member2Id: r.member2_id,
        relationship: r.relationship,
        isActive: r.is_active
      }))

      setTreeData({
        members: mappedMembers,
        relationships: mappedRels
      })
    } catch (err) {
      console.error('Error fetching tree data:', err)
    } finally {
      setLoading(false)
    }
  }, [TREE_ID])

  useEffect(() => {
    fetchFamilyData()
  }, [fetchFamilyData])

  return (
    <main style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden',
      backgroundColor: '#1B2E1B', 
      position: 'relative' 
    }}>
      {/* 1. Global Navigation Bar */}
      <Topbar />

      {/* 2. Main Workspace Layout */}
      <div style={{ 
        display: 'flex', 
        width: '100%', 
        height: 'calc(100vh - 140px)', 
        marginTop: '140px',
        position: 'relative'
      }}>
        {/* Genealogy Tree Layer (Interactive Canvas) */}
        {/* We keep it mounted to preserve camera position during refreshes */}
        {(treeData.members.length > 0 || !loading) && (
          <TreeCanvas 
            members={treeData.members} 
            relationships={treeData.relationships} 
            onRefresh={fetchFamilyData}
          />
        )}

        {/* Loading Spinner only for INITIAL load to avoid jumps */}
        {loading && treeData.members.length === 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}>
            <div className="animate-spin" style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(242,210,65,0.1)',
              borderTopColor: '#F2D241',
              borderRadius: '50%'
            }} />
          </div>
        )}

        {/* Sidebar Navigation Rail & Floating Panels (Left Overlay) */}
        <Sidebar />

        {/* Dynamic Social Feed / Events (Right Overlay) */}
        <FeedPanel />
      </div>

      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          background-color: #1B2E1B;
          overflow: hidden;
        }
        @keyframes slideIn {
          from { transform: translateX(-30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .topbar-btn {
          transition: all 0.2s ease;
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
        }
        .topbar-btn:hover {
          background-color: rgba(255,255,255,0.2) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </main>
  )
}
