import React, { useId } from 'react'

// Moño de luto: listón negro satinado con lazo arriba, colas cruzadas y
// puntas cortadas en diagonal. Un filo plateado muy tenue lo separa de
// fondos oscuros sin perder la sobriedad.
export default function MourningRibbon({ size = 18, style, title = 'En memoria' }: {
  size?: number
  style?: React.CSSProperties
  title?: string
}) {
  const uid = useId().replace(/:/g, '')
  const back = 'M20 5 C31 5, 34 17, 20 30 L5.9 57'
  const front = 'M20 5 C9 5, 6 17, 20 30 L34.1 57'
  return (
    <svg
      width={size}
      height={size * 56 / 40}
      viewBox="0 0 40 56"
      role="img"
      aria-label={title}
      style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,0.55))', pointerEvents: 'none', ...style }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={`satin-${uid}`} x1="0" y1="0" x2="40" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4a4a4a" />
          <stop offset="0.35" stopColor="#141414" />
          <stop offset="0.6" stopColor="#2e2e2e" />
          <stop offset="1" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id={`satinB-${uid}`} x1="40" y1="0" x2="0" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2a2a2a" />
          <stop offset="0.5" stopColor="#080808" />
          <stop offset="1" stopColor="#1c1c1c" />
        </linearGradient>
        {/* Puntas cortadas en diagonal, como un listón real */}
        <clipPath id={`cut-${uid}`}>
          <polygon points="-4,-4 44,-4 44,46 27,54.5 20,49 13,54.5 -4,46" />
        </clipPath>
      </defs>
      <g fill="none" strokeLinecap="butt" strokeLinejoin="round" clipPath={`url(#cut-${uid})`}>
        <path d={back} stroke="rgba(200,200,200,0.45)" strokeWidth={9.2} />
        <path d={back} stroke={`url(#satinB-${uid})`} strokeWidth={8} />
        <path d={front} stroke="rgba(210,210,210,0.5)" strokeWidth={9.2} />
        <path d={front} stroke={`url(#satin-${uid})`} strokeWidth={8} />
        {/* tapa la unión de las dos mitades en la punta del lazo */}
        <path d="M13.5 6.4 C17 4.6, 23 4.6, 26.5 6.4" stroke={`url(#satin-${uid})`} strokeWidth={8} />
        {/* brillo satinado sobre el lazo */}
        <path d="M17 7.5 C11 9, 10 16, 15 22" stroke="rgba(255,255,255,0.18)" strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </svg>
  )
}
