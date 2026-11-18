'use client'

// Pantalla de carga: se muestra mientras se revisa la sesión guardada o se
// trae el árbol, para no "parpadear" la portada pública ni un árbol vacío.
export default function LoadingScreen({ message = 'Cargando tu familia…' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
        background: 'radial-gradient(circle at 50% 40%, #2D5016 0%, #1B2E1B 60%, #0F1A0F 100%)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo.png" alt="AppleFamily Tree" width={84} height={84}
        style={{ width: 84, height: 84, objectFit: 'contain', animation: 'aft-pulse 1.6s ease-in-out infinite' }} />
      <p style={{
        margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#F5E6C8', letterSpacing: '0.02em',
      }}>
        AppleFamily <em style={{ color: '#D4AF37' }}>Tree</em>
      </p>
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(245,230,200,0.6)' }}>{message}</p>
      <style>{`
        @keyframes aft-pulse { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.06); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { img[alt="AppleFamily Tree"] { animation: none !important } }
      `}</style>
    </div>
  )
}
