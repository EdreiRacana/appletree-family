import React from 'react'

// Logo de la manzana dorada con un destello de luz que la recorre
// una vez cada 30 segundos. El brillo usa el propio logo como máscara,
// así que solo ilumina el dorado (no un rectángulo).
export default function BrandLogo({ height = 56, style, className }: {
  height?: number | string
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <span className={`brand-logo-shine ${className ?? ''}`} style={{ height, ...style }}>
      <img
        src="/assets/logo.png"
        alt="AppleFamily Tree"
        style={{ height: '100%', width: 'auto', objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
      />
      <span className="brand-logo-shine__glint" aria-hidden="true" />
    </span>
  )
}
