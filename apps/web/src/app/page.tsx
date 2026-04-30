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
  const [activeTab, setActiveTab] = useState<string | null>('My Tree')
  const [viewFocus, setViewFocus] = useState<'all' | 'paternal' | 'maternal'>('all')
  const [isTermsOpen, setIsTermsOpen] = useState(false)

  // MOCK LOGIN STATE
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginInputUser, setLoginInputUser] = useState('')
  const [loginInputPass, setLoginInputPass] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tutorialStep, setTutorialStep] = useState(0)
  const [notificationCount, setNotificationCount] = useState(1)

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
        if (prev.members.length > 0 && mappedMembers.length > prev.members.length) {
          setNotificationCount(n => n + 1)
        }
        return { members: mappedMembers, relationships: mappedRels }
      })
    } catch (err) {
      console.error('Error fetching tree data:', err)
    } finally {
      setLoading(false)
    }
  }, [currentTreeId])

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
    if (loginInputUser.toLowerCase() === 'francisco' && loginInputPass === 'admin') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('currentUser', 'Francisco');
        const savedTreeId = window.localStorage.getItem('apple_user_tree_id');
        const skippedTutorial = window.localStorage.getItem('apple_tutorial_skipped') === 'true';
        
        if (savedTreeId) {
          setCurrentTreeId(savedTreeId);
          setTutorialStep(0);
        } else if (skippedTutorial) {
          setTutorialStep(0);
        } else {
          setTutorialStep(1);
        }
      } else {
        setTutorialStep(1);
      }
      setIsLoggedIn(true);
    } else {
      setLoginError('Credenciales incorrectas');
    }
  }

  if (!isLoggedIn) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B2E1B', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'url(/assets/image_19.png)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        
        <div style={{ zIndex: 10, backgroundColor: '#FAEFBC', padding: '50px', borderRadius: '32px', border: '3px solid #F2D241', width: '90%', maxWidth: '400px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', borderRadius: '50%', backgroundColor: '#8B4513', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '40px' }}>🍏</span>
          </div>
          <h1 style={{ fontFamily: 'serif', color: '#2C1810', margin: '0 0 10px', fontSize: '28px' }}>AppleTree Family</h1>
          <p style={{ color: '#8B4513', opacity: 0.8, marginBottom: '30px', fontWeight: 'bold', fontSize: '14px' }}>Acceso Privado Familiar</p>
          
          <input 
            type="text" 
            placeholder="Usuario" 
            value={loginInputUser}
            onChange={e => setLoginInputUser(e.target.value)}
            style={{ width: '100%', padding: '16px', marginBottom: '16px', borderRadius: '16px', border: '2px solid rgba(139,69,19,0.2)', outline: 'none', backgroundColor: '#FFF', fontSize: '15px', color: '#2C1810' }} 
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            value={loginInputPass}
            onChange={e => setLoginInputPass(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleLogin()
            }}
            style={{ width: '100%', padding: '16px', marginBottom: '8px', borderRadius: '16px', border: '2px solid rgba(139,69,19,0.2)', outline: 'none', backgroundColor: '#FFF', fontSize: '15px', color: '#2C1810' }} 
          />
          
          <div style={{ minHeight: '24px', marginBottom: '16px' }}>
            {loginError && <p style={{ color: '#B22222', fontSize: '13px', margin: 0, fontWeight: 'bold' }}>{loginError}</p>}
          </div>

          <button 
            onClick={handleLogin}
            style={{ width: '100%', padding: '16px', backgroundColor: '#8B4513', color: '#FAEFBC', borderRadius: '16px', border: 'none', fontSize: '16px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 8px 20px rgba(139,69,19,0.3)' }}
          >
            Entrar al Legado
          </button>
        </div>
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
      setNotificationCount(0)
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

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#1B2E1B', position: 'relative' }}>
      <Topbar 
        viewFocus={viewFocus} 
        onViewFocusChange={setViewFocus} 
        onAdd={() => {}} 
        notificationCount={notificationCount} 
        onClearNotifications={() => setNotificationCount(0)}
        onStartMyTree={handleStartMyTree}
        onShowTutorial={handleShowTutorial}
        onShowTerms={() => setIsTermsOpen(true)}
        userAvatarUrl={treeData.members.find(m => m.firstName.toLowerCase() === 'francisco')?.avatarUrl}
        showStartTreeBtn={currentTreeId === DEMO_TREE_ID}
      />

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
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        <div className="hide-on-mobile">
          <FeedPanel refreshTrigger={treeData.members.length} treeId={currentTreeId} />
        </div>
      </div>

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
          .main-layout { height: calc(100vh - 100px) !important; margin-top: 100px !important; }
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px) translate(-50%, -50%); }
          to { opacity: 1; transform: scale(1) translateY(0) translate(-50%, -50%); }
        }
      `}</style>
    </main>
  )
}
