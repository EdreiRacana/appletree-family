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
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
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


  // MOCK LOGIN STATE (legacy hardcoded family users — kept as fallback)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginInputUser, setLoginInputUser] = useState('')
  const [loginInputPass, setLoginInputPass] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tutorialStep, setTutorialStep] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  // ── REAL AUTH (Supabase Auth) ──────────────────────────────────
  const [session, setSession] = useState<Session | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [showLegacyLogin, setShowLegacyLogin] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Detección de token de invitación en la URL ──────────────────
  // Si el usuario llegó desde un correo de invitación, la URL trae
  // ?invite=<token>. Lo guardamos en localStorage y pre-llenamos el email
  // del signup con el email al que se le mandó la invitación. El
  // procesamiento (marcar aceptada + enlazar al member) sucede en
  // applySupabaseSession después del login/signup.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (!token) return
    window.localStorage.setItem('apple_pending_invite', token)
    // Limpiamos la URL para que un refresh no vuelva a leer el token
    const clean = window.location.pathname + window.location.hash
    window.history.replaceState({}, '', clean)
    // Pre-llenar el email consultando el registro público del invite
    supabase
      .from('invites')
      .select('email')
      .eq('token', token)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.email) {
          setAuthEmail(data.email)
          setAuthMode('signup')
        }
      })
  }, [])

  // THE MASTER TREE ID (DEMO)
  const DEMO_TREE_ID = '00000000-0000-0000-0000-000000000001'
  const [currentTreeId, setCurrentTreeId] = useState<string>(DEMO_TREE_ID)

  // ── Restaurar sesión: prioridad a Supabase Auth, luego al legacy ──
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Try to restore Supabase Auth session first
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        applySupabaseSession(data.session)
        return
      }
      // 2. Fall back to legacy hardcoded session (Francisco / Eber)
      const savedUser = window.localStorage.getItem('apple_session_user')
      if (savedUser) {
        setLoginInputUser(savedUser)
        const savedTreeId = window.localStorage.getItem('apple_user_tree_id')
        if (savedTreeId) setCurrentTreeId(savedTreeId)
        setTutorialStep(0)
        setIsLoggedIn(true)
      }
    })

    // Keep listening for auth state changes (login / logout / token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) applySupabaseSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply a fresh Supabase Auth session to the app: pick a display name and
  // try to auto-load the user's tree. Falls back to the DEMO tree if none.
  // Procesa un token de invitación pendiente después del login/signup:
  //   1. Marca el invite como aceptado (accepted_at, accepted_by)
  //   2. Enlaza el user_id al member correspondiente
  //   3. Redirige al usuario al árbol que lo invitó
  const processPendingInvite = React.useCallback(async (userId: string) => {
    if (typeof window === 'undefined') return null
    const token = window.localStorage.getItem('apple_pending_invite')
    if (!token) return null
    try {
      const { data: invite, error } = await supabase
        .from('invites')
        .select('id, tree_id, member_id, accepted_at, expires_at')
        .eq('token', token)
        .maybeSingle()
      if (error || !invite) {
        console.warn('Invite lookup failed:', error?.message)
        window.localStorage.removeItem('apple_pending_invite')
        return null
      }
      if (invite.accepted_at) {
        window.localStorage.removeItem('apple_pending_invite')
        return invite.tree_id
      }
      if (new Date(invite.expires_at) < new Date()) {
        alert('Esta invitación expiró. Pide una nueva al familiar que te invitó.')
        window.localStorage.removeItem('apple_pending_invite')
        return null
      }
      // Marcar aceptada
      await supabase
        .from('invites')
        .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
        .eq('id', invite.id)
      // Enlazar el user al member (el owner de ese node ahora es este usuario)
      if (invite.member_id) {
        await supabase
          .from('members')
          .update({ user_id: userId })
          .eq('id', invite.member_id)
      }
      window.localStorage.removeItem('apple_pending_invite')
      return invite.tree_id as string
    } catch (err) {
      console.warn('processPendingInvite error:', err)
      return null
    }
  }, [])

  const applySupabaseSession = React.useCallback(async (s: Session) => {
    setSession(s)
    const displayName =
      (s.user.user_metadata?.full_name as string | undefined) ||
      s.user.email?.split('@')[0] ||
      'Familia'
    setLoginInputUser(displayName)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('apple_session_user', displayName)
      window.localStorage.setItem('currentUser', displayName)
    }
    // 1. Si hay un token de invitación pendiente, procesarlo — tiene
    //    prioridad sobre el árbol propio del usuario, porque significa que
    //    llegó al sitio DESDE una invitación y quiere ver ESE árbol.
    const invitedTreeId = await processPendingInvite(s.user.id)
    if (invitedTreeId) {
      setCurrentTreeId(invitedTreeId)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('apple_user_tree_id', invitedTreeId)
      }
      setIsLoggedIn(true)
      setTutorialStep(0)
      return
    }
    // 2. Fallback: auto-load a tree owned by this user, if any
    try {
      const { data: trees } = await supabase
        .from('trees')
        .select('id')
        .eq('owner_id', s.user.id)
        .limit(1)
      if (trees && trees.length > 0) {
        setCurrentTreeId(trees[0].id)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('apple_user_tree_id', trees[0].id)
        }
      } else {
        const saved = typeof window !== 'undefined'
          ? window.localStorage.getItem('apple_user_tree_id')
          : null
        if (saved) setCurrentTreeId(saved)
      }
    } catch (err) {
      console.warn('Could not auto-load user tree:', err)
    }
    setIsLoggedIn(true)
    setTutorialStep(0)
  }, [processPendingInvite])

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
  // Avatar del usuario logueado — con cascada de fallbacks:
  //   1. Manzana en el árbol cuyo nombre coincide con loginInputUser
  //   2. avatar_url del user_metadata de Supabase Auth
  //   3. DiceBear iniciales generadas a partir del nombre/email
  //   4. null (topbar renderiza el ícono User genérico)
  const userProfileAvatar = React.useMemo(() => {
    if (!isLoggedIn) return null
    // 1. Manzana con nombre similar
    if (treeData.members.length > 0 && loginInputUser) {
      const name = loginInputUser.toLowerCase()
      const match = treeData.members.find(
        m => m.avatarUrl && m.firstName.toLowerCase().includes(name)
      )
      if (match?.avatarUrl) return match.avatarUrl
    }
    // 2. Metadata de Supabase Auth
    const metaAvatar = (session?.user?.user_metadata as { avatar_url?: string; picture?: string } | undefined)
    if (metaAvatar?.avatar_url) return metaAvatar.avatar_url
    if (metaAvatar?.picture) return metaAvatar.picture
    // 3. Iniciales generadas
    const seed = loginInputUser || session?.user?.email?.split('@')[0] || 'user'
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1E2A22&textColor=D4AF37`
  }, [isLoggedIn, loginInputUser, treeData.members, session])
  // LINEAGE FILTERING LOGIC — versión basada en APELLIDO PRINCIPAL
  // Idea del owner: si todos los miembros comparten el apellido "Elias",
  // esos son la rama paterna (consanguíneos); los que tienen otro apellido
  // son cónyuges que se casaron in — rama materna.
  const { filteredMembers, filteredRelationships } = useMemo(() => {
    if (viewFocus === 'all' || treeData.members.length === 0) {
      return { filteredMembers: treeData.members, filteredRelationships: treeData.relationships }
    }
    // Contar apellidos y elegir el más frecuente como "apellido principal"
    const surnameCount = new Map<string, number>()
    treeData.members.forEach(m => {
      const last = (m.lastName || '').trim().toLowerCase()
      if (!last) return
      // Solo el primer apellido (para casos "Elias Fuentes")
      const first = last.split(/\s+/)[0]
      surnameCount.set(first, (surnameCount.get(first) || 0) + 1)
    })
    let mainSurname = ''
    let max = 0
    surnameCount.forEach((count, name) => { if (count > max) { max = count; mainSurname = name } })
    if (!mainSurname) {
      return { filteredMembers: treeData.members, filteredRelationships: treeData.relationships }
    }
    const isMain = (m: Member) => {
      const first = (m.lastName || '').trim().toLowerCase().split(/\s+/)[0]
      return first === mainSurname
    }
    // paternal: solo consanguíneos (con el apellido principal) — sus cónyuges NO
    // maternal: solo cónyuges casados in (con OTRO apellido) — los consanguíneos NO
    const visibleIds = new Set<string>()
    if (viewFocus === 'paternal') {
      treeData.members.forEach(m => { if (isMain(m)) visibleIds.add(m.id) })
    } else {
      // maternal: agrega los cónyuges de apellido distinto + sus hijos (para que
      // no queden líneas colgadas). Empezamos por los que no son main, y les
      // añadimos también los del main que sean sus hijos (para conectar).
      const nonMain = treeData.members.filter(m => !isMain(m))
      nonMain.forEach(m => visibleIds.add(m.id))
      // Descendientes de non-main (para conectar líneas de hijos mixtos)
      treeData.members.forEach(m => {
        if ((m.parents || []).some(pid => visibleIds.has(pid))) visibleIds.add(m.id)
      })
    }
    const members = treeData.members.filter(m => visibleIds.has(m.id))
    const relationships = treeData.relationships.filter(r =>
      visibleIds.has(r.member1Id) && visibleIds.has(r.member2Id)
    )
    return { filteredMembers: members, filteredRelationships: relationships }
  }, [treeData, viewFocus])

  const handleSendInvite = async (email: string, side: string, message: string) => {
    if (!invitingMember) return
    const payload = {
      toEmail: email,
      memberName: `${invitingMember.firstName} ${invitingMember.lastName || ''}`.trim(),
      memberSide: side,
      senderName: loginInputUser || 'Tu familia',
      personalMessage: message,
      treeUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      // Nuevos: para que la Edge Function pueda crear el token en Supabase
      // y el link del correo enlace al invitado a este árbol/miembro concreto
      treeId: currentTreeId,
      memberId: invitingMember.id,
      invitedByUserId: session?.user?.id,
    }
    try {
      // Envío por Supabase Edge Function `send-invite` (Resend detrás).
      const { data, error } = await supabase.functions.invoke('send-invite', { body: payload })
      if (error) {
        alert(`No se pudo enviar la invitación: ${error.message}`)
        throw error
      }
      if (data && (data as { error?: string }).error) {
        alert(`No se pudo enviar la invitación: ${(data as { error: string }).error}`)
        throw new Error((data as { error: string }).error)
      }
      // El modal se cierra solo tras mostrar el estado de éxito (1.8s).
      // NO cerramos aquí — si lo hacemos, unmontamos el modal antes de que
      // pueda pintar la pantalla de "¡Invitación Enviada!".
    } catch (err) {
      throw err
    }
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
        window.localStorage.setItem('apple_session_user', key)

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

  const handleLogout = async () => {
    // Sign out from Supabase Auth if there was a real session
    try { await supabase.auth.signOut() } catch { /* ignore */ }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('apple_session_user')
      window.localStorage.removeItem('currentUser')
    }
    setSession(null)
    setIsLoggedIn(false)
    setLoginInputUser('')
    setLoginInputPass('')
    setLoginError('')
    setAuthEmail('')
    setAuthPassword('')
    setAuthName('')
    setAuthNotice('')
    setTutorialStep(0)
  }

  // ── SUPABASE AUTH: sign in with email + password ──
  const handleSupabaseSignIn = async () => {
    setLoginError('')
    setAuthNotice('')
    if (!authEmail || !authPassword) {
      setLoginError('Escribe tu correo y contraseña.')
      return
    }
    setAuthLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword
    })
    setAuthLoading(false)
    if (error) {
      setLoginError(error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message)
      return
    }
    if (data.session) await applySupabaseSession(data.session)
  }

  // ── SUPABASE AUTH: sign up new account ──
  const handleSupabaseSignUp = async () => {
    setLoginError('')
    setAuthNotice('')
    if (!authEmail || !authPassword) {
      setLoginError('Escribe tu correo y contraseña.')
      return
    }
    if (authPassword.length < 6) {
      setLoginError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setAuthLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        data: { full_name: authName.trim() || authEmail.split('@')[0] }
      }
    })
    setAuthLoading(false)
    if (error) {
      setLoginError(error.message)
      return
    }
    if (data.session) {
      // Email confirmation is disabled → autologin
      await applySupabaseSession(data.session)
    } else {
      // Email confirmation is required → tell the user to check their inbox
      setAuthNotice(`¡Cuenta creada! Revisa ${authEmail.trim()} para confirmar tu correo y luego inicia sesión.`)
      setAuthMode('signin')
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
          backgroundColor: 'rgba(15, 26, 15, 0.55)', 
          backdropFilter: 'blur(30px) saturate(140%)',
          WebkitBackdropFilter: 'blur(30px) saturate(140%)',
          padding: '40px 34px', 
          borderRadius: '24px', 
          border: '1px solid rgba(212, 175, 55, 0.3)', 
          width: '88%', 
          maxWidth: '360px', 
          boxShadow: '0 24px 70px rgba(0,0,0,0.5), inset 0 0 18px rgba(212, 175, 55, 0.04)', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ 
            width: '76px', 
            height: '76px', 
            marginBottom: '16px', 
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
            margin: '0 0 6px', 
            fontSize: '28px',
            fontWeight: '600',
            letterSpacing: '0.03em',
            textTransform: 'none',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
          }}>AppleFamily Tree</h1>
          
          <p style={{
            color: '#D4AF37',
            opacity: 0.75,
            marginBottom: '22px',
            fontWeight: '600',
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase'
          }}>Acceso Privado Familiar</p>

          {/* ── AUTH MODE TABS ───────────────────────────────────── */}
          <div style={{
            display: 'flex',
            width: '100%',
            marginBottom: '18px',
            borderRadius: '10px',
            padding: '4px',
            backgroundColor: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.15)'
          }}>
            {(['signin', 'signup'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setAuthMode(mode); setLoginError(''); setAuthNotice('') }}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                  backgroundColor: authMode === mode ? 'rgba(212, 175, 55, 0.85)' : 'transparent',
                  color: authMode === mode ? '#0F1A0F' : '#D4AF37',
                  transition: 'all 0.2s'
                }}
              >
                {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          {/* ── AUTH FORM (Supabase Auth) ───────────────────────── */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Tu nombre completo"
                value={authName}
                onChange={e => setAuthName(e.target.value)}
                autoComplete="name"
                style={{
                  width: '100%', padding: '13px 18px', borderRadius: '12px',
                  border: '1px solid rgba(212, 175, 55, 0.22)', outline: 'none',
                  backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '14px', color: '#F5E6C8',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }}
              />
            )}
            <input
              type="email"
              placeholder="Correo electrónico"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              autoComplete={authMode === 'signup' ? 'email' : 'username'}
              style={{
                width: '100%', padding: '13px 18px', borderRadius: '12px',
                border: '1px solid rgba(212, 175, 55, 0.22)', outline: 'none',
                backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '14px', color: '#F5E6C8',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  authMode === 'signin' ? handleSupabaseSignIn() : handleSupabaseSignUp()
                }
              }}
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              style={{
                width: '100%', padding: '13px 18px', borderRadius: '12px',
                border: '1px solid rgba(212, 175, 55, 0.22)', outline: 'none',
                backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '14px', color: '#F5E6C8',
                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
              }}
            />
          </div>

          <div style={{ minHeight: '28px', marginTop: '10px', marginBottom: '4px' }}>
            {loginError && (
              <p style={{
                color: '#FF6B6B', fontSize: '13px', margin: 0, fontWeight: 600,
                animation: 'shake 0.4s ease-in-out'
              }}>{loginError}</p>
            )}
            {authNotice && !loginError && (
              <p style={{
                color: '#7FE0A2', fontSize: '12px', margin: 0, fontWeight: 500, lineHeight: 1.4
              }}>{authNotice}</p>
            )}
          </div>

          <button
            onClick={authMode === 'signin' ? handleSupabaseSignIn : handleSupabaseSignUp}
            disabled={authLoading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)',
              color: '#0F1A0F',
              borderRadius: '12px',
              border: 'none',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              cursor: authLoading ? 'wait' : 'pointer',
              boxShadow: '0 12px 24px rgba(212, 175, 55, 0.3)',
              transition: 'all 0.3s ease',
              marginTop: '8px',
              opacity: authLoading ? 0.65 : 1
            }}
          >
            {authLoading ? '...' : (authMode === 'signin' ? 'Entrar al Legado' : 'Crear mi cuenta')}
          </button>

          {/* ── LEGACY QUICK ACCESS (hardcoded family users) ──── */}
          <div style={{ width: '100%', marginTop: '18px' }}>
            <button
              onClick={() => setShowLegacyLogin(v => !v)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'rgba(245, 230, 200, 0.55)',
                fontSize: '11px',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {showLegacyLogin ? '▲ Ocultar acceso rápido familiar' : '▼ Acceso rápido familiar (temporal)'}
            </button>
            {showLegacyLogin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="Usuario (francisco / eber)"
                  value={loginInputUser}
                  onChange={e => setLoginInputUser(e.target.value)}
                  style={{
                    padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid rgba(212, 175, 55, 0.15)',
                    background: 'rgba(255,255,255,0.03)', color: '#F5E6C8',
                    fontSize: '13px', outline: 'none'
                  }}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={loginInputPass}
                  onChange={e => setLoginInputPass(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                  style={{
                    padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid rgba(212, 175, 55, 0.15)',
                    background: 'rgba(255,255,255,0.03)', color: '#F5E6C8',
                    fontSize: '13px', outline: 'none'
                  }}
                />
                <button
                  onClick={handleLogin}
                  style={{
                    padding: '10px', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.35)',
                    background: 'transparent', color: '#D4AF37', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', letterSpacing: '0.03em'
                  }}
                >
                  Entrar con acceso familiar
                </button>
              </div>
            )}
          </div>

          <p style={{ marginTop: '18px', fontSize: '10px', color: '#F5E6C8', opacity: 0.35 }}>
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

      // With RLS enabled, creating a tree requires a real Supabase Auth session.
      // The tree.owner_id column is NOT NULL and must reference a real user.
      if (!session) {
        alert('Para crear tu propio árbol, primero necesitas registrarte con correo y contraseña (arriba en "Crear cuenta").')
        return
      }

      const newTreeId = crypto.randomUUID()
      const displayName =
        (session.user.user_metadata?.full_name as string | undefined) ||
        session.user.email?.split('@')[0] ||
        'Mi Familia'

      // 1. Create the tree with owner_id set to the authenticated user
      const { error: treeError } = await supabase.from('trees').insert({
        id: newTreeId,
        owner_id: session.user.id,
        name: `Árbol de ${displayName}`
      })
      if (treeError) throw treeError

      // 2. Create first member for this tree, linked to the auth user so the
      //    "family_read" policy lets them see the whole tree.
      const { error } = await supabase.from('members').insert({
        tree_id: newTreeId,
        user_id: session.user.id,
        first_name: displayName,
        last_name: '',
        generation: 0,
        apple_type: 'red'
      })
      if (error) throw error

      // Also log activity
      await supabase.from('activities').insert({
        tree_id: newTreeId,
        actor_user_id: session.user.id,
        activity_type: 'new_member',
        title: 'Árbol Creado',
        description: `${displayName} ha comenzado su árbol genealógico.`,
        privacy: 'core'
      })

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('apple_user_tree_id', newTreeId)
        window.localStorage.setItem('apple_tutorial_skipped', 'true')
      }

      setCurrentTreeId(newTreeId)
      setTutorialStep(0)
    } catch (err) {
      console.error('Error starting new tree:', err)
      alert('Error al crear tu árbol: ' + (err instanceof Error ? err.message : 'Desconocido'))
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

  // Nota: no hay early return para móvil. El layout principal (<main>) usa
  // `.hide-on-mobile` en Sidebar/FeedPanel, TreeCanvas conmuta a MobileTreeView
  // adentro, y MobileBottomSheet + MobileBottomNav ya viven en el árbol de
  // renderizado principal. El componente MobileLayout era un stub placeholder
  // ("Mobile OK") que se comía toda la pantalla del teléfono.

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--body-bg)', position: 'relative' }}>
      {/* GLOBAL TREE BACKDROP · fixed layer that spans the full viewport,
         including BEHIND the topbar. Every glass panel above (topbar,
         sidebar, stories, drawer) blurs THIS layer, which is what makes
         the "vidrio" actually feel like glass. */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'url("/assets/arbol-base.png")',
        backgroundSize: 'var(--canvas-tree-size)',
        backgroundPosition: 'var(--canvas-tree-pos)',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'var(--body-bg)',
        opacity: 'var(--canvas-tree-opacity)',
        filter: 'var(--canvas-tree-filter)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <Topbar 
        viewFocus={viewFocus} 
        onViewFocusChange={setViewFocus} 
        onAdd={() => {
          // Sin manzana referencia — abre el modal para agregar un nuevo
          // familiar raíz. Se dispara el mismo evento que el HoverMenu usa;
          // el modal detecta detail === null y se comporta como "agregar
          // miembro suelto al árbol".
          const root = treeData.members.find(m => (m.generation ?? 0) === 0)
            || treeData.members[0]
          if (root) {
            window.dispatchEvent(new CustomEvent('open-add-modal', { detail: root }))
          }
        }}
        notificationCount={unreadCount}
        notifications={notifications}
        onClearNotifications={markAllRead}
        onNotificationClick={handleNotificationClick}
        onStartMyTree={handleStartMyTree}
        onShowTutorial={handleShowTutorial}
        onShowTerms={() => setIsTermsOpen(true)}
        userAvatarUrl={userProfileAvatar}
        currentUser={loginInputUser}
        onLogout={handleLogout}
        showStartTreeBtn={currentTreeId === DEMO_TREE_ID}
      />

      <div className="main-layout" style={{ display: 'flex', width: '100%', height: 'calc(100vh - 76px)', marginTop: '76px', position: 'relative' }}>
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
              profilePanelOpen={!!selectedMember}
            />
          )}

          {activeTab === 'Home' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
              <HomeDashboard members={filteredMembers} onViewTree={() => setActiveTab('My Tree')} />
            </div>
          )}

          {activeTab === 'Photo Albums' && (
            <PhotoAlbums treeId={currentTreeId} onClose={() => setActiveTab('My Tree')} />
          )}
        </div>

        <MemberProfilePanel
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onEdit={(m) => { setEditingMember(m); setSelectedMember(null); }}
          onInvite={(m) => { setInvitingMember(m); setSelectedMember(null); }}
          onAddRelative={(m) => {
            window.dispatchEvent(new CustomEvent('open-add-modal', { detail: m }))
            setSelectedMember(null)
          }}
          onFocusBranch={(m) => {
            // Foco activado desde el drawer — el evento lo captura TreeCanvas
            window.dispatchEvent(new CustomEvent('focus-branch', { detail: m }))
            setSelectedMember(null)
          }}
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
