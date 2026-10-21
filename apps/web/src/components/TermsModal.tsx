'use client'

// AppleFamily Tree — Modal legal con 3 pestañas: Términos, Privacidad, Cookies.
//
// Contenido ajustado a:
//   - LFPDPPP (México) → derechos ARCO con canal de contacto efectivo
//   - GDPR (UE)        → bases legales, derechos del titular, DPO opcional
//   - COPPA / LFPDPPP → tratamiento especial de menores
//
// Correo legal: legal@applefamilytree.com (crear forwarding gratis en GoDaddy
// hacia tu correo real). No usar no-reply porque invalida el canal ARCO.

import React, { useState } from 'react'
import { X, Shield, FileText, Cookie, Mail } from 'lucide-react'

interface TermsModalProps {
  onClose: () => void
  initialTab?: 'terms' | 'privacy' | 'cookies'
}

const CONTACT_EMAIL = 'legal@applefamilytree.com'
const COMPANY_NAME = 'AppleFamily Tree'
const LAST_UPDATED = '21 de octubre de 2026'

type Tab = 'terms' | 'privacy' | 'cookies'

export default function TermsModal({ onClose, initialTab = 'terms' }: TermsModalProps) {
  const [tab, setTab] = useState<Tab>(initialTab)

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={24} color="#D4AF37" />
            <h2 style={titleStyle}>{COMPANY_NAME} — Legal</h2>
          </div>
          <button onClick={onClose} style={closeButtonStyle} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        <div style={tabsStyle}>
          <TabBtn active={tab === 'terms'}   onClick={() => setTab('terms')}   icon={<FileText size={14} />} label="Términos" />
          <TabBtn active={tab === 'privacy'} onClick={() => setTab('privacy')} icon={<Shield size={14} />}    label="Privacidad" />
          <TabBtn active={tab === 'cookies'} onClick={() => setTab('cookies')} icon={<Cookie size={14} />}    label="Cookies" />
        </div>

        <div style={contentStyle}>
          <p style={updatedStyle}>Última actualización: {LAST_UPDATED}</p>
          {tab === 'terms' && <Terms />}
          {tab === 'privacy' && <Privacy />}
          {tab === 'cookies' && <Cookies />}

          <div style={contactBoxStyle}>
            <Mail size={16} color="#D4AF37" />
            <span style={{ fontSize: '13px' }}>
              Dudas, consentimiento o derechos ARCO/GDPR:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#D4AF37', fontWeight: 700 }}>
                {CONTACT_EMAIL}
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...tabBtnStyle,
        ...(active ? tabActiveStyle : {}),
      }}
    >
      {icon} {label}
    </button>
  )
}

function Terms() {
  return (
    <div>
      <H3>1. Aceptación</H3>
      <P>
        Al crear una cuenta o usar <strong>{COMPANY_NAME}</strong> (en adelante, el “Servicio”),
        aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio.
      </P>

      <H3>2. Qué es el Servicio</H3>
      <P>
        {COMPANY_NAME} es una plataforma privada para que las familias documenten
        su genealogía: crear un árbol familiar, invitar familiares, compartir
        historias, fotos, videos (vía enlace externo), mensajes y eventos. El
        Servicio NO es una red social pública ni comercializa tus datos.
      </P>

      <H3>3. Elegibilidad y menores</H3>
      <P>
        Debes tener al menos <strong>14 años</strong> para crear una cuenta.
        Niñas, niños y adolescentes menores de 14 años pueden ser documentados
        en el árbol <em>por su tutor legal</em>, pero no pueden iniciar sesión
        hasta cumplir la edad mínima. El tutor es responsable del contenido que
        suba referente al menor.
      </P>

      <H3>4. Contenido del usuario</H3>
      <P>
        Conservas la titularidad de todo lo que subes (fotos, textos, datos).
        Al subirlo, nos otorgas una licencia limitada, no exclusiva y revocable
        <strong> únicamente para almacenarlo y mostrarlo a las personas con acceso
        a tu árbol</strong>. No lo usamos para entrenar IA, no lo vendemos, no lo
        indexamos públicamente.
      </P>
      <P>
        Te comprometes a no subir contenido ilegal, difamatorio, pornográfico,
        de odio, con datos personales de terceros sin consentimiento, o que
        viole derechos de autor.
      </P>

      <H3>5. Roles dentro del árbol</H3>
      <ul style={listStyle}>
        <li><strong>Owner</strong>: fundador, control total del árbol.</li>
        <li><strong>Admin</strong>: nombrado por el owner, edita contenido.</li>
        <li><strong>Member</strong>: edita solo su propia manzana (datos personales).</li>
      </ul>

      <H3>6. Suspensión y cierre</H3>
      <P>
        Podemos suspender o cerrar una cuenta que viole estos Términos.
        También puedes borrar tu cuenta en cualquier momento desde Configuración.
        El borrado elimina tu cuenta y <strong>desvincula</strong> tu manzana del árbol;
        el contenido comunitario (mensajes, comentarios) puede quedar anonimizado.
      </P>

      <H3>7. Limitación de responsabilidad</H3>
      <P>
        El Servicio se ofrece <em>“tal cual”</em>. Hacemos nuestro mejor esfuerzo
        por disponibilidad y seguridad, pero no garantizamos funcionamiento
        ininterrumpido. Haz respaldos de contenido crítico.
      </P>

      <H3>8. Modificaciones</H3>
      <P>
        Podemos actualizar estos Términos. Te avisaremos por correo o dentro
        del app con al menos 15 días de antelación cuando cambios sean sustantivos.
      </P>

      <H3>9. Ley aplicable</H3>
      <P>
        Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos.
        Cualquier controversia se someterá a los tribunales competentes de México.
      </P>
    </div>
  )
}

function Privacy() {
  return (
    <div>
      <H3>1. Responsable</H3>
      <P>
        El responsable del tratamiento de tus datos es <strong>{COMPANY_NAME}</strong>,
        con domicilio en México. Puedes contactarnos en <strong>{CONTACT_EMAIL}</strong>.
      </P>

      <H3>2. Datos que recopilamos</H3>
      <ul style={listStyle}>
        <li><strong>Cuenta</strong>: correo, contraseña (cifrada), nombre.</li>
        <li><strong>Perfil familiar</strong>: nombre completo, fecha de nacimiento, fotos, relaciones familiares, biografía, ocupación, lugar de nacimiento.</li>
        <li><strong>Contenido</strong>: mensajes de chat, historias, comentarios, mensajes del Buzón.</li>
        <li><strong>Técnicos</strong>: IP, user-agent, timestamps de inicio de sesión.</li>
        <li><strong>Push subscription</strong>: endpoint y claves criptográficas (solo si activas notificaciones push).</li>
      </ul>

      <H3>3. Finalidades</H3>
      <ul style={listStyle}>
        <li>Prestar el servicio (visualizar árbol, mensajes, invitaciones).</li>
        <li>Enviarte notificaciones y correos del propio servicio.</li>
        <li>Seguridad (prevenir fraude, abuso, pérdida de datos).</li>
        <li>Cumplir obligaciones legales.</li>
      </ul>
      <P>
        <strong>NO</strong> usamos tus datos para publicidad, perfilado comercial
        o entrenamiento de IA.
      </P>

      <H3>4. Base legal (GDPR)</H3>
      <ul style={listStyle}>
        <li><strong>Ejecución del contrato</strong>: operar el servicio que contrataste.</li>
        <li><strong>Consentimiento</strong>: push notifications, correos opcionales.</li>
        <li><strong>Interés legítimo</strong>: seguridad y prevención de fraude.</li>
      </ul>

      <H3>5. Compartir datos</H3>
      <P>Compartimos datos únicamente con proveedores necesarios para operar:</P>
      <ul style={listStyle}>
        <li><strong>Supabase</strong> (hosting de base de datos y auth) — EEUU.</li>
        <li><strong>Netlify</strong> (hosting del sitio) — EEUU.</li>
        <li><strong>Resend</strong> (envío de correos de invitación) — EEUU.</li>
      </ul>
      <P>
        Todos cuentan con Cláusulas Contractuales Estándar (SCC) para transferencias
        internacionales. No vendemos ni cedemos tus datos a terceros con fines comerciales.
      </P>

      <H3>6. Retención</H3>
      <P>
        Tus datos se conservan mientras tu cuenta esté activa. Si borras tu cuenta,
        se elimina en 30 días (ventana de recuperación por error de borrado).
        Las notificaciones de la campana se purgan automáticamente a los 90 días.
      </P>

      <H3>7. Tus derechos ARCO / GDPR</H3>
      <P>Tienes derecho a:</P>
      <ul style={listStyle}>
        <li><strong>Acceso</strong>: obtener copia de tus datos.</li>
        <li><strong>Rectificación</strong>: corregir datos inexactos.</li>
        <li><strong>Cancelación / Supresión</strong>: borrar tus datos.</li>
        <li><strong>Oposición</strong>: oponerte a ciertos usos.</li>
        <li><strong>Portabilidad</strong>: exportar tus datos en formato estructurado.</li>
        <li><strong>Limitación</strong>: restringir ciertos tratamientos.</li>
      </ul>
      <P>
        Ejerce estos derechos escribiendo a <strong>{CONTACT_EMAIL}</strong>. Respondemos
        en un máximo de 20 días hábiles. Puedes acudir al INAI (México) o a tu
        autoridad de protección de datos si consideras que no respetamos tus derechos.
      </P>

      <H3>8. Seguridad</H3>
      <P>
        Usamos cifrado TLS en tránsito, cifrado en reposo (Supabase/Postgres),
        contraseñas con bcrypt y Row-Level Security en todas las tablas. Las
        suscripciones push usan VAPID (ECDH P-256).
      </P>

      <H3>9. Menores</H3>
      <P>
        No recopilamos conscientemente datos de menores de 14 años salvo cuando
        un tutor legal los documenta en su árbol familiar. Si eres tutor y detectas
        que un menor de 14 creó cuenta sin autorización, escríbenos para eliminarla.
      </P>

      <H3>10. Cambios</H3>
      <P>
        Si cambiamos este Aviso de forma sustantiva te lo notificaremos por correo
        y en el app con 15 días de antelación.
      </P>
    </div>
  )
}

function Cookies() {
  return (
    <div>
      <H3>1. ¿Usamos cookies?</H3>
      <P>
        Usamos solo las cookies <strong>estrictamente necesarias</strong> para que
        el servicio funcione. No usamos cookies de publicidad, tracking ni analítica
        de terceros.
      </P>

      <H3>2. Cookies técnicas</H3>
      <ul style={listStyle}>
        <li>
          <strong>sb-auth-token</strong> — mantiene tu sesión iniciada.
          Expira cuando cierras sesión o pasa el tiempo de vida (7 días).
        </li>
        <li>
          <strong>__cf_bm</strong> — Cloudflare bot management de Supabase.
          Se renueva automáticamente, dura máximo 30 minutos.
        </li>
      </ul>

      <H3>3. Local Storage</H3>
      <P>
        Guardamos localmente en tu navegador: preferencia de tema (claro/oscuro),
        último árbol visitado, y el token de invitación mientras completas el signup.
        Nada de esto sale de tu dispositivo.
      </P>

      <H3>4. Service Worker</H3>
      <P>
        Si activas notificaciones push, instalamos un Service Worker (<code>/sw.js</code>)
        que escucha mensajes del servidor y muestra notificaciones. No rastrea tu
        navegación.
      </P>

      <H3>5. Cómo las bloqueas</H3>
      <P>
        Puedes bloquear o eliminar cookies desde la configuración de tu navegador.
        Si bloqueas las técnicas, el servicio no funcionará correctamente (no podrás
        mantener sesión).
      </P>
    </div>
  )
}

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 style={h3Style}>{children}</h3>
)
const P = ({ children }: { children: React.ReactNode }) => (
  <p style={pStyle}>{children}</p>
)

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 10000,
  backgroundColor: 'rgba(10,20,15,0.85)',
  backdropFilter: 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px',
}

const modalStyle: React.CSSProperties = {
  width: 'min(620px, 100%)', maxHeight: '90vh',
  backgroundColor: '#1E2A22', color: '#F5E6C8',
  borderRadius: '20px',
  boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.3)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}

const headerStyle: React.CSSProperties = {
  padding: '18px 24px',
  borderBottom: '1px solid rgba(212,175,55,0.2)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}

const titleStyle: React.CSSProperties = {
  margin: 0, fontFamily: 'Georgia, serif',
  fontSize: '19px', fontWeight: 700, color: '#D4AF37',
}

const closeButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(212,175,55,0.3)',
  borderRadius: '50%', width: '34px', height: '34px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#D4AF37',
}

const tabsStyle: React.CSSProperties = {
  display: 'flex', gap: '6px',
  padding: '12px 20px 0',
}

const tabBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(212,175,55,0.2)',
  borderRadius: '10px 10px 0 0',
  borderBottom: 'none',
  color: '#F5E6C8', fontSize: '12.5px', fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
}

const tabActiveStyle: React.CSSProperties = {
  background: 'rgba(212,175,55,0.15)',
  borderColor: '#D4AF37',
  color: '#D4AF37',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: '18px 24px 24px',
  overflowY: 'auto',
  borderTop: '1px solid rgba(212,175,55,0.2)',
}

const updatedStyle: React.CSSProperties = {
  fontSize: '11px', opacity: 0.6, letterSpacing: '0.06em',
  textTransform: 'uppercase', fontWeight: 700,
  margin: '0 0 14px',
}

const h3Style: React.CSSProperties = {
  margin: '18px 0 8px', fontSize: '14px', fontWeight: 700,
  color: '#D4AF37', letterSpacing: '0.02em',
  fontFamily: 'Georgia, serif',
}

const pStyle: React.CSSProperties = {
  margin: '0 0 10px', fontSize: '13.5px', lineHeight: 1.6,
  color: '#F5E6C8', opacity: 0.9,
}

const listStyle: React.CSSProperties = {
  margin: '0 0 12px', paddingLeft: '20px',
  fontSize: '13.5px', lineHeight: 1.65,
  color: '#F5E6C8', opacity: 0.9,
}

const contactBoxStyle: React.CSSProperties = {
  marginTop: '20px',
  padding: '12px 14px',
  backgroundColor: 'rgba(212,175,55,0.08)',
  border: '1px solid rgba(212,175,55,0.25)',
  borderRadius: '10px',
  display: 'flex', alignItems: 'center', gap: '10px',
  color: '#F5E6C8',
}
