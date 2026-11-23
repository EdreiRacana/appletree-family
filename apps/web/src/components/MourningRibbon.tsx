import React from 'react'

// Moño negro de luto, discreto: dos tiras negras con un filo dorado fino
// para que se lea sobre fondos oscuros y claros.
export default function MourningRibbon({ size = 18, style, title = 'En memoria' }: {
  size?: number
  style?: React.CSSProperties
  title?: string
}) {
  const strandA = 'M6.5 29 L12 15.5 C17 10, 17.2 2.2, 12 2.2'
  const strandB = 'M17.5 29 L12 15.5 C7 10, 6.8 2.2, 12 2.2'
  return (
    <svg
      width={size}
      height={size * 32 / 24}
      viewBox="0 0 24 32"
      role="img"
      aria-label={title}
      style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))', pointerEvents: 'none', ...style }}
    >
      <title>{title}</title>
      <g fill="none" strokeLinejoin="round">
        <path d={strandB} stroke="#C9A646" strokeWidth={5.4} strokeLinecap="butt" />
        <path d={strandB} stroke="#121212" strokeWidth={4.2} strokeLinecap="butt" />
        <path d={strandA} stroke="#C9A646" strokeWidth={5.4} strokeLinecap="butt" />
        <path d={strandA} stroke="#1A1A1A" strokeWidth={4.2} strokeLinecap="butt" />
      </g>
    </svg>
  )
}
