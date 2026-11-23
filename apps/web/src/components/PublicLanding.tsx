'use client'

// Landing pública que se muestra ANTES del formulario de login/signup.
// Explica qué es AppleFamily Tree, muestra el valor, y lleva al usuario
// a crear una cuenta nueva o iniciar sesión.

import React from 'react'
import { TreePine, Shield, Heart, Users, Camera, MessageCircle, ArrowRight } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'

// Luciérnagas doradas: posiciones fijas (no aleatorias) para evitar
// diferencias entre servidor y navegador.
const FIREFLIES = [
  [8, 72, 0, 14], [16, 38, 3, 17], [24, 84, 6, 13], [33, 22, 1.5, 19], [41, 64, 8, 15],
  [52, 30, 4.5, 18], [60, 78, 2, 16], [68, 18, 7, 14], [76, 56, 5, 20], [84, 34, 9, 15],
  [91, 70, 3.5, 17], [12, 52, 10, 18], [47, 88, 11, 16], [88, 86, 12, 19],
]

interface PublicLandingProps {
  onStartSignup: () => void
  onStartSignin: () => void
  onShowTerms: () => void
}

export default function PublicLanding({ onStartSignup, onStartSignin, onShowTerms }: PublicLandingProps) {
  return (
    <div style={{
      width: '100vw', minHeight: '100vh',
      background: 'radial-gradient(circle at center, #2D5016 0%, #1B2E1B 100%)',
      color: '#F5E6C8', position: 'relative', overflow: 'auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Background tree */}
      <div className="landing-bg" style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'url("/assets/arbol-base.png")',
        backgroundSize: 'cover', backgroundPosition: 'center bottom',
        opacity: 0.18, pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
        {FIREFLIES.map(([x, y, delay, dur], i) => (
          <span
            key={i}
            className="landing-firefly"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s, ${delay}s`, animationDuration: `${dur}s, ${dur / 3}s` }}
          />
        ))}
      </div>

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 2,
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: '1200px', margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BrandLogo height={44} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 700, color: '#D4AF37' }}>
            AppleFamily <em style={{ fontStyle: 'italic', opacity: 0.85 }}>Tree</em>
          </div>
        </div>
        <button
          onClick={onStartSignin}
          style={{
            padding: '8px 16px', borderRadius: '999px',
            background: 'transparent', color: '#F5E6C8',
            border: '1.5px solid rgba(212,175,55,0.5)', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700,
          }}
        >
          Iniciar sesión
        </button>
      </header>

      {/* Hero */}
      <main style={{
        position: 'relative', zIndex: 2,
        maxWidth: '820px', margin: '0 auto',
        padding: '28px 32px 20px',
        textAlign: 'center',
      }}>
        <div className="landing-rise landing-hero-logo" style={{ animationDelay: '0.05s' }}>
          <BrandLogo height={104} />
        </div>
        <h1 className="landing-rise" style={{ animationDelay: '0.25s',
          margin: 0, fontFamily: 'Georgia, serif',
          fontSize: 'clamp(26px, 4.2vw, 42px)', lineHeight: 1.1, fontWeight: 600,
          color: '#D4AF37', letterSpacing: '-0.01em',
        }}>
          La red privada <br />
          de tu familia.
        </h1>
        <p className="landing-rise" style={{ animationDelay: '0.45s',
          margin: '14px auto 0', maxWidth: '540px',
          fontSize: 'clamp(14px, 1.5vw, 16px)', lineHeight: 1.5,
          color: '#F5E6C8', opacity: 0.88,
        }}>
          Documenta tu árbol genealógico. Comparte historias, fotos y
          mensajes con los que importan. Sin anuncios, sin algoritmos,
          sin extraños.
        </p>

        <div className="landing-rise" style={{ animationDelay: '0.65s',
          marginTop: '22px',
          display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <button
            onClick={onStartSignup}
            className="landing-cta"
            style={{
              padding: '12px 22px', borderRadius: '999px',
              backgroundColor: '#D4AF37', color: '#1E2A22',
              border: 'none', fontWeight: 700, fontSize: '14px',
              cursor: 'pointer', letterSpacing: '0.01em',
              boxShadow: '0 6px 18px rgba(212,175,55,0.4)',
              display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}
          >
            Crear mi árbol familiar <ArrowRight size={15} />
          </button>
          <button
            onClick={onStartSignin}
            style={{
              padding: '12px 22px', borderRadius: '999px',
              background: 'transparent', color: '#F5E6C8',
              border: '1.5px solid rgba(212,175,55,0.4)',
              cursor: 'pointer', fontWeight: 700, fontSize: '14px',
            }}
          >
            Ya tengo cuenta
          </button>
        </div>

        <p style={{
          margin: '12px 0 0', fontSize: '11px', opacity: 0.6,
        }}>
          Gratis para familias. Sin tarjeta de crédito.
        </p>
      </main>

      {/* Features */}
      <section style={{
        position: 'relative', zIndex: 2,
        maxWidth: '1080px', margin: '0 auto',
        padding: '24px 32px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
      }}>
        <Feature
          index={0}
          icon={<TreePine size={20} />}
          title="Árbol interactivo"
          desc="Agrega padres, hijos, hermanos y parejas tocando manzanas. Visualiza generaciones."
        />
        <Feature
          index={1}
          icon={<MessageCircle size={20} />}
          title="Chat privado"
          desc="Mensajes 1 a 1 con cada familiar + un Buzón grupal para toda la familia."
        />
        <Feature
          index={2}
          icon={<Camera size={20} />}
          title="Historias y fotos"
          desc="Comparte memorias y logros. Videos de YouTube o Vimeo sin ocupar espacio."
        />
        <Feature
          index={3}
          icon={<Heart size={20} />}
          title="Fechas importantes"
          desc="Cumpleaños y aniversarios te llegan a tiempo. Nunca olvides una fecha."
        />
        <Feature
          index={4}
          icon={<Shield size={20} />}
          title="100% privado"
          desc="Solo quien tú invitas ve tu árbol. Chats privados, sin rastreo y sin anuncios."
        />
        <Feature
          index={5}
          icon={<Users size={20} />}
          title="Roles claros"
          desc="Fundador, administradores y familiares. Cada quien edita lo suyo y queda historial de cambios."
        />
      </section>

      {/* How it works */}
      <section style={{
        position: 'relative', zIndex: 2,
        maxWidth: '640px', margin: '0 auto',
        padding: '20px 32px 32px',
      }}>
        <h2 style={{
          margin: 0, fontFamily: 'Georgia, serif',
          fontSize: '22px', fontWeight: 600, color: '#D4AF37',
          textAlign: 'center',
        }}>
          Cómo empezar
        </h2>
        <ol style={{
          margin: '16px 0 0', padding: '0 0 0 20px',
          fontSize: '14px', lineHeight: 1.65,
        }}>
          <li>Crea tu cuenta y nombra tu familia.</li>
          <li>Agrega tus padres, hermanos, hijos — toque por toque.</li>
          <li>Invita a familiares por correo. Cuando entran, ven el árbol.</li>
          <li>Comparten historias, chatean, celebran fechas juntos.</li>
        </ol>
        <div style={{ textAlign: 'center', marginTop: '22px' }}>
          <button
            onClick={onStartSignup}
            style={{
              padding: '11px 22px', borderRadius: '999px',
              backgroundColor: '#D4AF37', color: '#1E2A22',
              border: 'none', fontWeight: 700, fontSize: '13.5px',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '8px',
            }}
          >
            Empezar <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 2,
        padding: '20px 24px', textAlign: 'center',
        fontSize: '11.5px', opacity: 0.6,
        borderTop: '1px solid rgba(212,175,55,0.15)',
        marginTop: '12px',
      }}>
        <p style={{ margin: '0 0 4px' }}>
          © {new Date().getFullYear()} AppleFamily Tree ·
          <button
            onClick={onShowTerms}
            style={{
              background: 'none', border: 'none', color: '#D4AF37',
              cursor: 'pointer', textDecoration: 'underline', padding: '0 4px',
              fontSize: '11.5px',
            }}
          >
            Términos, Privacidad y Cookies
          </button>
        </p>
        <p style={{ margin: 0, opacity: 0.6 }}>
          applefamilytree.com · Hecho con cariño en México 🌳
        </p>
      </footer>
    </div>
  )
}

function Feature({ icon, title, desc, index = 0 }: { icon: React.ReactNode; title: string; desc: string; index?: number }) {
  return (
    <div className="landing-rise landing-card" style={{ animationDelay: `${0.85 + index * 0.08}s`,
      padding: '14px 16px', borderRadius: '14px',
      backgroundColor: 'rgba(30,42,34,0.6)',
      border: '1px solid rgba(212,175,55,0.2)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div style={{
        width: '34px', height: '34px', borderRadius: '10px',
        backgroundColor: 'rgba(212,175,55,0.15)', color: '#D4AF37',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '10px',
      }}>
        {icon}
      </div>
      <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#D4AF37', fontFamily: 'Georgia, serif' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.45, opacity: 0.85 }}>
        {desc}
      </p>
    </div>
  )
}
