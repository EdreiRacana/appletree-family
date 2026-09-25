'use client'

import React from 'react'
import { X, Shield, Check } from 'lucide-react'

interface TermsModalProps {
  onClose: () => void
}

// ⚠️ NOTA LEGAL:
// El correo de contacto es "no-reply@sthenova.com" a solicitud del titular.
// Se recomienda cambiarlo por un correo que sí reciba (ej. privacidad@sthenova.com
// o hola@sthenova.com) porque la LFPDPPP exige un canal efectivo para ejercer
// derechos ARCO. Con "no-reply" el INAI puede considerar que no hay canal válido.
const LEGAL_EMAIL = 'no-reply@sthenova.com'
const LAST_UPDATED = '25 de septiembre de 2026'

export default function TermsModal({ onClose }: TermsModalProps) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={28} color="#D4AF37" />
            <h2 style={titleStyle}>Términos y Condiciones</h2>
          </div>
          <button onClick={onClose} style={closeButtonStyle}><X size={24} /></button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          <div style={legalBoxStyle}>
            <p style={{ ...paragraphStyle, fontStyle: 'italic', marginBottom: '20px' }}>
              Última actualización: {LAST_UPDATED}
            </p>

            <h3 style={sectionTitleStyle}>1. NATURALEZA DEL SERVICIO</h3>
            <p style={paragraphStyle}>
              AppleTree Family proporciona una herramienta digital avanzada para la visualización, organización y preservación del patrimonio histórico familiar. El servicio incluye la creación de árboles genealógicos dinámicos, almacenamiento de medios digitales y herramientas de colaboración familiar en tiempo real.
            </p>

            <h3 style={sectionTitleStyle}>2. PRIVACIDAD Y SEGURIDAD DE LOS DATOS</h3>
            <p style={paragraphStyle}>
              La privacidad es el pilar fundamental de nuestra plataforma.
              Usted conserva todos los derechos de propiedad intelectual sobre el contenido que sube.
              El acceso a su árbol familiar es privado y se limita exclusivamente a los usuarios autorizados por el administrador del árbol.
            </p>

            <h3 style={sectionTitleStyle}>3. RESPONSABILIDAD DEL USUARIO</h3>
            <p style={paragraphStyle}>
              Como usuario, se compromete a proporcionar información veraz y mantener la confidencialidad de sus credenciales. No debe utilizar la plataforma para cargar contenido ilegal o que infrinja derechos de terceros.
            </p>

            <h3 style={sectionTitleStyle}>4. LIMITACIÓN DE RESPONSABILIDAD</h3>
            <p style={paragraphStyle}>
              El servicio se proporciona &quot;tal cual&quot;. AppleTree Family no garantiza que el servicio sea ininterrumpido. No somos responsables de la exactitud histórica de los datos ingresados por los usuarios, ni de la pérdida, alteración o divulgación de información derivada del uso indebido de las credenciales por parte del usuario.
            </p>

            <h3 style={sectionTitleStyle}>5. PROPIEDAD INTELECTUAL</h3>
            <p style={paragraphStyle}>
              Todos los algoritmos, interfaces visuales y activos de diseño son propiedad exclusiva de AppleTree Family. Se prohíbe la ingeniería inversa o copia no autorizada.
            </p>

            <h3 style={sectionTitleStyle}>6. DATOS PERSONALES DE TERCEROS</h3>
            <p style={paragraphStyle}>
              Al añadir familiares al árbol, usted declara contar con el consentimiento de las personas mayores de edad cuyos datos ingresa (nombre, fechas, fotografías, biografías, historias). Tratándose de personas fallecidas, se compromete a respetar su memoria y a no cargar contenido difamatorio o sensible sin autorización de los deudos. AppleTree Family actúa como <em>encargado del tratamiento</em> respecto a esa información; usted es el <em>responsable</em> frente a esas personas.
            </p>

            <h3 style={sectionTitleStyle}>7. MENORES DE EDAD</h3>
            <p style={paragraphStyle}>
              El servicio no está dirigido a menores de 13 años y no aceptamos registros directos de personas menores de esa edad. Un adulto responsable puede incluir fotografías, nombres y fechas de menores dentro del árbol siempre que cuente con el consentimiento expreso de quien ejerce la patria potestad o tutela. El adulto responsable es responsable de retirar cualquier dato del menor si así se le solicita.
            </p>

            <h3 style={sectionTitleStyle}>8. NOTIFICACIONES Y COMUNICACIONES</h3>
            <p style={paragraphStyle}>
              Al activar las notificaciones push, autoriza a que su navegador reciba avisos sobre nuevos mensajes, comentarios y eventos del árbol familiar, incluso cuando la aplicación esté cerrada. Puede desactivarlas en cualquier momento desde <em>Configuración de Cuenta → Notificaciones</em> o desde la configuración de su navegador. AppleTree Family no envía publicidad, comunicaciones comerciales ni mensajes de terceros a través de este canal.
            </p>

            <h3 style={sectionTitleStyle}>9. COOKIES Y ALMACENAMIENTO LOCAL</h3>
            <p style={paragraphStyle}>
              Utilizamos almacenamiento local del navegador (LocalStorage, IndexedDB, Cache API y un Service Worker) exclusivamente para el correcto funcionamiento del servicio: mantener su sesión iniciada, guardar preferencias, servir la aplicación cuando no hay conexión y gestionar notificaciones push. No usamos cookies publicitarias ni de rastreo de terceros con fines de perfilado comercial.
            </p>

            <h3 style={sectionTitleStyle}>10. SERVICIOS DE TERCEROS</h3>
            <p style={paragraphStyle}>
              Para operar, AppleTree Family se apoya en proveedores de infraestructura, en particular <strong>Supabase</strong> (autenticación, base de datos y almacenamiento), <strong>Netlify</strong> (alojamiento web) y proveedores de correo transaccional para envío de invitaciones. Las notificaciones push se entregan a través de los servicios propios de cada navegador (Google FCM, Apple APNs, Mozilla autopush). Estos terceros procesan datos únicamente en la medida necesaria para prestar el servicio y bajo sus propias políticas de privacidad.
            </p>

            <h3 style={sectionTitleStyle}>11. RETENCIÓN Y ELIMINACIÓN DE DATOS</h3>
            <p style={paragraphStyle}>
              Sus datos se conservan mientras su cuenta permanezca activa. Puede solicitar la eliminación total de su cuenta y del contenido asociado escribiendo al correo indicado en la sección 14. Procesaremos su solicitud dentro de un plazo razonable, salvo obligaciones legales que exijan conservar cierta información. Los datos técnicos anónimos (registros de acceso, métricas de uso) pueden retenerse por periodos adicionales por motivos de seguridad y diagnóstico.
            </p>

            <h3 style={sectionTitleStyle}>12. DERECHOS ARCO (ACCESO, RECTIFICACIÓN, CANCELACIÓN Y OPOSICIÓN)</h3>
            <p style={paragraphStyle}>
              De acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), usted puede en cualquier momento (i) acceder a sus datos, (ii) rectificarlos si son inexactos, (iii) cancelarlos cuando considere que no se requieren para las finalidades del servicio y (iv) oponerse a su tratamiento para fines específicos. Para ejercer estos derechos, envíe su solicitud al correo indicado en la sección 14 acreditando su identidad. Le responderemos en los plazos legales aplicables.
            </p>

            <h3 style={sectionTitleStyle}>13. MODIFICACIONES A ESTOS TÉRMINOS</h3>
            <p style={paragraphStyle}>
              Podemos actualizar estos términos para reflejar cambios en el servicio o en la normativa aplicable. La versión vigente estará siempre disponible dentro de la aplicación con su fecha de última actualización. Si los cambios son sustanciales, se lo comunicaremos por medios razonables (aviso dentro de la app o notificación push). El uso continuado del servicio después de una modificación implica su aceptación.
            </p>

            <h3 style={sectionTitleStyle}>14. LEY APLICABLE, JURISDICCIÓN Y CONTACTO</h3>
            <p style={paragraphStyle}>
              Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia derivada de su interpretación o cumplimiento se someterá a los tribunales competentes de México, renunciando las partes a cualquier otro fuero que pudiera corresponderles. Para cualquier duda, aviso legal o ejercicio de derechos, contáctenos en: <a href={`mailto:${LEGAL_EMAIL}`} style={{ color: '#8B4513', fontWeight: 700 }}>{LEGAL_EMAIL}</a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <p style={{ fontSize: '12px', color: '#8B4513', opacity: 0.7, margin: 0 }}>
            Al continuar, aceptas cumplir con estos términos legales.
          </p>
          <button onClick={onClose} style={primaryButtonStyle}>
            <Check size={18} /> Entendido y Acepto
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
  backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#FAEFBC', width: '90%', maxWidth: '600px', borderRadius: '32px',
  padding: '40px', position: 'relative', border: '2px solid #F2D241', color: '#2C1810',
  boxShadow: '0 30px 60px -12px rgba(0,0,0,0.6)', animation: 'modalFadeIn 0.3s ease-out',
  maxHeight: '85vh', display: 'flex', flexDirection: 'column'
}

const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'serif', fontSize: '26px', color: '#8B4513' }
const closeButtonStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#8B4513' }

const contentStyle: React.CSSProperties = { overflowY: 'auto', paddingRight: '10px', marginBottom: '24px', flex: 1 }
const legalBoxStyle: React.CSSProperties = { textAlign: 'left' }
const sectionTitleStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 'bold', color: '#8B4513', marginBottom: '8px', marginTop: '20px', textTransform: 'uppercase' }
const paragraphStyle: React.CSSProperties = { fontSize: '14px', lineHeight: '1.6', color: '#2C1810', opacity: 0.9, margin: 0 }

const footerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(139,69,19,0.1)', paddingTop: '20px', flexShrink: 0 }
const primaryButtonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px', backgroundColor: '#8B4513', color: '#FAEFBC', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(139,69,19,0.3)' }
