'use client'

import React from 'react'
import { X, Shield, Check } from 'lucide-react'

interface TermsModalProps {
  onClose: () => void
}

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
              El servicio se proporciona "tal cual". AppleTree Family no garantiza que el servicio sea ininterrumpido. No somos responsables de la exactitud histórica de los datos ingresados por los usuarios.
            </p>

            <h3 style={sectionTitleStyle}>5. PROPIEDAD INTELECTUAL</h3>
            <p style={paragraphStyle}>
              Todos los algoritmos, interfaces visuales y activos de diseño son propiedad exclusiva de AppleTree Family. Se prohíbe la ingeniería inversa o copia no autorizada.
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
