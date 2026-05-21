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
import TermsModal from '@/components/TermsModal'
import MobileBottomSheet from '@/components/MobileBottomSheet'
import MobileBottomNav from '@/components/MobileBottomNav'
import MobileLayout from '@/components/MobileLayout'
import { supabase } from '@/lib/supabase'
import type { Member, Relationship } from '@/lib/types'
import { useNotifications } from '@/lib/useNotifications'

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
  const [activeTab, setActiveTab] = useState<string | null>('My Tree')
  const [mobileActiveTab, setMobileActiveTab] = useState<string>('My Tree')
  const [mobileSheetMember, setMobileSheetMember] = useState<Member | null>(null)
  const [viewFocus, setViewFocus] = useState<'all' | 'paternal' | 'maternal'>('all')
  const [isTermsOpen, setIsTermsOpen] = useState(false)


  // MOCK LOGIN STATE
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginInputUser, setLoginInputUser] = useState('')
  const [loginInputPass, setLoginInputPass] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tutorialStep, setTutorialStep] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // THE MASTER TREE ID (DEMO)
  const DEMO_TREE_ID = '00000000-0000-0000-0000-000000000001'
  const [currentTreeId, setCurrentTreeId] = useState<string>(DEMO_TREE_ID)

  const fetchFamilyData = React.useCallback(async () => {
    try {
      const { data: membersData, error: mError } = await supabase.from('members').select('*').eq('tree_id', currentTreeId)
      const { data: relsData, error: rError } = await supabase.from('relationships').select('*').eq('tree_id', currentTreeId)
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

      setTreeData(prev => {
        return { members: mappedMembers, relationships: mappedRels }
      })
    } catch (err) {
      console.error('Error fetching tree data:', err)
    } finally {
      setLoading(false)
    }
  }, [currentTreeId])

  // Real notification system
  const { notifications, unreadCount, markAllRead } = useNotifications(currentTreeId, treeData.members)

  // Handle bell click navigation
  const handleNotificationClick = (action: 'open_events' | 'open_stories') => {
    if (action === 'open_events') setActiveTab('Events')
    else if (action === 'open_stories') {
      // FeedPanel is always visible; just scroll it into view (it's fixed on the right)
      // We mark all as read and let the user see Family Stories
      setActiveTab(null)
    }
    markAllRead()
  }

  useEffect(() => {
    fetchFamilyData()
  }, [fetchFamilyData])

  // CRITICAL AUTO-RECOVERY: Restore Francisco's 24-member tree if it was accidentally overwritten
  useEffect(() => {
    if (typeof window !== 'undefined' && isLoggedIn) {
      const goodTreeId = '4508d01c-2cdf-43eb-80d5-2d0d40989c63';
      const currentLocal = window.localStorage.getItem('apple_user_tree_id');
      if (currentLocal && currentLocal !== goodTreeId && currentLocal !== DEMO_TREE_ID && loginInputUser.toLowerCase() === 'francisco') {
        window.localStorage.setItem('apple_user_tree_id', goodTreeId);
        setCurrentTreeId(goodTreeId);
      }
    }
  }, [isLoggedIn, loginInputUser])
  // Derive the logged-in user's avatar from the already-loaded tree members
  // (same source used by the apple nodes — no extra DB query needed)
  const userProfileAvatar = React.useMemo(() => {
    if (!isLoggedIn || treeData.members.length === 0) return null
    const name = loginInputUser.toLowerCase()
    const match = treeData.members.find(
      m => m.avatarUrl && m.firstName.toLowerCase().includes(name)
    )
    return match?.avatarUrl ?? null
  }, [isLoggedIn, loginInputUser, treeData.members])
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
    setInvitingMember(null)
  }

  const handleLogin = () => {
    // ── Family user registry ──────────────────────────────────────────────────
    // To add a new member: { password, fullName, treeId (optional) }
    // If treeId is set → user lands directly on that tree (no tutorial).
    // If treeId is omitted → uses Francisco's localStorage flow (admin).
    const FRANCISCO_TREE_ID = '4508d01c-2cdf-43eb-80d5-2d0d40989c63'
    const FAMILY_USERS: Record<string, { password: string; fullName: string; treeId?: string }> = {
      'francisco': { password: 'admin', fullName: 'Francisco' },
      'eber':      { password: 'admin', fullName: 'Eber',  treeId: FRANCISCO_TREE_ID },
    }
    // ─────────────────────────────────────────────────────────────────────────

    const key = loginInputUser.toLowerCase().trim()
    const matched = FAMILY_USERS[key]

    if (matched && loginInputPass === matched.password) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('currentUser', matched.fullName)

        if (matched.treeId) {
          // Guest family member → go straight to the family tree, skip tutorial
          window.localStorage.setItem('apple_user_tree_id', matched.treeId)
          window.localStorage.setItem('apple_tutorial_skipped', 'true')
          setCurrentTreeId(matched.treeId)
          setTutorialStep(0)
        } else {
          // Francisco (admin) → original flow with tutorial & localStorage
          const savedTreeId = window.localStorage.getItem('apple_user_tree_id')
          const skippedTutorial = window.localStorage.getItem('apple_tutorial_skipped') === 'true'
          if (savedTreeId) {
            setCurrentTreeId(savedTreeId)
            setTutorialStep(0)
          } else if (skippedTutorial) {
            setTutorialStep(0)
          } else {
            setTutorialStep(1)
          }
        }
      } else {
        setTutorialStep(1)
      }
      setIsLoggedIn(true)
    } else {
      setLoginError('Credenciales incorrectas')
    }
  }

  if (!isLoggedIn) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'radial-gradient(circle at center, #2D5016 0%, #1B2E1B 100%)', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Image with Overlay */}
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          opacity: 0.15, 
          backgroundImage: 'url(/assets/arbol-base.png)', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          filter: 'blur(2px)'
        }} />
        
        {/* Animated Orbs for Depth */}
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: '300px', height: '300px', background: 'rgba(212, 130, 42, 0.1)', filter: 'blur(100px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: '400px', height: '400px', background: 'rgba(74, 124, 47, 0.15)', filter: 'blur(120px)', borderRadius: '50%' }} />

        <div style={{ 
          zIndex: 10, 
          backgroundColor: 'rgba(15, 26, 15, 0.9)', 
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '60px 40px', 
          borderRadius: '40px', 
          border: '1px solid rgba(212, 175, 55, 0.3)', 
          width: '90%', 
          maxWidth: '420px', 
          boxShadow: '0 40px 100px rgba(0,0,0,0.6), inset 0 0 20px rgba(212, 175, 55, 0.05)', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ 
            width: '120px', 
            height: '120px', 
            marginBottom: '24px', 
            filter: 'drop-shadow(0 0 15px rgba(212, 175, 55, 0.4))',
            transition: 'transform 0.3s ease'
          }} className="hover:scale-105">
            <img src="/assets/logo.png" alt="AppleTree Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            background: 'linear-gradient(180deg, #F5E6C8 0%, #D4AF37 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 8px', 
            fontSize: '38px',
            fontWeight: '900',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
          }}>AppleFamily Tree</h1>
          
          <p style={{ 
            color: '#D4AF37', 
            opacity: 0.8, 
            marginBottom: '40px', 
            fontWeight: '600', 
            fontSize: '13px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase'
          }}>Acceso Privado Familiar</p>
          
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Usuario" 
                value={loginInputUser}
                onChange={e => setLoginInputUser(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '18px 24px', 
                  borderRadius: '20px', 
                  border: '1.5px solid rgba(212, 175, 55, 0.2)', 
                  outline: 'none', 
                  backgroundColor: 'rgba(255,255,255,0.05)', 
                  fontSize: '16px', 
                  color: '#F5E6C8',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }} 
                className="focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF371A]"
              />
            </div>

            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                placeholder="Contraseña" 
                value={loginInputPass}
                onChange={e => setLoginInputPass(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleLogin()
                }}
                style={{ 
                  width: '100%', 
                  padding: '18px 24px', 
                  borderRadius: '20px', 
                  border: '1.5px solid rgba(212, 175, 55, 0.2)', 
                  outline: 'none', 
                  backgroundColor: 'rgba(255,255,255,0.05)', 
                  fontSize: '16px', 
                  color: '#F5E6C8',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }} 
                className="focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF371A]"
              />
            </div>
          </div>
          
          <div style={{ minHeight: '28px', marginTop: '12px', marginBottom: '12px' }}>
            {loginError && (
              <p style={{ 
                color: '#FF6B6B', 
                fontSize: '14px', 
                margin: 0, 
                fontWeight: '600',
                animation: 'shake 0.4s ease-in-out'
              }}>
                {loginError}
              </p>
            )}
          </div>

          <button 
            onClick={handleLogin}
            style={{ 
              width: '100%', 
              padding: '18px', 
              background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)', 
              color: '#0F1A0F', 
              borderRadius: '20px', 
              border: 'none', 
              fontSize: '17px', 
              fontWeight: '900', 
              cursor: 'pointer', 
              boxShadow: '0 12px 24px rgba(212, 175, 55, 0.3)',
              transition: 'all 0.3s ease',
              marginTop: '10px'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 15px 30px rgba(212, 175, 55, 0.5)'
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(212, 175, 55, 0.3)'
            }}
          >
            Entrar al Legado
          </button>
          
          <p style={{ marginTop: '30px', fontSize: '12px', color: '#F5E6C8', opacity: 0.4 }}>
            &copy; 2025 AppleTree Family Legacy. Todos los derechos reservados.
          </p>
        </div>

        <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          input:focus {
            border-color: #D4822A !important;
            box-shadow: 0 0 0 4px rgba(212, 130, 42, 0.1) !important;
          }
        `}</style>
      </div>
    )
  }

  const handleStartMyTree = async () => {
    try {
      if (typeof window !== 'undefined') {
        const existingTreeId = window.localStorage.getItem('apple_user_tree_id')
        if (existingTreeId && existingTreeId !== DEMO_TREE_ID) {
          // If the user already has a tree, just load it
          setCurrentTreeId(existingTreeId)
          setTutorialStep(0)
          return
        }
      }

      const newTreeId = crypto.randomUUID()
      
      // 1. Create the tree first (required for foreign key constraint)
      const { error: treeError } = await supabase.from('trees').insert({
        id: newTreeId,
        name: `Árbol de ${loginInputUser || 'Francisco'}`
      })
      if (treeError) throw treeError

      // 2. Create first member for this tree (removed invalid 'is_baby' column)
      const { data: newMember, error } = await supabase.from('members').insert({
        tree_id: newTreeId,
        first_name: loginInputUser || 'Francisco',
        last_name: '',
        generation: 0,
        gender: 'male'
      }).select().single()

      if (error) throw error

      // Also log activity
      await supabase.from('activities').insert({
        tree_id: newTreeId,
        type: 'member_added',
        title: 'Árbol Creado',
        description: `${loginInputUser || 'Francisco'} ha comenzado su árbol genealógico.`,
        privacy: 'family'
      })

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('apple_user_tree_id', newTreeId)
        window.localStorage.setItem('apple_tutorial_skipped', 'true')
      }

      setCurrentTreeId(newTreeId)
      setTutorialStep(0)
    } catch (err) {
      console.error('Error starting new tree:', err)
      alert('Error al crear tu árbol: Verifica tu conexión a internet.')
    }
  }

  const handleShowTutorial = () => {
    // Save current tree if it's not the demo tree before switching
    if (currentTreeId !== DEMO_TREE_ID && typeof window !== 'undefined') {
      window.localStorage.setItem('apple_user_tree_id', currentTreeId)
    }
    setCurrentTreeId(DEMO_TREE_ID)
    setTutorialStep(1)
  }

  const handleReturnToMyTree = () => {
    if (typeof window !== 'undefined') {
      const savedTreeId = window.localStorage.getItem('apple_user_tree_id')
      if (savedTreeId) {
        setCurrentTreeId(savedTreeId)
      }
    }
    setTutorialStep(0)
  }

  if (isMobile) {
    return (
      <MobileLayout 
        members={treeData.members}
        relationships={treeData.relationships}
        activeTab={mobileActiveTab}
        onTabChange={setMobileActiveTab}
        currentUser={loginInputUser}
        currentTreeId={currentTreeId}
        onViewProfile={(m) => setMobileSheetMember(m)}
        onEditMember={(m) => setEditingMember(m)}
        onAddMember={(m) => window.dispatchEvent(new CustomEvent('open-add-modal', { detail: m }))}
        onDeleteMember={async (m) => {
          if (!window.confirm(`¿Eliminar a ${m.firstName} ${m.lastName}? Esta acción no se puede deshacer.`)) return
          try {
            await supabase.from('relationships').delete().or(`member1_id.eq.${m.id},member2_id.eq.${m.id}`)
            await supabase.from('members').delete().eq('id', m.id)
            fetchFamilyData()
          } catch { /* ignored */ }
        }}
        onAddStory={(m) => { setStoryActor(m); setIsStoryModalOpen(true); }}
      />
    )
  }

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#1B2E1B', position: 'relative' }}>
      <Topbar 
        viewFocus={viewFocus} 
        onViewFocusChange={setViewFocus} 
        onAdd={() => {}} 
        notificationCount={unreadCount}
        notifications={notifications}
        onClearNotifications={markAllRead}
        onNotificationClick={handleNotificationClick}
        onStartMyTree={handleStartMyTree}
        onShowTutorial={handleShowTutorial}
        onShowTerms={() => setIsTermsOpen(true)}
        userAvatarUrl={userProfileAvatar}
        showStartTreeBtn={currentTreeId === DEMO_TREE_ID}
      />

      <div className="main-layout" style={{ display: 'flex', width: '100%', height: 'calc(100vh - 140px)', marginTop: '140px', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {(filteredMembers.length > 0 || !loading) && (
            <TreeCanvas 
              members={filteredMembers} 
              relationships={filteredRelationships} 
              onRefresh={fetchFamilyData}
              onViewProfile={(m) => {
                // Mobile: open bottom sheet. Desktop: open side panel.
                const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
                if (isMobile) {
                  setMobileSheetMember(m)
                } else {
                  setSelectedMember(m)
                }
              }}
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
              <PhotoAlbums treeId={currentTreeId} />
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

        {isStoryModalOpen && <AddStoryModal treeId={currentTreeId} onClose={() => { setIsStoryModalOpen(false); setStoryActor(null); }} onSave={fetchFamilyData} />}

        {isTermsOpen && <TermsModal onClose={() => setIsTermsOpen(false)} />}

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
            treeId={currentTreeId}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onInviteMember={(m) => { setInvitingMember(m); setActiveTab(null); }}
          />
        </div>

        <div className="hide-on-mobile">
          <FeedPanel refreshTrigger={treeData.members.length} treeId={currentTreeId} />
        </div>
      </div>

      {/* ── MOBILE BOTTOM SHEET ───────────────────────────────────────── */}
      <MobileBottomSheet
        member={mobileSheetMember}
        focusMember={mobileSheetMember}
        onClose={() => setMobileSheetMember(null)}
        onEdit={(m) => { setEditingMember(m); setMobileSheetMember(null); }}
        onAdd={(m) => { window.dispatchEvent(new CustomEvent('open-add-modal', { detail: m })); setMobileSheetMember(null); }}
        onDelete={async (m) => {
          if (!window.confirm(`¿Eliminar a ${m.firstName} ${m.lastName}? Esta acción no se puede deshacer.`)) return
          try {
            await (await import('@/lib/supabase')).supabase
              .from('relationships').delete()
              .or(`member1_id.eq.${m.id},member2_id.eq.${m.id}`)
            await (await import('@/lib/supabase')).supabase
              .from('members').delete().eq('id', m.id)
            fetchFamilyData()
          } catch { /* handled by TreeCanvas */ }
          setMobileSheetMember(null)
        }}
        onViewProfile={(m) => { setSelectedMember(m); setMobileSheetMember(null); }}
        onAddStory={(m) => { setStoryActor(m); setIsStoryModalOpen(true); setMobileSheetMember(null); }}
      />

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────── */}
      <MobileBottomNav
        activeTab={mobileActiveTab}
        onTabChange={(tab) => {
          setMobileActiveTab(tab)
          // Mirror to desktop tab system where applicable
          if (tab === 'My Tree' || tab === 'Home' || tab === 'Photo Albums') {
            setActiveTab(tab)
          } else {
            setActiveTab(null)
          }
        }}
      />

        {/* TUTORIAL OVERLAY */}
        {tutorialStep > 0 && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', transition: 'all 0.5s' }} />
            
            {tutorialStep === 1 && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'auto', backgroundColor: '#FAEFBC', padding: '30px', borderRadius: '24px', border: '3px solid #D4822A', width: '350px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'modalFadeIn 0.4s ease-out' }}>
                <h3 style={{ margin: '0 0 10px', color: '#8B4513', fontFamily: 'serif', fontSize: '22px' }}>🌳 Bienvenido al Legado</h3>
                <p style={{ margin: '0 0 20px', color: '#2C1810', fontSize: '14px', lineHeight: '1.5' }}>Estás viendo el Árbol Genealógico de la Familia Pérez. Aquí es donde la historia cobra vida.</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setTutorialStep(0)} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid #D4822A', borderRadius: '10px', color: '#8B4513', fontWeight: 'bold', cursor: 'pointer' }}>Omitir</button>
                  <button onClick={() => setTutorialStep(2)} style={{ flex: 2, padding: '10px', backgroundColor: '#D4822A', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Siguiente</button>
                </div>
              </div>
            )}

            {tutorialStep === 2 && (
              <div style={{ position: 'absolute', top: '150px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', backgroundColor: '#FAEFBC', padding: '25px', borderRadius: '24px', border: '3px solid #D4822A', width: '380px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'modalFadeIn 0.4s ease-out' }}>
                <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', width: '0', height: '0', borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderBottom: '15px solid #D4822A' }} />
                <h3 style={{ margin: '0 0 10px', color: '#8B4513', fontFamily: 'serif', fontSize: '20px' }}>🔍 Herramientas de Control</h3>
                <p style={{ margin: '0 0 20px', color: '#2C1810', fontSize: '14px', lineHeight: '1.5' }}>Usa la barra superior para buscar familiares o filtrar el árbol por línea **Paterna** o **Materna** instantáneamente.</p>
                <button onClick={() => setTutorialStep(3)} style={{ padding: '12px 24px', backgroundColor: '#D4822A', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Entendido</button>
              </div>
            )}

            {tutorialStep === 3 && (
              <div style={{ position: 'absolute', top: '50%', left: '120px', transform: 'translateY(-50%)', pointerEvents: 'auto', backgroundColor: '#FAEFBC', padding: '25px', borderRadius: '24px', border: '3px solid #D4822A', width: '300px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'modalFadeIn 0.4s ease-out' }}>
                <div style={{ position: 'absolute', left: '-15px', top: '50%', transform: 'translateY(-50%)', width: '0', height: '0', borderTop: '15px solid transparent', borderBottom: '15px solid transparent', borderRight: '15px solid #D4822A' }} />
                <h3 style={{ margin: '0 0 10px', color: '#8B4513', fontFamily: 'serif', fontSize: '20px' }}>🧭 Navegación</h3>
                <p style={{ margin: '0 0 20px', color: '#2C1810', fontSize: '14px', lineHeight: '1.5' }}>Accede a tus **Álbumes de Fotos**, eventos de la red y ajustes personales desde la barra lateral izquierda.</p>
                <button onClick={() => setTutorialStep(4)} style={{ padding: '12px 24px', backgroundColor: '#D4822A', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Siguiente</button>
              </div>
            )}

            {tutorialStep === 4 && (
              <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', backgroundColor: '#FAEFBC', padding: '25px', borderRadius: '24px', border: '3px solid #D4822A', width: '380px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'modalFadeIn 0.4s ease-out' }}>
                <h3 style={{ margin: '0 0 10px', color: '#8B4513', fontFamily: 'serif', fontSize: '20px' }}>➕ Expandir tu Árbol</h3>
                <p style={{ margin: '0 0 20px', color: '#2C1810', fontSize: '14px', lineHeight: '1.5' }}>Pasa el mouse sobre cualquier **Manzana** para revelar el botón **(+)**. Ahí podrás añadir hijos, padres o parejas con un solo clic.</p>
                <button onClick={() => setTutorialStep(5)} style={{ padding: '12px 24px', backgroundColor: '#D4822A', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>¡Genial!</button>
              </div>
            )}

            {tutorialStep === 5 && (
              <div style={{ position: 'absolute', top: '250px', right: '350px', pointerEvents: 'auto', backgroundColor: '#FAEFBC', padding: '30px', borderRadius: '24px', border: '3px solid #D4822A', width: '320px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'modalFadeIn 0.4s ease-out' }}>
                <div style={{ position: 'absolute', right: '-15px', top: '30px', width: '0', height: '0', borderTop: '15px solid transparent', borderBottom: '15px solid transparent', borderLeft: '15px solid #D4822A' }} />
                <h3 style={{ margin: '0 0 10px', color: '#8B4513', fontFamily: 'serif', fontSize: '20px' }}>🔔 Actividad</h3>
                <p style={{ margin: '0 0 20px', color: '#2C1810', fontSize: '14px', lineHeight: '1.5' }}>Mira las últimas actualizaciones de la familia y fotos nuevas en este panel lateral en tiempo real.</p>
                <button onClick={() => setTutorialStep(6)} style={{ padding: '12px 24px', backgroundColor: '#D4822A', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Último paso</button>
              </div>
            )}

            {tutorialStep === 6 && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'auto', backgroundColor: '#FAEFBC', padding: '30px', borderRadius: '24px', border: '3px solid #D4822A', width: '400px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'modalFadeIn 0.4s ease-out' }}>
                <h3 style={{ margin: '0 0 10px', color: '#8B4513', fontFamily: 'serif', fontSize: '22px' }}>🚀 Tu Turno</h3>
                <p style={{ margin: '0 0 20px', color: '#2C1810', fontSize: '14px', lineHeight: '1.5' }}>Puedes seguir explorando este ejemplo o regresar a tu árbol personal para continuar construyendo tu propio legado.</p>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  {typeof window !== 'undefined' && window.localStorage.getItem('apple_user_tree_id') ? (
                    <button onClick={handleReturnToMyTree} style={{ padding: '14px', backgroundColor: '#D4AF37', color: '#0F1A0F', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)' }}>✨ Volver a Mi Árbol</button>
                  ) : (
                    <button onClick={handleStartMyTree} style={{ padding: '14px', backgroundColor: '#D4AF37', color: '#0F1A0F', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)' }}>✨ Empezar Mi Propio Árbol</button>
                  )}
                  <button onClick={() => setTutorialStep(0)} style={{ padding: '12px', backgroundColor: 'transparent', color: '#8B4513', border: '2px solid #D4822A', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Explorar Ejemplo</button>
                  <button 
                    onClick={() => {
                      if (typeof window !== 'undefined') window.localStorage.setItem('apple_tutorial_skipped', 'true')
                      setTutorialStep(0)
                    }} 
                    style={{ background: 'none', border: 'none', color: '#D4822A', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px', marginTop: '5px' }}
                  >
                    No mostrar de nuevo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      <style jsx global>{`
        body { margin: 0; padding: 0; background-color: #1B2E1B; overflow: hidden; }
        @media (max-width: 768px) {
          .hide-on-mobile { display: none !important; }
          .main-layout {
            height: calc(100vh - 60px - 64px) !important;
            margin-top: 60px !important;
          }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px) translate(-50%, -50%); }
          to { opacity: 1; transform: scale(1) translateY(0) translate(-50%, -50%); }
        }
      `}</style>
    </main>
  )
}
