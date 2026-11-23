'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import FeedPanel from '@/components/FeedPanel'
import AddStoryModal from '@/components/AddStoryModal'
import TreeCanvas from '@/components/tree/TreeCanvas'
import MemberProfilePanel from '@/components/tree/MemberProfilePanel'
import EditMemberModal from '@/components/tree/EditMemberModal'
import InviteMemberModal from '@/components/tree/InviteMemberModal'
import ConnectMemberModal from '@/components/tree/ConnectMemberModal'
import ChatPanel from '@/components/chat/ChatPanel'
import SuggestionModal from '@/components/SuggestionModal'
import { computeKinship, kinshipPhrase } from '@/lib/kinship'
import SuggestionsInbox from '@/components/SuggestionsInbox'
import FamilySwitcher, { type FamilyTree } from '@/components/FamilySwitcher'
import ChatsListPanel from '@/components/chat/ChatsListPanel'
import AccountSettingsModal from '@/components/AccountSettingsModal'
import FamilyWallPanel from '@/components/wall/FamilyWallPanel'
import EventCommentsPanel from '@/components/events/EventCommentsPanel'
import PhotoAlbums from '@/components/PhotoAlbums'
import HomeDashboard from '@/components/HomeDashboard'
import InMemoriamPanel from '@/components/InMemoriamPanel'
import TermsModal from '@/components/TermsModal'
import MobileBottomSheet from '@/components/MobileBottomSheet'
import MobileBottomNav from '@/components/MobileBottomNav'
import OnboardingModal from '@/components/OnboardingModal'
import PublicLanding from '@/components/PublicLanding'
import LoadingScreen from '@/components/LoadingScreen'
import ResetPasswordScreen from '@/components/ResetPasswordScreen'

// Versión de las reglas que acepta cada persona al registrarse. Cámbiala si
// las reglas cambian, para saber quién aceptó cuál.
const TERMS_VERSION = '2026-11-18'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { Member, Relationship } from '@/lib/types'
import { useNotifications } from '@/lib/useNotifications'
import { useTreeRole, touchTreeActivity } from '@/lib/useTreeRole'

// Build trigger: v4.1-professional-invites

// Familias (árboles) del usuario. Si la base aún no tiene get_my_families
// (migración 021 sin aplicar), usa la función vieja get_user_trees.
const DEMO_TREE = '00000000-0000-0000-0000-000000000001'
async function fetchMyFamilies(): Promise<FamilyTree[]> {
  let rows: FamilyTree[] = []
  const { data, error } = await supabase.rpc('get_my_families')
  if (!error && data) {
    rows = data as FamilyTree[]
  } else {
    const { data: old } = await supabase.rpc('get_user_trees')
    rows = ((old as Array<{ tree_id: string; tree_name: string; role: 'owner' | 'member'; member_count: number }> | null) ?? [])
      .map(t => ({ tree_id: t.tree_id, tree_name: t.tree_name, surname: null, role: t.role, member_count: Number(t.member_count), created_at: '' }))
  }
  const all = rows.filter(t => t.tree_id !== DEMO_TREE)
  // Árboles viejos de prueba (una sola manzana y sin apellido) no se muestran.
  const list = all.filter(t => Number(t.member_count) > 1 || !!t.surname)
  return list.length > 0 ? list : all
}

export default function AppleTreeDashboard() {
  const [treeData, setTreeData] = useState<{ members: Member[], relationships: Relationship[] }>({
    members: [],
    relationships: []
  })
  const [loading, setLoading] = useState(true)
  const [bgOpacity, setBgOpacity] = useState(0.3)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [chattingWithMember, setChattingWithMember] = useState<Member | null>(null)
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false)
  const [threadEvent, setThreadEvent] = useState<{ id: string; title: string; dateLabel: string } | null>(null)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [invitingMember, setInvitingMember] = useState<Member | null>(null)
  const [connectingMember, setConnectingMember] = useState<Member | null>(null)
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false)
  const [storyActor, setStoryActor] = useState<Member | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>('My Tree')
  const [mobileActiveTab, setMobileActiveTab] = useState<string>('My Tree')
  const [mobileSheetMember, setMobileSheetMember] = useState<Member | null>(null)
  // Familias (árboles) a las que pertenece el usuario
  const [families, setFamilies] = useState<FamilyTree[]>([])
  const [isTermsOpen, setIsTermsOpen] = useState(false)


  // MOCK LOGIN STATE (legacy hardcoded family users — kept as fallback)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginInputUser, setLoginInputUser] = useState('')
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Registro silencioso del Service Worker para push notifications.
  // No pide permisos aquí — solo lo prepara. El permiso se pide desde
  // AccountSettingsModal cuando el usuario activa el toggle.
  // updateViaCache:'none' + reg.update() garantizan que se recoja una versión
  // nueva del SW inmediatamente (si no, cambios como requireInteraction o el
  // manejo de tags pueden quedar dormidos días).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        try { await reg.update() } catch { /* ignore */ }
        if (reg.waiting) {
          try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }) } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    })()
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
    // Saltar la landing — venimos directo a aceptar invitación
    setShowAuthForm(true)
    // Limpiamos la URL para que un refresh no vuelva a leer el token
    const clean = window.location.pathname + window.location.hash
    window.history.replaceState({}, '', clean)
    // Pre-llenar el email con la vista previa segura de la invitación
    // (función get_invite_preview: solo devuelve datos de ESTE token).
    supabase
      .rpc('get_invite_preview', { p_token: token })
      .then(({ data }) => {
        const preview = Array.isArray(data) ? data[0] : data
        if (!preview) return
        if (preview.status === 'expired') {
          setAuthNotice('Esta invitación expiró. Pide una nueva al familiar que te invitó.')
          return
        }
        if (preview.status === 'accepted' || preview.status === 'claimed') {
          setAuthNotice('Esta invitación ya fue usada. Inicia sesión con tu cuenta.')
          setAuthMode('signin')
          return
        }
        if (preview.email) setAuthEmail(preview.email)
        setAuthMode('signup')
      })
  }, [])

  // THE MASTER TREE ID (DEMO) — se muestra solo si el usuario aún no está logueado.
  const DEMO_TREE_ID = '00000000-0000-0000-0000-000000000001'
  const [currentTreeId, setCurrentTreeId] = useState<string>(DEMO_TREE_ID)
  // Onboarding: usuario autenticado que aún NO tiene árbol propio ni pertenece
  // a ninguno. Al mostrarlo bloqueamos la vista principal hasta que elija nombre.
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  // Landing pública antes del login. Si viene de invitación, se salta.
  const [showAuthForm, setShowAuthForm] = useState(false)
  // true mientras se revisa si hay sesión guardada: se muestra la pantalla de
  // carga en vez de la portada pública (evita el "parpadeo" al entrar).
  const [authChecking, setAuthChecking] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(false)
  // Volvió desde el correo de "olvidé mi contraseña": pedir la nueva.
  const [recoveryMode, setRecoveryMode] = useState(false)
  // Volvió desde el correo "Crea tu nueva contraseña" (?recuperar=1).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).has('recuperar')) setRecoveryMode(true)
  }, [])

  // ── Restaurar sesión: prioridad a Supabase Auth, luego al legacy ──
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Try to restore Supabase Auth session first
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        applySupabaseSession(data.session).finally(() => setAuthChecking(false))
        return
      }
      // Sin sesión real de Supabase no hay acceso. Limpiamos restos del
      // login antiguo (usuarios fijos) que daban acceso solo con localStorage.
      window.localStorage.removeItem('apple_session_user')
      window.localStorage.removeItem('currentUser')
      setAuthChecking(false)
    }).catch(() => setAuthChecking(false))

    // Keep listening for auth state changes (login / logout / token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setSession(newSession)
      if (newSession) applySupabaseSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply a fresh Supabase Auth session to the app: pick a display name and
  // try to auto-load the user's tree. Falls back to the DEMO tree if none.
  // Procesa un token de invitación pendiente después del login/signup y
  // devuelve el árbol al que lo invitaron.
  const processPendingInvite = React.useCallback(async () => {
    if (typeof window === 'undefined') return null
    const token = window.localStorage.getItem('apple_pending_invite')
    if (!token) return null
    // La validación (token, vigencia, correo, manzana sin dueño) la hace la
    // función accept_invite en la base de datos.
    const { data: treeId, error } = await supabase.rpc('accept_invite', { p_token: token })
    window.localStorage.removeItem('apple_pending_invite')
    if (error) {
      setAuthNotice(error.message)
      return null
    }
    return (treeId as string) || null
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
    // 1. Si llegó desde un enlace de invitación, aceptarla primero: tiene
    //    prioridad porque quiere ver ESE árbol.
    let invitedTreeId = await processPendingInvite()
    // 2. Si no, aceptar automáticamente una invitación dirigida a su correo
    //    (cubre cuando confirmó el correo en otro navegador y se perdió el
    //    token). La base de datos exige correo confirmado y manzana libre.
    if (!invitedTreeId) {
      const { data: existingLink } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', s.user.id)
        .limit(1)
      if (!existingLink || existingLink.length === 0) {
        const { data: emailTreeId } = await supabase.rpc('accept_my_email_invite')
        invitedTreeId = (emailTreeId as string | null) || null
      }
    }
    if (invitedTreeId) {
      setCurrentTreeId(invitedTreeId)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('apple_user_tree_id', invitedTreeId)
      }
      setIsLoggedIn(true)
      setTutorialStep(0)
      return
    }
    // 2. Elegir SU árbol de forma determinista. Una cuenta puede tener varios
    //    árboles (p.ej. de pruebas, vacíos); antes se pedía "uno cualquiera"
    //    y en cada dispositivo podía salir uno distinto.
    //    Prioridad: el último que abrió (si aún pertenece) → el que tenga más
    //    familiares.
    try {
      const visible = await fetchMyFamilies()
      setFamilies(visible)
      if (visible.length > 0) {
        const saved = typeof window !== 'undefined'
          ? window.localStorage.getItem('apple_user_tree_id')
          : null
        const largest = [...visible].sort((a, b) => Number(b.member_count) - Number(a.member_count))[0]
        // El último que abrió gana si sigue en la lista.
        const pick = visible.find(t => t.tree_id === saved) || largest
        setCurrentTreeId(pick.tree_id)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('apple_user_tree_id', pick.tree_id)
        }
        setIsLoggedIn(true)
        setTutorialStep(0)
        return
      }
    } catch (err) {
      console.warn('Could not load user trees:', err)
    }

    // 3. No pertenece a ningún árbol: limpiar el árbol guardado (puede ser de
    //    otra cuenta en este mismo dispositivo) y mostrar el onboarding.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('apple_user_tree_id')
    }
    // Sin árbol propio → onboarding.
    setNeedsOnboarding(true)
    setIsLoggedIn(false)
  }, [processPendingInvite])

  // Árbol que se está viendo ahora: una respuesta lenta de otro árbol
  // (p.ej. al salir del ejemplo o cambiar de familia) no debe pisarlo.
  const latestTreeRef = React.useRef(currentTreeId)
  useEffect(() => { latestTreeRef.current = currentTreeId }, [currentTreeId])

  const fetchFamilyData = React.useCallback(async () => {
    // El árbol de ejemplo (Familia Pérez, ficticia) solo se carga durante el
    // recorrido de funciones (botón ?). Al entrar, se espera a que la sesión
    // elija el árbol real del usuario.
    if (currentTreeId === DEMO_TREE_ID && tutorialStep === 0) return
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
        birthPlace: m.birth_place,
        userId: m.user_id ?? null,
        createdBy: m.created_by ?? null,
      }))

      const mappedRels: Relationship[] = (relsData || []).map((r: any) => ({
        id: r.id,
        treeId: r.tree_id,
        member1Id: r.member1_id,
        member2Id: r.member2_id,
        relationship: r.relationship,
        isActive: r.is_active
      }))

      if (latestTreeRef.current !== currentTreeId) return
      setTreeData({ members: mappedMembers, relationships: mappedRels })
    } catch (err) {
      console.error('Error fetching tree data:', err)
    } finally {
      setLoading(false)
    }
  }, [currentTreeId, tutorialStep])

  // Real notification system (persistente + realtime)
  const { notifications, unreadCount, markAllRead, dismiss, dismissAll, markRead } =
    useNotifications(currentTreeId, treeData.members)

  // Rol del usuario en el árbol actual (owner | admin | member | null).
  // Fuente de verdad para condicionar UI de edición y panel de admins.
  const { isAdmin, isOwner } = useTreeRole(currentTreeId)

  // Cada sesión activa marca last_active_at en tree_memberships. Alimenta el
  // mecanismo de sucesión: si el owner no aparece en 30 días, un admin puede
  // reclamar ownership vía claim_ownership().
  useEffect(() => {
    if (session?.user) { void touchTreeActivity() }
  }, [session?.user?.id])

  // Permisos de la interfaz (la base de datos los vuelve a exigir con RLS):
  //   - Fundador / administrador: todo.
  //   - Familiar: edita SU manzana y las manzanas sin cuenta que él creó
  //     (bebé, pareja); agrega hijos y pareja a esas manzanas; lo demás se
  //     manda como sugerencia al administrador.
  const myUserId = session?.user?.id ?? null
  const canEditMember = useCallback((m: Member): boolean => {
    if (isAdmin) return true
    if (!myUserId) return false
    if (m.userId === myUserId) return !m.dateOfDeath
    return !m.userId && m.createdBy === myUserId
  }, [isAdmin, myUserId])
  const canDeleteMember = useCallback((m: Member): boolean => {
    if (isAdmin) return true
    return !!myUserId && !m.userId && m.createdBy === myUserId
  }, [isAdmin, myUserId])
  const canAddRelativeTo = canEditMember
  // Parentesco de cada manzana visto desde la mía ("Tu abuela", "Tu tío"…).
  const kinship = React.useMemo(() => {
    const mine = myUserId ? treeData.members.find(m => m.userId === myUserId) : undefined
    return computeKinship(treeData.members, treeData.relationships, mine?.id ?? null)
  }, [treeData, myUserId])
  const relationFor = (m: Member | null) => (m ? kinshipPhrase(kinship.get(m.id)) || undefined : undefined)
  const [suggestingMember, setSuggestingMember] = useState<Member | null>(null)
  // Con quien ya falleció no se puede chatear ni se le puede invitar.
  const canContact = (m: Member | null) => !!m && !m.dateOfDeath
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  // Sube al publicar un recuerdo, para que "En memoria" lo muestre sin recargar
  const [memoryRefresh, setMemoryRefresh] = useState(0)

  // Interceptor de setEditingMember: si no tiene permiso, ofrece mandar una
  // sugerencia en lugar de editar.
  const handleEditMember = useCallback((m: Member) => {
    if (!canEditMember(m)) {
      setSuggestingMember(m)
      return
    }
    setEditingMember(m)
  }, [canEditMember])

  // Handle bell click navigation
  // Cambiar de familia: carga ese árbol y cierra lo que estaba abierto del otro.
  const switchTree = useCallback((treeId: string) => {
    setSelectedMember(null)
    setMobileSheetMember(null)
    setChattingWithMember(null)
    setActiveTab('My Tree')
    setCurrentTreeId(treeId)
    if (typeof window !== 'undefined') window.localStorage.setItem('apple_user_tree_id', treeId)
  }, [])

  const reloadFamilies = useCallback(async () => {
    try { setFamilies(await fetchMyFamilies()) } catch { /* sin red: se queda la lista anterior */ }
  }, [])

  // La lista se refresca al entrar por invitación o al cambiar de familia.
  const sessionUserId = session?.user?.id
  useEffect(() => {
    if (!sessionUserId || currentTreeId === DEMO_TREE_ID) return
    let alive = true
    fetchMyFamilies().then(list => { if (alive) setFamilies(list) }).catch(() => {})
    return () => { alive = false }
  }, [sessionUserId, currentTreeId])

  const handleNotificationClick = (
    action: 'open_events' | 'open_stories' | 'open_chat' | 'open_event_thread' | 'open_wall' | 'open_suggestions' | 'open_tree',
    notif?: { senderMemberId?: string; activityId?: string; treeId?: string | null }
  ) => {
    // Avisos de otra familia: primero se abre esa familia.
    if (notif?.treeId && notif.treeId !== currentTreeId && currentTreeId !== DEMO_TREE_ID) {
      void reloadFamilies()
      switchTree(notif.treeId)
      if (action === 'open_suggestions') setIsSuggestionsOpen(true)
      markAllRead()
      return
    }
    if (action === 'open_events') setActiveTab('Events')
    else if (action === 'open_stories') {
      setActiveTab(null)
    } else if (action === 'open_chat' && notif?.senderMemberId) {
      const sender = treeData.members.find(m => m.id === notif.senderMemberId)
      if (sender) setChattingWithMember(sender)
    } else if (action === 'open_event_thread' && notif?.activityId) {
      // Buscamos el título del evento en las notifs; si no, usamos "Evento"
      setThreadEvent({ id: notif.activityId, title: 'Evento', dateLabel: '' })
      setActiveTab('Events')
    } else if (action === 'open_wall') {
      setActiveTab('Buzón')
    } else if (action === 'open_suggestions') {
      setIsSuggestionsOpen(true)
    }
    markAllRead()
  }

  useEffect(() => {
    fetchFamilyData()
  }, [fetchFamilyData])

  // Avatar del usuario logueado — cascada estricta:
  //   1. Manzana enlazada al auth.uid del usuario (m.user_id === session.user.id):
  //      - Si tiene avatarUrl → usarla.
  //      - Si NO tiene avatarUrl → generar iniciales de SU nombre, sin caer a
  //        otro miembro (evita mostrar la cara de otra persona por bugs de
  //        matching por substring).
  //   2. Si no hay manzana enlazada → metadata de Supabase Auth.
  //   3. Iniciales generadas del display name / email.
  //
  //  IMPORTANTE: no hay fallback por firstName.includes(name) — es peligroso
  //  porque puede matchear la manzana equivocada y mostrar la foto de otra
  //  persona en el topbar.
  const userProfileAvatar = React.useMemo(() => {
    if (!isLoggedIn) return null
    // 1. Match ESTRICTO por auth.uid.
    if (treeData.members.length > 0 && session?.user?.id) {
      const uidMatch = treeData.members.find(m => m.userId === session.user.id)
      if (uidMatch) {
        if (uidMatch.avatarUrl) return uidMatch.avatarUrl
        // Manzana enlazada pero sin foto → iniciales de SU nombre real
        const seed = `${uidMatch.firstName || ''} ${uidMatch.lastName || ''}`.trim() || 'user'
        return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1E2A22&textColor=D4AF37`
      }
    }
    // 2. Metadata de Supabase Auth (solo si no hay manzana enlazada)
    const metaAvatar = (session?.user?.user_metadata as { avatar_url?: string; picture?: string } | undefined)
    if (metaAvatar?.avatar_url) return metaAvatar.avatar_url
    if (metaAvatar?.picture) return metaAvatar.picture
    // 3. Iniciales generadas del displayName / email
    const seed = loginInputUser || session?.user?.email?.split('@')[0] || 'user'
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1E2A22&textColor=D4AF37`
  }, [isLoggedIn, loginInputUser, treeData.members, session])
  // Cada árbol ya es UNA familia (Elías, Fuentes…): se muestra completo.
  // La otra rama se ve cambiando de familia en la lista de arriba.
  const filteredMembers = treeData.members
  const filteredRelationships = treeData.relationships


  // Genera un token de invitación via Edge Function (bypasa RLS con
  // service_role). Antes lo hacíamos con supabase.from('invites').insert
  // directo, pero RLS pide que seas owner del tree — falla si el owner_id
  // no fue enlazado a tu auth.uid. La Edge Function ya arma todo bien.
  const createInviteLink = async (side: string, message: string): Promise<string | null> => {
    if (!invitingMember || !session?.user?.id) return null
    const payload = {
      // Placeholder — la Edge Function lo reemplaza con link-share-<ts>@invite.local
      toEmail: 'placeholder@invite.local',
      memberName: `${invitingMember.firstName} ${invitingMember.lastName || ''}`.trim(),
      memberSide: side,
      senderName: loginInputUser || 'Tu familia',
      personalMessage: message,
      treeUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      treeId: currentTreeId,
      memberId: invitingMember.id,
      invitedByUserId: session.user.id,
      mode: 'link-only' as const,
    }
    try {
      const { data, error } = await supabase.functions.invoke('send-invite', { body: payload })
      if (error) {
        alert(`No se pudo crear el link: ${error.message}`)
        return null
      }
      const result = data as { ok?: boolean; url?: string; error?: string }
      if (result?.error) {
        alert(`No se pudo crear el link: ${result.error}`)
        return null
      }
      return result?.url ?? null
    } catch (err) {
      alert(`No se pudo crear el link: ${err instanceof Error ? err.message : 'error desconocido'}`)
      return null
    }
  }

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

  // ── Olvidé mi contraseña: manda un correo con enlace para crear una nueva ──
  const handleForgotPassword = async () => {
    setLoginError('')
    setAuthNotice('')
    const email = authEmail.trim()
    if (!email) {
      setLoginError('Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".')
      return
    }
    setAuthLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // ?recuperar=1: al volver del correo la página sabe que debe pedir la
      // contraseña nueva (el aviso PASSWORD_RECOVERY puede llegar antes de
      // que la página empiece a escucharlo y perderse).
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/?recuperar=1` : undefined,
    })
    setAuthLoading(false)
    // Por privacidad no decimos si el correo existe o no.
    if (error && !/rate|seconds/i.test(error.message)) {
      setLoginError('No pudimos enviar el correo. Intenta de nuevo en unos minutos.')
      return
    }
    setAuthNotice(`Si ${email} tiene cuenta, te enviamos un correo para crear una contraseña nueva. Revisa también "No deseado".`)
  }

  // ── SUPABASE AUTH: sign up new account ──
  const handleSupabaseSignUp = async () => {
    setLoginError('')
    setAuthNotice('')
    if (!authEmail || !authPassword) {
      setLoginError('Escribe tu correo y contraseña.')
      return
    }
    if (authPassword.length < 8) {
      setLoginError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!termsAccepted) {
      setLoginError('Para crear tu cuenta acepta las reglas de la familia.')
      return
    }
    setAuthLoading(true)
    // Si viene de una invitación, el enlace de confirmación de correo regresa
    // con el token, así funciona aunque confirme desde otro navegador o app.
    const pendingInvite = typeof window !== 'undefined'
      ? window.localStorage.getItem('apple_pending_invite')
      : null
    const redirectBase = typeof window !== 'undefined' ? window.location.origin : undefined
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        data: {
          full_name: authName.trim() || authEmail.split('@')[0],
          // Constancia de que aceptó las reglas (fecha y versión).
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
        },
        emailRedirectTo: redirectBase
          ? `${redirectBase}/${pendingInvite ? `?invite=${encodeURIComponent(pendingInvite)}` : ''}`
          : undefined,
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

  // Llegó desde el correo de "olvidé mi contraseña": crear la nueva primero.
  if (recoveryMode) {
    return <ResetPasswordScreen onDone={() => setRecoveryMode(false)} />
  }

  // Mientras se revisa la sesión guardada: pantalla de carga (no la portada).
  if (authChecking) {
    return <LoadingScreen />
  }

  // Onboarding: usuario autenticado pero sin árbol propio ni invitación.
  // Muestra modal a pantalla completa hasta que cree su árbol.
  if (needsOnboarding && session) {
    return (
      <OnboardingModal
        defaultFirstName={(session.user.user_metadata?.full_name as string | undefined) || undefined}
        onCreated={(treeId) => {
          setCurrentTreeId(treeId)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('apple_user_tree_id', treeId)
          }
          setNeedsOnboarding(false)
          setIsLoggedIn(true)
          setTutorialStep(0)
        }}
      />
    )
  }

  if (!isLoggedIn && !showAuthForm) {
    return (
      <>
        <PublicLanding
          onStartSignup={() => { setAuthMode('signup'); setShowAuthForm(true) }}
          onStartSignin={() => { setAuthMode('signin'); setShowAuthForm(true) }}
          onShowTerms={() => setIsTermsOpen(true)}
        />
        {isTermsOpen && <TermsModal onClose={() => setIsTermsOpen(false)} />}
      </>
    )
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
            <img src="/assets/logo.png" alt="AppleFamily Tree" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
            {authMode === 'signin' && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={authLoading}
                style={{
                  alignSelf: 'flex-end', background: 'none', border: 'none', padding: '2px 0',
                  color: '#D4AF37', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
            {authMode === 'signup' && (
              <label style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start', textAlign: 'left',
                fontSize: '12px', lineHeight: 1.45, color: 'rgba(245,230,200,0.85)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: '#D4AF37', flexShrink: 0 }}
                />
                <span>
                  Acepto las{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setIsTermsOpen(true) }}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#D4AF37', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}
                  >
                    reglas de la familia y el aviso de privacidad
                  </button>
                  . Entiendo que esta es una red privada y que cada quien edita solo su manzana.
                </span>
              </label>
            )}
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

          <p style={{ marginTop: '18px', fontSize: '10px', color: '#F5E6C8', opacity: 0.35 }}>
            &copy; {new Date().getFullYear()} AppleFamily Tree. Todos los derechos reservados.
          </p>
        </div>
        {isTermsOpen && <TermsModal onClose={() => setIsTermsOpen(false)} />}

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
        familySwitcher={isLoggedIn && families.length > 0 && currentTreeId !== DEMO_TREE_ID ? (
          <FamilySwitcher
            families={families}
            currentTreeId={currentTreeId}
            members={treeData.members}
            myUserId={session?.user?.id ?? null}
            onSwitch={switchTree}
            onFamiliesChanged={reloadFamilies}
          />
        ) : undefined}
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
        onOpenAccountSettings={session ? () => setIsAccountSettingsOpen(true) : undefined}
        searchMembers={treeData.members}
        onSelectMember={(m) => {
          setSelectedMember(m)
          setActiveTab('My Tree')
        }}
        showStartTreeBtn={currentTreeId === DEMO_TREE_ID}
      />

      <div className="main-layout" style={{ display: 'flex', width: '100%', height: 'calc(100vh - 76px)', marginTop: '76px', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {loading && filteredMembers.length === 0 && (
            <div role="status" style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(245,230,200,0.75)', fontSize: 13, letterSpacing: '0.04em',
            }}>
              Cargando tu árbol…
            </div>
          )}
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
              onEditMember={handleEditMember}
              onAddStory={(m) => { setStoryActor(m); setIsStoryModalOpen(true); }}
              onOpenChat={(m) => setChattingWithMember(m)}
              onConnectMember={(m) => setConnectingMember(m)}
              bgOpacity={bgOpacity}
              profilePanelOpen={!!selectedMember}
              relationLabels={kinship}
              meId={treeData.members.find(m => session?.user?.id && m.userId === session.user.id)?.id ?? null}
            />
          )}

          {activeTab === 'Home' && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
              <HomeDashboard
                members={treeData.members}
                treeId={currentTreeId}
                meId={treeData.members.find(m => session?.user?.id && m.userId === session.user.id)?.id ?? null}
                onViewTree={() => setActiveTab('My Tree')}
                onOpenChat={(m) => { setChattingWithMember(m); setActiveTab('My Tree') }}
                canContact={canContact}
                onOpenMemorial={() => setActiveTab('Memoria')}
              />
            </div>
          )}

          {activeTab === 'Memoria' && (
            <InMemoriamPanel
              treeId={currentTreeId}
              members={treeData.members}
              refreshKey={memoryRefresh}
              onClose={() => setActiveTab('My Tree')}
              onShareMemory={(m) => { setStoryActor(m); setIsStoryModalOpen(true) }}
            />
          )}

          {activeTab === 'Photo Albums' && (
            <PhotoAlbums treeId={currentTreeId} onClose={() => setActiveTab('My Tree')} />
          )}

          {activeTab === 'Chats' && (
            <ChatsListPanel
              members={treeData.members}
              onOpenChat={(m) => { setChattingWithMember(m); setActiveTab('My Tree'); }}
              onClose={() => setActiveTab('My Tree')}
            />
          )}

          {activeTab === 'Buzón' && (
            <FamilyWallPanel
              treeId={currentTreeId}
              authorName={loginInputUser || 'Familiar'}
              authorAvatarUrl={userProfileAvatar}
              onClose={() => setActiveTab('My Tree')}
            />
          )}
        </div>

        <MemberProfilePanel
          member={selectedMember}
          relationLabel={relationFor(selectedMember)}
          onClose={() => setSelectedMember(null)}
          onEdit={selectedMember && canEditMember(selectedMember) ? (m) => { handleEditMember(m); setSelectedMember(null); } : undefined}
          onSuggest={!isAdmin ? (m) => { setSuggestingMember(m); setSelectedMember(null); } : undefined}
          onInvite={isAdmin ? (m) => { setInvitingMember(m); setSelectedMember(null); } : undefined}
          onAddRelative={selectedMember && canAddRelativeTo(selectedMember) ? (m) => {
            window.dispatchEvent(new CustomEvent('open-add-modal', { detail: m }))
            setSelectedMember(null)
          } : undefined}
          onFocusBranch={(m) => {
            // Foco activado desde el drawer — el evento lo captura TreeCanvas
            window.dispatchEvent(new CustomEvent('focus-branch', { detail: m }))
            setSelectedMember(null)
          }}
          onChat={(m) => { setChattingWithMember(m); setSelectedMember(null); }}
          onConnect={isAdmin ? (m) => { setConnectingMember(m); setSelectedMember(null); } : undefined}
        />

        {suggestingMember && (
          <SuggestionModal
            member={suggestingMember}
            treeId={currentTreeId}
            authorName={loginInputUser || 'Un familiar'}
            onClose={() => setSuggestingMember(null)}
          />
        )}

        {isSuggestionsOpen && (
          <SuggestionsInbox
            treeId={currentTreeId}
            members={treeData.members}
            canReview={isAdmin}
            onClose={() => setIsSuggestionsOpen(false)}
            onEditMember={(m) => { setIsSuggestionsOpen(false); handleEditMember(m) }}
            onMembersChanged={() => { void fetchFamilyData(); void reloadFamilies() }}
          />
        )}

        {chattingWithMember && canContact(chattingWithMember) && (
          <ChatPanel
            member={chattingWithMember}
            onClose={() => setChattingWithMember(null)}
            onInvite={isAdmin ? (m) => { setInvitingMember(m); setChattingWithMember(null); } : undefined}
          />
        )}

        {isAccountSettingsOpen && session?.user?.email && (
          <AccountSettingsModal
            currentEmail={session.user.email}
            onClose={() => setIsAccountSettingsOpen(false)}
            treeId={currentTreeId}
            isAdmin={isAdmin}
            isOwner={isOwner}
            members={treeData.members}
          />
        )}

        {threadEvent && (
          <EventCommentsPanel
            activityId={threadEvent.id}
            title={threadEvent.title}
            dateLabel={threadEvent.dateLabel}
            authorName={loginInputUser || 'Familiar'}
            authorAvatarUrl={userProfileAvatar}
            onClose={() => setThreadEvent(null)}
          />
        )}

        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onClose={() => setEditingMember(null)}
            onSave={fetchFamilyData}
            // 'admin' → owner/admin edita todo. 'self' → miembro no-admin edita
            // solo su propia manzana con campos personales (via RPC).
            mode={
              isAdmin
                ? 'admin'
                : (editingMember.userId === session?.user?.id && !editingMember.dateOfDeath)
                  ? 'self'
                  : 'admin'
            }
          />
        )}
        
        {invitingMember && canContact(invitingMember) && (
          <InviteMemberModal
            member={invitingMember}
            onClose={() => setInvitingMember(null)}
            onSend={handleSendInvite}
            onCreateLink={createInviteLink}
          />
        )}

        {connectingMember && (
          <ConnectMemberModal
            sourceMember={connectingMember}
            allMembers={treeData.members}
            onClose={() => setConnectingMember(null)}
            onSaved={fetchFamilyData}
          />
        )}

        {isStoryModalOpen && <AddStoryModal treeId={currentTreeId} actorMember={storyActor} onClose={() => { setIsStoryModalOpen(false); setStoryActor(null); }} onSave={() => { fetchFamilyData(); setMemoryRefresh(k => k + 1) }} />}

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
            onInviteMember={isAdmin ? (m) => { setInvitingMember(m); setActiveTab(null); } : undefined}
            onOpenEventThread={(ev) => setThreadEvent(ev)}
            onOpenSuggestions={() => setIsSuggestionsOpen(true)}
            suggestionsLabel={isAdmin ? 'Sugerencias' : 'Mis sugerencias'}
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
        relationLabel={relationFor(mobileSheetMember)}
        onClose={() => setMobileSheetMember(null)}
        onEdit={mobileSheetMember && canEditMember(mobileSheetMember) ? (m) => { handleEditMember(m); setMobileSheetMember(null); } : undefined}
        onSuggest={!isAdmin ? (m) => { setSuggestingMember(m); setMobileSheetMember(null); } : undefined}
        onAdd={mobileSheetMember && canAddRelativeTo(mobileSheetMember) ? (m) => { window.dispatchEvent(new CustomEvent('open-add-modal', { detail: m })); setMobileSheetMember(null); } : undefined}
        onDelete={mobileSheetMember && canDeleteMember(mobileSheetMember) ? async (m) => {
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
        } : undefined}
        onViewProfile={(m) => { setSelectedMember(m); setMobileSheetMember(null); }}
        onAddStory={(m) => { setStoryActor(m); setIsStoryModalOpen(true); setMobileSheetMember(null); }}
        onConnect={isAdmin ? (m) => { setConnectingMember(m); setMobileSheetMember(null); } : undefined}
        onChat={(m) => { setChattingWithMember(m); setMobileSheetMember(null); }}
      />

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────── */}
      <MobileBottomNav
        activeTab={mobileActiveTab}
        onOpenSuggestions={() => setIsSuggestionsOpen(true)}
        suggestionsLabel={isAdmin ? 'Sugerencias' : 'Mis sugerencias'}
        onTabChange={(tab) => {
          // 'Profile' abre el modal de Configuracion de Cuenta (contrasena,
          // correo, notificaciones). Es la ruta principal en movil para
          // llegar a esas opciones ya que el avatar del topbar tiene poco
          // espacio ahi.
          if (tab === 'Profile') {
            if (session?.user?.email) setIsAccountSettingsOpen(true)
            return
          }
          setMobileActiveTab(tab)
          if (tab === 'My Tree' || tab === 'Home' || tab === 'Photo Albums' || tab === 'Chats' || tab === 'Buzón' || tab === 'Events' || tab === 'Memoria') {
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
                <p style={{ margin: '0 0 20px', color: '#2C1810', fontSize: '14px', lineHeight: '1.5' }}>Estás viendo la Familia Pérez, una familia de ejemplo. Te mostramos cómo funciona todo antes de volver a tu árbol.</p>
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
                <p style={{ margin: '0 0 20px', color: '#2C1810', fontSize: '14px', lineHeight: '1.5' }}>Usa la barra superior para buscar familiares o cambiar de familia (por ejemplo, la de tu papá o la de tu mamá).</p>
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
